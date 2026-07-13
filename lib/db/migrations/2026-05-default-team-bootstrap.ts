/**
 * One-time migration: create a default "Main" team for every workspace
 * that doesn't already have one.
 *
 * Safe to re-run — ensureDefaultTeam is idempotent (upsert on isDefault=true).
 *
 * Usage:
 *   pnpm tsx lib/db/migrations/2026-05-default-team-bootstrap.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { connectDB } from "../mongoose";
import { assertSafeTarget, printDbFingerprint } from "../scriptGuard";
import { Workspace } from "../models/Workspace";
import { ensureDefaultTeam, Team } from "../models/team";

async function run() {
  console.log("→ Connecting to MongoDB…");
  await connectDB();

  const uri = process.env.DATABASE_URL!;
  printDbFingerprint(uri);
  assertSafeTarget(uri);

  const workspaces = await Workspace.find({}, { _id: 1, ownerUserId: 1 }).lean();
  console.log(`→ Found ${workspaces.length} workspace(s) to process`);

  let created = 0;
  let alreadyExisted = 0;

  for (const ws of workspaces) {
    const existingCount = await Team.countDocuments({ workspaceId: ws._id, isDefault: true });

    if (existingCount > 0) {
      alreadyExisted++;
      continue;
    }

    await ensureDefaultTeam(ws._id, ws.ownerUserId);
    created++;
  }

  console.log(
    `✓ Migration complete. Workspaces scanned: ${workspaces.length}, Teams created: ${created}, Already existing: ${alreadyExisted}`
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  mongoose.disconnect().finally(() => process.exit(1));
});
