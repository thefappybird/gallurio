/**
 * Playwright config for the email screenshot harness only.
 *
 * - No webServer (screenshots are file:// — no running app needed).
 * - No auth setup (screenshots are static HTML).
 * - No baseURL dependency.
 *
 * Usage:
 *   pnpm exec playwright test scripts/screenshot-emails.spec.ts \
 *     --config scripts/playwright-screenshots.config.ts
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./",
  testMatch: /screenshot-emails\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    // No baseURL — all tests open file:// URLs directly.
    trace: "retain-on-failure",
    screenshot: "off", // We save screenshots manually in the spec.
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Intentionally no webServer block.
});
