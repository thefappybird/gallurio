import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { connectDB } from "@/lib/db/mongoose";
import { closeBetaProgram } from "@/lib/billing/betaProgram";
import { assertSafeTarget, parseDbTarget, printDbFingerprint } from "@/lib/db/scriptGuard";

async function main() {
  const operator = process.argv.slice(2).find((arg) => arg.startsWith("--operator="))?.slice("--operator=".length);
  if (!operator) throw new Error("Usage: pnpm beta:close -- --operator=<operator> --allow-dev --confirm-close");
  if (!process.argv.includes("--confirm-close")) throw new Error("Refusing to close beta without --confirm-close.");

  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("Missing DATABASE_URL.");
  printDbFingerprint(uri);
  if (parseDbTarget(uri).dbName === "(default)") throw new Error("Refusing a URI without an explicit database name.");
  assertSafeTarget(uri);

  await connectDB();
  try {
    const result = await closeBetaProgram(operator);
    console.log(result.alreadyClosed ? "-> Beta was already closed." : "-> Beta closed; active beta workspaces were processed.");
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
