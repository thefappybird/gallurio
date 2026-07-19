/**
 * One-time migration: drop the legacy "starter" plan tier.
 *
 * Every Workspace with plan:"starter" is set to plan:"free" — "starter" was
 * dropped from PLAN_TIERS (lib/db/models/Workspace.ts) so no workspace may
 * carry it going forward. Idempotent — a re-run finds nothing left to touch.
 *
 * Usage:
 *   pnpm tsx lib/db/migrations/2026-07-drop-starter-plan.ts [--dry-run]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { connectDB } from "../mongoose";
import { assertSafeTarget, printDbFingerprint } from "../scriptGuard";

const isDryRun = process.argv.includes("--dry-run");

async function run() {
  console.log(`→ Migration: drop-starter-plan (${isDryRun ? "DRY RUN" : "LIVE"})`);
  await connectDB();

  const uri = process.env.DATABASE_URL!;
  printDbFingerprint(uri);
  assertSafeTarget(uri, { dryRun: isDryRun });

  const db = mongoose.connection.db;
  if (!db) throw new Error("No DB connection");

  const col = db.collection("workspaces");

  const matchCount = await col.countDocuments({ plan: "starter" });
  console.log(`  workspaces on plan:"starter": ${matchCount}`);

  if (matchCount > 0 && !isDryRun) {
    const result = await col.updateMany(
      { plan: "starter" },
      { $set: { plan: "free" } }
    );
    console.log(`  updated: ${result.modifiedCount}`);
  }

  console.log(
    `\n✓ Migration complete. ${isDryRun ? "Would update" : "Updated"}: ${matchCount}`
  );
  if (isDryRun) {
    console.log("  (dry run — no writes performed)");
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
