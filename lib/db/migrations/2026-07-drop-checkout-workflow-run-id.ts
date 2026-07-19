/**
 * One-time migration: drop the obsolete `lsCheckoutWorkflowRunId` field from
 * every Workspace document. It tracked an in-flight durable checkout
 * workflow run — the webhook-only checkout path no longer starts one.
 * Idempotent — a re-run finds nothing left to unset.
 *
 * Usage:
 *   pnpm tsx lib/db/migrations/2026-07-drop-checkout-workflow-run-id.ts [--dry-run]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { connectDB } from "../mongoose";
import { Workspace } from "../models";
import { assertSafeTarget, printDbFingerprint } from "../scriptGuard";

const isDryRun = process.argv.includes("--dry-run");

export type DropCheckoutWorkflowRunIdSummary = {
  matched: number;
  updated: number;
};

/** Core migration logic — usable directly by tests. */
export async function runDropCheckoutWorkflowRunId(
  opts: { dryRun?: boolean } = {}
): Promise<DropCheckoutWorkflowRunIdSummary> {
  const dryRun = opts.dryRun ?? false;

  const matched = await Workspace.collection.countDocuments({
    lsCheckoutWorkflowRunId: { $exists: true },
  });

  let updated = 0;
  if (matched > 0 && !dryRun) {
    const result = await Workspace.collection.updateMany(
      { lsCheckoutWorkflowRunId: { $exists: true } },
      { $unset: { lsCheckoutWorkflowRunId: "" } }
    );
    updated = result.modifiedCount;
  }

  return { matched, updated };
}

async function run() {
  console.log(`-> Migration: drop-checkout-workflow-run-id (${isDryRun ? "DRY RUN" : "LIVE"})`);
  await connectDB();

  const uri = process.env.DATABASE_URL!;
  printDbFingerprint(uri);
  assertSafeTarget(uri, { dryRun: isDryRun });

  const summary = await runDropCheckoutWorkflowRunId({ dryRun: isDryRun });

  console.log(`  workspaces with lsCheckoutWorkflowRunId: ${summary.matched}`);
  console.log(`  ${isDryRun ? "would update" : "updated"}: ${summary.updated}`);

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
