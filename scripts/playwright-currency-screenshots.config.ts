/**
 * Playwright config for the currency/FX screenshot harness only.
 *
 * Kept out of e2e/ so it never runs as part of the normal suite: it asserts
 * nothing, it only drives the surfaces this branch touched and writes JPEGs
 * into e2e/__screenshots__/currency/ for human review.
 *
 * Requires a running dev server (`pnpm dev`) and a prior `pnpm exec playwright
 * test e2e/auth.setup.ts` so e2e/.auth/owner.json exists.
 *
 * Usage:
 *   pnpm exec playwright test scripts/screenshot-currency.spec.ts \
 *     --config scripts/playwright-currency-screenshots.config.ts
 */

import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

export default defineConfig({
  testDir: "./",
  testMatch: /screenshot-currency\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 0, // one long capture run, not a per-assertion test
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "off",
    screenshot: "off", // captured explicitly in the spec
    locale: "en-US",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Intentionally no webServer block — point it at an already-running dev server.
});
