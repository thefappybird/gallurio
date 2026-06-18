import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const ownerFile = path.resolve(__dirname, ".auth/owner.json");

// Logs in as the seeded owner via the real sign-in form (Turnstile is bypassed
// in dev) and persists the session so the notification specs start authenticated
// without re-running the login flow.
setup("authenticate as owner", async ({ page }) => {
  setup.setTimeout(120_000);
  const email = process.env.SEED_OWNER_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD;
  expect(email, "SEED_OWNER_EMAIL must be set in .env.local").toBeTruthy();
  expect(password, "SEED_OWNER_PASSWORD must be set in .env.local").toBeTruthy();

  // localePrefix is "as-needed": the default English locale has NO /en/ prefix.
  await page.goto("/sign-in");
  await page.locator("#signin-email").fill(email!);
  await page.locator("#signin-password").fill(password!);
  await page.locator('button[type="submit"]').click();

  // Land inside the authenticated shell (owner -> /dashboard, or /onboarding if
  // not completed; staff -> /bookings). Generous timeout: the first post-login
  // route compiles cold under Turbopack on the dev server.
  await page.waitForURL(
    (url) => /\/(dashboard|bookings|onboarding|inquiries)\b/.test(url.pathname),
    { timeout: 90_000 },
  );

  await page.context().storageState({ path: ownerFile });
});
