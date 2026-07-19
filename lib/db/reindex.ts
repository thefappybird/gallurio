/**
 * Drops stale indexes and rebuilds the ones declared in current schemas.
 *
 * Usage:
 *   pnpm reindex -- --dry-run                        # report only, no changes
 *   pnpm reindex -- --allow-dev                       # confirm a dev-looking target
 *   pnpm reindex -- --i-understand-production          # confirm a production-looking target
 *
 * Mongoose only *adds* indexes that match the schema — it never drops indexes
 * that no longer match. So when you change a unique constraint or remove an
 * index from a schema, the old one lingers in MongoDB and causes confusing
 * E11000 duplicate key errors. This script fixes that without losing any data.
 *
 * --dry-run reports which indexes WOULD be created/dropped per model (via
 * Model.diffIndexes()) without touching anything. A real (non-dry-run) run
 * that would DROP indexes requires the same --allow-dev / --i-understand-production
 * confirmation as every other DB script — see lib/db/scriptGuard.ts.
 *
 * Safe to run repeatedly. NEVER add destructive data ops here — that's `pnpm seed`.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { connectDB } from "./mongoose";
import { assertSafeTarget, printDbFingerprint } from "./scriptGuard";
// Importing the barrel registers every model on the default connection so
// syncIndexes can iterate all of them.
import "./models";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`→ Connecting to MongoDB…${DRY_RUN ? " (DRY RUN — report only)" : ""}`);
  await connectDB();

  const uri = process.env.DATABASE_URL!;
  printDbFingerprint(uri);
  assertSafeTarget(uri, { dryRun: DRY_RUN });

  if (DRY_RUN) {
    console.log("→ Diffing indexes for all models (no changes will be made)…");
    for (const name of mongoose.modelNames()) {
      const model = mongoose.model(name);
      const diff = await model.diffIndexes();
      if (diff.toCreate.length === 0 && diff.toDrop.length === 0) {
        console.log(`  ✓ ${name}: in sync`);
        continue;
      }
      if (diff.toCreate.length > 0) {
        console.log(`  + ${name}: would create ${diff.toCreate.length} → ${JSON.stringify(diff.toCreate)}`);
      }
      if (diff.toDrop.length > 0) {
        console.log(`  - ${name}: would drop ${diff.toDrop.length} → ${JSON.stringify(diff.toDrop)}`);
      }
    }
    await mongoose.disconnect();
    console.log("\n✓ Dry run complete — no changes made.");
    process.exit(0);
  }

  console.log("→ Syncing indexes for all models…");
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    const dropped = await model.syncIndexes();
    if (dropped.length > 0) {
      console.log(`  ✓ ${name}: dropped ${dropped.length} stale → ${dropped.join(", ")}`);
    } else {
      console.log(`  ✓ ${name}: in sync`);
    }
  }

  await mongoose.disconnect();
  console.log("\n✓ Reindex complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
