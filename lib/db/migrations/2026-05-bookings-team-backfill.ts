/**
 * One-time migration: assign every booking with a null `teamId` to its
 * workspace's default ("Main") team.
 *
 * Teams Phase 4 makes `Booking.teamId` a first-class field. Pre-existing
 * bookings have `teamId == null` and must be backfilled to the workspace's Main
 * team (guaranteed to exist by 2026-05-default-team-bootstrap / onboarding).
 *
 * Safe to re-run — only touches bookings where `teamId` is null/missing, so a
 * second pass finds nothing. Use --dry-run to preview counts without writing.
 *
 * Usage:
 *   pnpm tsx lib/db/migrations/2026-05-bookings-team-backfill.ts --dry-run
 *   pnpm tsx lib/db/migrations/2026-05-bookings-team-backfill.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { connectDB } from "../mongoose";
import { assertSafeTarget, printDbFingerprint } from "../scriptGuard";
import { Booking } from "../models/Booking";
import { Team } from "../models/team";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_LOG_EVERY = 500;

async function run() {
  console.log(`→ Connecting to MongoDB…${DRY_RUN ? " (DRY RUN — no writes)" : ""}`);
  await connectDB();

  const uri = process.env.DATABASE_URL!;
  printDbFingerprint(uri);
  assertSafeTarget(uri, { dryRun: DRY_RUN });

  // Per-workspace Main-team cache so we resolve each workspace's default team at
  // most once. A workspace missing a Main team is reported and its bookings are
  // skipped rather than guessed at.
  const mainTeamByWorkspace = new Map<string, mongoose.Types.ObjectId | null>();

  async function mainTeamFor(
    workspaceId: mongoose.Types.ObjectId,
  ): Promise<mongoose.Types.ObjectId | null> {
    const key = String(workspaceId);
    const cached = mainTeamByWorkspace.get(key);
    if (cached !== undefined) return cached;
    const team = await Team.findOne({ workspaceId, isDefault: true })
      .select({ _id: 1 })
      .lean();
    const id = team?._id ?? null;
    mainTeamByWorkspace.set(key, id);
    return id;
  }

  const filter = { $or: [{ teamId: null }, { teamId: { $exists: false } }] };
  const total = await Booking.countDocuments(filter);
  console.log(`→ ${total} booking(s) without a teamId`);

  let updated = 0;
  let skippedNoTeam = 0;
  let scanned = 0;

  const cursor = Booking.find(filter).select({ _id: 1, workspaceId: 1 }).lean().cursor();

  for await (const booking of cursor) {
    scanned++;
    const teamId = await mainTeamFor(booking.workspaceId as mongoose.Types.ObjectId);
    if (!teamId) {
      skippedNoTeam++;
      console.warn(
        `  ! workspace ${String(booking.workspaceId)} has no Main team — skipping booking ${String(booking._id)}`,
      );
      continue;
    }
    if (!DRY_RUN) {
      await Booking.updateOne({ _id: booking._id }, { $set: { teamId } });
    }
    updated++;
    if (scanned % BATCH_LOG_EVERY === 0) {
      console.log(`  …processed ${scanned}/${total}`);
    }
  }

  console.log(
    `${DRY_RUN ? "✓ DRY RUN" : "✓ Migration"} complete. Scanned: ${scanned}, ${
      DRY_RUN ? "would update" : "updated"
    }: ${updated}, skipped (no Main team): ${skippedNoTeam}`,
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  mongoose.disconnect().finally(() => process.exit(1));
});
