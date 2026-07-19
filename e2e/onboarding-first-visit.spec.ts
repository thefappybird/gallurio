import { test, expect } from "@playwright/test";

// This spec drives a genuinely fresh WorkOS user (no Mongo User/Workspace doc
// yet — SEED_EMPTY_* is never touched by `pnpm seed`) through onboarding and
// the portfolio editor's first-visit story prompt. It intentionally does NOT
// use the `chromium` project's default owner.json storageState — this account
// must start unauthenticated so it goes through the real sign-in + JIT
// provisioning + onboarding flow, exactly like a brand-new signup.
//
// One-shot: once onboarding completes this account becomes a normal
// workspace, so this spec's full walkthrough should only be run once per
// fresh DB state, not repeated against the same account.
test.use({ storageState: { cookies: [], origins: [] } });

test("first-time owner: onboarding wizard, then story prompt skips the guide", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 812 });

  const email = process.env.SEED_EMPTY_EMAIL;
  const password = process.env.SEED_EMPTY_PASSWORD;
  expect(email, "SEED_EMPTY_EMAIL must be set in .env.local").toBeTruthy();
  expect(password, "SEED_EMPTY_PASSWORD must be set in .env.local").toBeTruthy();

  // --- Sign in (real form, Turnstile bypassed in dev) ---
  await page.goto("/sign-in");
  await page.locator("#signin-email").fill(email!);
  await page.locator("#signin-password").fill(password!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => /\/onboarding/.test(url.pathname), { timeout: 90_000 });

  // --- Onboarding: business step ---
  await expect(page.getByRole("heading", { name: "Tell us about your business" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("First name").fill("Mae");
  await page.getByLabel("Business name").fill(`Mae Test Studio ${Date.now()}`);
  // Icon-grid business-type picker (redesigned this session) — pick Venue.
  await page.getByRole("button", { name: "Venue" }).click();
  const businessContinue = page.getByRole("button", { name: "Continue" });
  await expect(businessContinue).toBeEnabled({ timeout: 10_000 });
  await businessContinue.click();

  // --- Onboarding: workspace step (URL slug, country, timezone, 12h/24h) ---
  await page.waitForURL(/\/onboarding\/workspace/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Set up your workspace" })).toBeVisible({
    timeout: 30_000,
  });
  // The workspace URL (slug) moved here — auto-generated from the business
  // name on the previous step; leave it (and country/timezone/time-format)
  // at their pre-filled defaults.
  await expect(page.getByText("Your page will live at")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // --- Onboarding: plan step (Free + Pro cards, monthly/yearly toggle) ---
  await page.waitForURL(/\/onboarding\/plan/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Pick the plan that fits" })).toBeVisible();
  await page.getByRole("button", { name: "Start my free month" }).click();

  // --- Onboarding: done step ---
  await page.waitForURL(/\/onboarding\/done/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /You're all set/ })).toBeVisible();
  await page.getByRole("button", { name: "Go to your dashboard" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  // --- Portfolio: first visit fires the story prompt, not the Guide ---
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "Let's tell your story" })).toBeVisible({
    timeout: 30_000,
  });

  // Step 1: Welcome
  await page.getByRole("button", { name: "Let's go" }).click();

  // Step 2: Tell your story — live SERP preview updates from the textarea.
  await expect(page.getByRole("heading", { name: "Tell your story", exact: true })).toBeVisible();
  await page
    .getByPlaceholder("A short line about who you are and what you do…")
    .fill("We host garden weddings and intimate celebrations.");
  await expect(page.getByText(/gallurio\.com.*w.*Mae Test Studio/)).toBeVisible();
  await page.waitForTimeout(400); // let the step's exit animation finish before the next "Continue" query
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: Your vibe — suggested tags are seeded from the "venue" business
  // type chosen above (proves workspaceBusinessType flows through end-to-end).
  await expect(page.getByRole("heading", { name: "Your vibe" })).toBeVisible();
  await page.getByRole("button", { name: "Garden", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4: Add your branding — logo/icon uploads are optional; skip both.
  await expect(page.getByRole("heading", { name: /add your branding/i })).toBeVisible();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 5: Done — two exits. Take "I'll explore myself", the more complex
  // branch: it must skip the Guide entirely (dismissPortfolioGuideAction) and
  // jump straight to an entry dialog.
  await expect(page.getByRole("heading", { name: "Your page is ready to shine" })).toBeVisible();
  await page.getByRole("button", { name: "I'll explore myself" }).click();

  // The Guide never mounts — the first-visit seed + legacy-draft migration
  // gives this workspace exactly one draft, so PortfolioEntryDialog ("Welcome
  // back") appears directly, not the empty-drafts TemplatePickerDialog.
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible({ timeout: 15_000 });
});
