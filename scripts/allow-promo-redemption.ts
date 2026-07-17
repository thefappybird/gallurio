/**
 * Support-only CLI: allow one workspace to redeem one previously-used promo
 * code again. The owner must still enter the code themselves afterwards.
 *
 * Usage:
 *   pnpm promo:allow-redemption -- --workspace-id=<id> --code=<code> --operator=<support-ticket-or-user> --reason=<reason> --allow-dev
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { ActivityLog, PromoCode, Workspace } from "@/lib/db/models";
import { assertSafeTarget, parseDbTarget, printDbFingerprint } from "@/lib/db/scriptGuard";

type Args = {
  workspaceId?: string;
  code?: string;
  operator?: string;
  reason?: string;
  dryRun: boolean;
};

export function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false };
  for (const arg of argv) {
    if (arg.startsWith("--workspace-id=")) args.workspaceId = arg.slice("--workspace-id=".length);
    else if (arg.startsWith("--code=")) args.code = arg.slice("--code=".length);
    else if (arg.startsWith("--operator=")) args.operator = arg.slice("--operator=".length);
    else if (arg.startsWith("--reason=")) args.reason = arg.slice("--reason=".length);
    else if (arg === "--dry-run") args.dryRun = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.workspaceId || !args.code || !args.operator || !args.reason) {
    throw new Error(
      "Usage: pnpm promo:allow-redemption -- --workspace-id=<id> --code=<code> --operator=<support-ticket-or-user> --reason=<reason> --allow-dev"
    );
  }
  if (!mongoose.isValidObjectId(args.workspaceId)) throw new Error("Invalid --workspace-id.");

  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("Missing DATABASE_URL.");
  printDbFingerprint(uri);
  if (parseDbTarget(uri).dbName === "(default)") {
    throw new Error("Refusing a URI without an explicit database name.");
  }
  assertSafeTarget(uri, { dryRun: args.dryRun });
  if (args.dryRun) {
    console.log("-> DRY RUN: would allow one additional redemption. Promo code is never logged.");
    return;
  }

  await connectDB();
  try {
    const promo = await PromoCode.findOne({ code: args.code.trim().toLowerCase() }).lean();
    if (!promo) throw new Error("Promo code not found.");

    const workspace = await Workspace.findOneAndUpdate(
      { _id: args.workspaceId, codesRedeemed: promo._id },
      { $pull: { codesRedeemed: promo._id } },
      { new: true }
    ).lean();
    if (!workspace) throw new Error("Workspace has not redeemed this promo code.");

    await ActivityLog.create({
      workspaceId: workspace._id,
      actorUserId: args.operator,
      entity: "workspace",
      entityId: workspace._id,
      action: "updated",
      meta: {
        kind: "promo_redemption_override",
        promoCodeId: promo._id,
        promoTitle: promo.title,
        reason: args.reason,
      },
    });
    console.log("-> One additional redemption is now allowed. The promo code itself was not logged.");
  } finally {
    await mongoose.disconnect();
  }
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
