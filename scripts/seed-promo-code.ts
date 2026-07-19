/**
 * Operator CLI: create one general promo code.
 *
 * SECURITY: the actual code value (--code=) is never logged. Only the title
 * and a redacted DB fingerprint are printed.
 *
 * Usage:
 *   pnpm seed:promo -- --code=<code> --title=<title> --type=<monthly|yearly|lifetime|beta|beta2mo> [--expires-at=<ISO date>] [--dry-run]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { connectDB } from "@/lib/db/mongoose";
import { PromoCode, PROMO_CODE_TYPES, type PromoCodeType } from "@/lib/db/models";
import { assertSafeTarget, parseDbTarget, printDbFingerprint } from "@/lib/db/scriptGuard";

export type ParsedArgs = {
  code?: string;
  title?: string;
  type?: PromoCodeType;
  expiresAt?: Date | null;
  dryRun: boolean;
};

export function parseArgs(argv: string[]): ParsedArgs {
  let code: string | undefined;
  let title: string | undefined;
  let type: PromoCodeType | undefined;
  let expiresAt: Date | null | undefined;
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith("--code=")) code = arg.slice("--code=".length);
    else if (arg.startsWith("--title=")) title = arg.slice("--title=".length);
    else if (arg.startsWith("--type=")) {
      const candidate = arg.slice("--type=".length) as PromoCodeType;
      if ((PROMO_CODE_TYPES as readonly string[]).includes(candidate)) type = candidate;
    } else if (arg.startsWith("--expires-at=")) {
      const value = arg.slice("--expires-at=".length);
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) expiresAt = parsed;
    }
    else if (arg === "--dry-run") dryRun = true;
  }
  return { code, title, type, expiresAt, dryRun };
}

export type SeedResult = { created: boolean; title: string };

/**
 * Create the beta2mo PromoCode if it doesn't already exist (idempotent by
 * unique, lowercased+trimmed `code`). Never logs `code`.
 */
export async function seedPromoCode(
  code: string,
  title: string,
  type: PromoCodeType,
  opts: { dryRun?: boolean; expiresAt?: Date | null } = {}
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
    expiresAt: opts.expiresAt ?? null,
    revokedAt: null,
    type,
  });
  return { created: true, title };
}

async function main() {
  const { code, title, type, expiresAt, dryRun } = parseArgs(process.argv.slice(2));
  if (!code || !title || !type) {
    console.error(
      "Usage: pnpm seed:promo -- --code=<code> --title=<title> --type=<monthly|yearly|lifetime|beta|beta2mo> [--expires-at=<ISO date>] [--dry-run]"
    );
    process.exit(1);
  }

  console.log(`-> Seed promo code (${dryRun ? "DRY RUN" : "LIVE"})`);
  const uri = process.env.DATABASE_URL!;
  printDbFingerprint(uri);

  if (parseDbTarget(uri).dbName === "(default)") {
    throw new Error(
      "Refusing to seed a URI without an explicit database name. Add the intended database to DATABASE_URL first."
    );
  }

  assertSafeTarget(uri, { dryRun });
  await connectDB();

  const result = await seedPromoCode(code, title, type, { dryRun, expiresAt });

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
