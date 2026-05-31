/**
 * One-time migration: denormalize `teamId` onto transactions from their related
 * booking.
 *
 * Teams Phase 6 adds `Transaction.teamId` (the team that worked the booking).
 * Pre-existing transactions have `teamId == null`; backfill each one that has a
 * `bookingId` from `booking.teamId`. Transactions with no booking (e.g.
 * subscription charges) are left null by design.
 *
 * Safe to re-run — only touches transactions where `teamId` is null/missing.
 * Use --dry-run to preview counts without writing.
 *
 * Usage:
 *   pnpm tsx lib/db/migrations/2026-06-transactions-team-backfill.ts --dry-run
 *   pnpm tsx lib/db/migrations/2026-06-transactions-team-backfill.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { connectDB } from "../mongoose";
import { Booking } from "../models/Booking";
import { Transaction } from "../models/Transaction";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_LOG_EVERY = 500;

async function run() {
  console.log(`→ Connecting to MongoDB…${DRY_RUN ? " (DRY RUN — no writes)" : ""}`);
  await connectDB();

  // Cache booking → teamId so each booking is resolved at most once.
  const teamByBooking = new Map<string, mongoose.Types.ObjectId | null>();

  async function teamForBooking(
    bookingId: mongoose.Types.ObjectId,
  ): Promise<mongoose.Types.ObjectId | null> {
    const key = String(bookingId);
    const cached = teamByBooking.get(key);
    if (cached !== undefined) return cached;
    const booking = await Booking.findById(bookingId).select({ teamId: 1 }).lean();
    const teamId = (booking?.teamId as mongoose.Types.ObjectId | undefined) ?? null;
    teamByBooking.set(key, teamId);
    return teamId;
  }

  const filter = {
    bookingId: { $ne: null },
    $or: [{ teamId: null }, { teamId: { $exists: false } }],
  };
  const total = await Transaction.countDocuments(filter);
  console.log(`→ ${total} transaction(s) with a booking but no teamId`);

  let updated = 0;
  let skippedNoTeam = 0;
  let scanned = 0;

  const cursor = Transaction.find(filter).select({ _id: 1, bookingId: 1 }).lean().cursor();

  for await (const tx of cursor) {
    scanned++;
    const teamId = await teamForBooking(tx.bookingId as mongoose.Types.ObjectId);
    if (!teamId) {
      // Booking missing or itself un-backfilled — leave null (run the bookings
      // backfill first if this is unexpectedly high).
      skippedNoTeam++;
      continue;
    }
    if (!DRY_RUN) {
      await Transaction.updateOne({ _id: tx._id }, { $set: { teamId } });
    }
    updated++;
    if (scanned % BATCH_LOG_EVERY === 0) {
      console.log(`  …processed ${scanned}/${total}`);
    }
  }

  console.log(
    `${DRY_RUN ? "✓ DRY RUN" : "✓ Migration"} complete. Scanned: ${scanned}, ${
      DRY_RUN ? "would update" : "updated"
    }: ${updated}, skipped (no booking team): ${skippedNoTeam}`,
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  mongoose.disconnect().finally(() => process.exit(1));
});
