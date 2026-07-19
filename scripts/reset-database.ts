/**
 * Reset a MongoDB database without seeding demo data.
 *
 * Usage:
 *   pnpm db:reset -- --allow-dev --confirm-reset
 *   pnpm db:reset -- --i-understand-production --confirm-reset
 *   pnpm db:reset -- --dry-run
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import "@/lib/db/models";
import { assertSafeTarget, parseDbTarget, printDbFingerprint } from "@/lib/db/scriptGuard";

export type ResetArgs = {
  dryRun: boolean;
  confirmed: boolean;
};

export function parseArgs(argv: string[]): ResetArgs {
  return {
    dryRun: argv.includes("--dry-run"),
    confirmed: argv.includes("--confirm-reset"),
  };
}

async function rebuildIndexes() {
  for (const name of mongoose.modelNames()) {
    await mongoose.model(name).syncIndexes();
  }
}

export async function resetDatabase(args: ResetArgs, uri: string): Promise<void> {
  const target = parseDbTarget(uri);
  printDbFingerprint(uri);

  if (target.dbName === "(default)") {
    throw new Error(
      "Refusing to reset a URI without an explicit database name. Add the intended database to DATABASE_URL first."
    );
  }

  assertSafeTarget(uri, { dryRun: args.dryRun });

  if (args.dryRun) {
    console.log("-> DRY RUN: database would be dropped and all indexes rebuilt.");
    return;
  }

  if (!args.confirmed) {
    throw new Error("Refusing to reset without --confirm-reset.");
  }

  await connectDB();
  if (!mongoose.connection.db) {
    throw new Error("MongoDB connection not ready");
  }

  console.log("-> Dropping database");
  await mongoose.connection.db.dropDatabase();
  console.log("-> Rebuilding indexes");
  await rebuildIndexes();
  console.log("Reset complete.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error("Missing DATABASE_URL.");
  }

  try {
    await resetDatabase(args, uri);
  } finally {
    await mongoose.disconnect();
  }
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
