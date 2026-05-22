/**
 * Drops stale indexes and rebuilds the ones declared in current schemas.
 *
 * Usage:  pnpm reindex
 *
 * Mongoose only *adds* indexes that match the schema — it never drops indexes
 * that no longer match. So when you change a unique constraint or remove an
 * index from a schema, the old one lingers in MongoDB and causes confusing
 * E11000 duplicate key errors. This script fixes that without losing any data.
 *
 * Safe to run repeatedly. NEVER add destructive data ops here — that's `pnpm seed`.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { connectDB } from "./mongoose";
// Importing the barrel registers every model on the default connection so
// syncIndexes can iterate all of them.
import "./models";

async function main() {
  console.log("→ Connecting to MongoDB…");
  await connectDB();

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
