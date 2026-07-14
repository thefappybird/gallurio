/**
 * Operator CLI: seed the production two-month beta-redemption promo code.
 *
 * Always creates `type: "beta2mo"` with `expiresAt: null` — per the approved
 * beta-close policy the promo is eligibility-gated (redeemer must have a
 * recorded betaParticipation), not date-gated, so it carries no ordinary
 * expiry.
 *
 * SECURITY: the actual code value (--code=) is never logged. Only the title
 * and a redacted DB fingerprint are printed.
 *
 * Usage:
 *   pnpm tsx scripts/seed-promo-code.ts --code=<code> --title=<title> [--dry-run]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { connectDB } from "@/lib/db/mongoose";
import { PromoCode } from "@/lib/db/models";
import { assertSafeTarget, printDbFingerprint } from "@/lib/db/scriptGuard";

export type ParsedArgs = {
  code?: string;
  title?: string;
  dryRun: boolean;
};

export function parseArgs(argv: string[]): ParsedArgs {
  let code: string | undefined;
  let title: string | undefined;
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith("--code=")) code = arg.slice("--code=".length);
    else if (arg.startsWith("--title=")) title = arg.slice("--title=".length);
    else if (arg === "--dry-run") dryRun = true;
  }
  return { code, title, dryRun };
}

export type SeedResult = { created: boolean; title: string };

/**
 * Create the beta2mo PromoCode if it doesn't already exist (idempotent by
 * unique, lowercased+trimmed `code`). Never logs `code`.
 */
export async function seedPromoCode(
  code: string,
  title: string,
  opts: { dryRun?: boolean } = {}
): Promise<SeedResult> {
  const normalizedCode = code.trim().toLowerCase();
  const existing = await PromoCode.findOne({ code: normalizedCode }).lean();
  if (existing) {
    return { created: false, title: existing.title };
  }

  if (opts.dryRun) {
    return { created: false, title };
  }

  await PromoCode.create({
    title,
    code: normalizedCode,
    expiresAt: null,
    revokedAt: null,
    type: "beta2mo",
  });
  return { created: true, title };
}

async function main() {
  const { code, title, dryRun } = parseArgs(process.argv.slice(2));
  if (!code || !title) {
    console.error(
      "Usage: pnpm tsx scripts/seed-promo-code.ts --code=<code> --title=<title> [--dry-run]"
    );
    process.exit(1);
  }

  console.log(`-> Seed promo code (${dryRun ? "DRY RUN" : "LIVE"})`);
  await connectDB();

  const uri = process.env.DATABASE_URL!;
  printDbFingerprint(uri);
  assertSafeTarget(uri, { dryRun });

  const result = await seedPromoCode(code, title, { dryRun });

  if (dryRun) {
    console.log(`  title="${result.title}" -> would ${result.created ? "create" : "no-op (already exists)"}`);
  } else if (result.created) {
    console.log(`  title="${result.title}" -> created`);
  } else {
    console.log(`  title="${result.title}" -> already exists (no-op)`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
