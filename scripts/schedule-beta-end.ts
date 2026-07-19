import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { connectDB } from "@/lib/db/mongoose";
import { scheduleBetaProgramEnd } from "@/lib/billing/betaProgram";
import { assertSafeTarget, parseDbTarget, printDbFingerprint } from "@/lib/db/scriptGuard";

function valueFor(argv: string[], flag: string) {
  return argv.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);
}

async function main() {
  const argv = process.argv.slice(2);
  const endsAt = valueFor(argv, "--ends-at");
  const operator = valueFor(argv, "--operator");
  if (!endsAt || !operator) throw new Error("Usage: pnpm beta:schedule-end -- --ends-at=<ISO date> --operator=<operator> --allow-dev");
  const scheduledEndAt = new Date(endsAt);
  if (Number.isNaN(scheduledEndAt.getTime())) throw new Error("Invalid --ends-at ISO date.");

  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("Missing DATABASE_URL.");
  printDbFingerprint(uri);
  if (parseDbTarget(uri).dbName === "(default)") throw new Error("Refusing a URI without an explicit database name.");
  assertSafeTarget(uri);

  await connectDB();
  try {
    await scheduleBetaProgramEnd(scheduledEndAt, operator);
    console.log(`-> Beta end warning will start seven days before ${scheduledEndAt.toISOString()}.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
