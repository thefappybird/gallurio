/**
 * One-time migration: wrap legacy flat startAt/endAt fields into
 * sessions: [{startAt, endAt}] and set denormalized firstSessionStart /
 * lastSessionEnd.
 *
 * Safe to re-run — skips documents that already have sessions.
 *
 * Usage:
 *   pnpm tsx lib/db/migrations/2026-05-multi-session-bookings.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { connectDB } from "../mongoose";

async function run() {
  console.log("→ Connecting to MongoDB…");
  await connectDB();

  const db = mongoose.connection.db;
  if (!db) throw new Error("No DB connection");

  const col = db.collection("bookings");

  // Find docs that don't yet have the sessions field.
  const cursor = col.find({ sessions: { $exists: false } });
  let updated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    const startAt = doc.startAt as Date | undefined;
    const endAt = doc.endAt as Date | undefined;

    if (!startAt) {
      console.warn(`  ⚠ _id=${doc._id} has no startAt — skipping`);
      skipped++;
      continue;
    }

    const sessionEndAt = endAt ?? startAt;

    await col.updateOne(
      { _id: doc._id },
      {
        $set: {
          sessions: [{ startAt, endAt: sessionEndAt }],
          firstSessionStart: startAt,
          lastSessionEnd: sessionEndAt,
        },
        $unset: { startAt: 1, endAt: 1 },
      }
    );
    updated++;
  }

  console.log(`✓ Migration complete. Updated: ${updated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
