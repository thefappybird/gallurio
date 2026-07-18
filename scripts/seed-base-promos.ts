/**
 * Operator CLI: create the four standard Gallurio promo codes.
 *
 * Usage:
 *   pnpm promo:seed-base -- --allow-dev
 *   pnpm promo:seed-base -- --i-understand-production
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { connectDB } from "@/lib/db/mongoose";
import { PromoCode } from "@/lib/db/models";
import { PROMO_CODE_SEEDS } from "@/lib/db/seed-fixtures";
import { assertSafeTarget, parseDbTarget, printDbFingerprint } from "@/lib/db/scriptGuard";

export type BasePromoSeedResult = { created: number; existing: number };

/** Creates missing base promos without changing existing promo records. */
export async function seedBasePromos(opts: { dryRun?: boolean } = {}): Promise<BasePromoSeedResult> {
  let created = 0;
  let existing = 0;

  for (const promo of PROMO_CODE_SEEDS) {
    const match = await PromoCode.findOne({ code: promo.code }).lean();
    if (match) {
      existing += 1;
      continue;
    }
    if (!opts.dryRun) await PromoCode.create(promo);
    created += 1;
  }

  return { created, existing };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("Missing DATABASE_URL.");
  printDbFingerprint(uri);
  if (parseDbTarget(uri).dbName === "(default)") {
    throw new Error("Refusing a URI without an explicit database name.");
  }
  assertSafeTarget(uri, { dryRun });

  await connectDB();
  try {
    const result = await seedBasePromos({ dryRun });
    console.log(
      `-> Base promos ${dryRun ? "would create" : "created"}: ${result.created}; already present: ${result.existing}.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
