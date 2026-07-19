/**
 * One-time migration: backfill `User.betaParticipation` for owners of
 * workspaces that were already on `plan:"beta"` before that field existed
 * (from PR #58) — otherwise those owners would become permanently
 * ineligible for the two-month post-beta promo once the beta program
 * closes. Idempotent — only touches users with `betaParticipation.recordedAt
 * === null`; a re-run finds nothing left to touch.
 *
 * Usage:
 *   pnpm tsx lib/db/migrations/2026-07-beta-participation-backfill.ts [--dry-run]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { connectDB } from "../mongoose";
import { Workspace, User } from "../models";
import { assertSafeTarget, printDbFingerprint } from "../scriptGuard";

const isDryRun = process.argv.includes("--dry-run");

export type BackfillSummary = {
  workspacesFound: number;
  distinctOwners: number;
  updated: number;
  skippedAlreadyRecorded: number;
  ownersNotFound: string[];
};

/** Core backfill logic — usable directly by tests. */
export async function runBackfill(opts: { dryRun?: boolean } = {}): Promise<BackfillSummary> {
  const dryRun = opts.dryRun ?? false;

  const betaWorkspaces = await Workspace.find({ plan: "beta" }).select("ownerUserId").lean();
  const ownerUserIds = Array.from(new Set(betaWorkspaces.map((w) => w.ownerUserId)));

  let updated = 0;
  let skippedAlreadyRecorded = 0;
  const ownersNotFound: string[] = [];

  for (const ownerUserId of ownerUserIds) {
    const user = await User.findOne({ workosUserId: ownerUserId });
    if (!user) {
      ownersNotFound.push(ownerUserId);
      continue;
    }
    if (user.betaParticipation?.recordedAt) {
      skippedAlreadyRecorded += 1;
      continue;
    }
    if (!dryRun) {
      user.betaParticipation = { recordedAt: new Date(), source: "backfill" };
      await user.save();
    }
    updated += 1;
  }

  return {
    workspacesFound: betaWorkspaces.length,
    distinctOwners: ownerUserIds.length,
    updated,
    skippedAlreadyRecorded,
    ownersNotFound,
  };
}

async function run() {
  console.log(`-> Migration: beta-participation-backfill (${isDryRun ? "DRY RUN" : "LIVE"})`);
  await connectDB();

  const uri = process.env.DATABASE_URL!;
  printDbFingerprint(uri);
  assertSafeTarget(uri, { dryRun: isDryRun });

  const summary = await runBackfill({ dryRun: isDryRun });

  console.log(`  workspaces on plan:"beta": ${summary.workspacesFound}`);
  console.log(`  distinct owners: ${summary.distinctOwners}`);
  console.log(`  ${isDryRun ? "would update" : "updated"}: ${summary.updated}`);
  console.log(`  skipped (already recorded): ${summary.skippedAlreadyRecorded}`);
  if (summary.ownersNotFound.length > 0) {
    console.warn(`  WARNING: ownerUserId(s) with no matching User: ${summary.ownersNotFound.join(", ")}`);
  }

  console.log(`\n Migration complete.`);
  if (isDryRun) {
    console.log("  (dry run - no writes performed)");
  }

  await mongoose.disconnect();
  process.exit(0);
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
