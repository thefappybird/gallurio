import path from "node:path";
import { test, expect, request as pwRequest, type Page } from "@playwright/test";

/**
 * Batched verification for the import review fixes. One signed-in session
 * walks the import lifecycle; the only write is one 5-row background import
 * of QA-IMP fixtures (remove with qa/bookings-import/cleanup-import-qa.js).
 */

const SHEET = '[data-slot="sheet-content"]';
const SHOTS = path.join(__dirname, ".artifacts", "import-review-fixes");
const MESSY_CSV = path.join(__dirname, "fixtures", "bookings-messy.csv");
const HAPPY_CSV = path.join(__dirname, "..", "qa", "bookings-import", "files", "01-happy-template.csv");
const BOGUS_JOB = "0123456789abcdef01234567";

const toasts = (page: Page) => page.locator("[data-sonner-toast]");

async function walkToPreview(page: Page) {
  for (let hop = 0; hop < 3; hop++) {
    const cont = page.locator(SHEET).getByRole("button", { name: "Continue" });
    if (!(await cont.isVisible().catch(() => false))) break;
    await expect(cont).toBeEnabled();
    await cont.click();
  }
}

test("signed-out API calls get JSON 401; recovery route needs its bearer; 404 has a title", async ({ page }) => {
  const anon = await pwRequest.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    storageState: { cookies: [], origins: [] },
  });
  const status = await anon.get("/api/bookings/import?latest", { maxRedirects: 0 });
  expect(status.status()).toBe(401);
  expect(await status.json()).toMatchObject({ error: "not_authenticated" });
  const sweep = await anon.get("/api/cron/import-recovery", { maxRedirects: 0 });
  expect(sweep.status()).toBe(401);
  await anon.dispose();

  await page.goto("/qa-review-nope/deeper");
  await expect(page).toHaveTitle(/not found/i);
});

test("import lifecycle: mapping a11y, background job, unread, reopen, replay, stale links", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const statusGets: number[] = [];
  page.on("request", (r) => {
    if (r.method() === "GET" && r.url().includes("/api/bookings/import?jobId=")) statusGets.push(Date.now());
  });

  await page.goto("/bookings");
  const importButton = page.getByRole("button", { name: /^Import/ }).first();
  await importButton.click();
  const sheet = page.locator(SHEET);
  await expect(sheet).toBeVisible();

  // L11: swap control exposes its state and shows its hint without hover.
  await sheet.locator('input[type="file"]').setInputFiles(MESSY_CSV);
  await expect(page.getByText("Match your columns to ours")).toBeVisible();
  const swap = sheet.getByRole("button", { name: "Swap day and month" });
  const pressedBefore = await swap.getAttribute("aria-pressed");
  expect(pressedBefore === "true" || pressedBefore === "false").toBe(true);
  const hintId = await swap.getAttribute("aria-describedby");
  expect(hintId).toBeTruthy();
  await expect(page.locator(`[id="${hintId}"]`)).toBeVisible();
  await swap.click();
  await expect(swap).toHaveAttribute("aria-pressed", pressedBefore === "true" ? "false" : "true");

  // L12: removing a combined slot moves focus to the previous picker, not <body>.
  const card = sheet.locator("div.bg-card", { has: page.locator("#map-locationAddress") });
  await card.getByRole("button", { name: "Combine with another column" }).click();
  await expect(card.locator('[data-slot="select-trigger"]')).toHaveCount(2);
  await card.getByRole("button", { name: "Remove this column" }).click();
  await expect(card.locator('[data-slot="select-trigger"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("map-locationAddress");
  await page.screenshot({ path: path.join(SHOTS, "1-mapping.png") });

  // Reset to a fresh upload for the real import.
  await page.keyboard.press("Escape");
  const discard = page.getByRole("button", { name: /discard/i });
  if (await discard.isVisible().catch(() => false)) await discard.click();
  await expect(sheet).toBeHidden();

  // Background import of 5 QA rows; watch the poll rate while it runs.
  await importButton.click();
  await sheet.locator('input[type="file"]').setInputFiles(HAPPY_CSV);
  await walkToPreview(page);
  const commit = sheet.getByRole("button", { name: /^Import \d+/ });
  await expect(commit).toBeVisible();
  const startedAt = Date.now();
  const postP = page.waitForResponse((r) => r.url().includes("/api/bookings/import") && r.request().method() === "POST");
  await commit.click();
  const post = await postP;
  expect(post.status(), "import started as a background job").toBe(202);
  const { jobId } = (await post.json()) as { jobId: string };
  console.log(`jobId ${jobId}`);
  await expect(page.getByText(/imported successfully/i).first()).toBeVisible({ timeout: 120_000 });
  const elapsedS = (Date.now() - startedAt) / 1000;
  await expect(sheet).toBeHidden(); // watched-live clean success auto-closes
  console.log(`job ${elapsedS.toFixed(1)}s, status GETs ${statusGets.length}`);
  // #2: one GET per 5 s poll plus the initial one, not one per progress event.
  expect(statusGets.length).toBeLessThanOrEqual(Math.ceil(elapsedS / 5) + 2);
  await page.screenshot({ path: path.join(SHOTS, "2-imported.png") });

  // #9: the owner watched it finish, so the result notification is marked read.
  await page.waitForTimeout(8_000);
  await expect(importButton).not.toHaveAttribute("data-import-unread", "true");

  // #8: reopening Import starts a fresh upload instead of replaying and closing.
  const toastsBefore = await toasts(page).count();
  await importButton.click();
  await page.waitForTimeout(3_000);
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('input[type="file"]')).toHaveCount(1);
  expect(await toasts(page).count()).toBeLessThanOrEqual(toastsBefore);
  await page.screenshot({ path: path.join(SHOTS, "3-reopen.png") });
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // #10: a deep link to the finished job replays quietly (no new toast).
  await page.goto(`/bookings?importJob=${jobId}`);
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("status").filter({ hasText: /imported successfully/i })).toBeVisible();
  await page.waitForTimeout(2_000);
  await expect(toasts(page)).toHaveCount(0);
  await page.screenshot({ path: path.join(SHOTS, "4-replay.png") });

  // #11: an expired/unknown job link is "no longer available", not a failure.
  await page.goto(`/bookings?importJob=${BOGUS_JOB}`);
  await expect(page.getByText("This import result is no longer available.")).toBeVisible();
  await expect(page.getByText("Import failed. Please try again.")).toHaveCount(0);
  await page.goto(`/ar/bookings?importJob=${BOGUS_JOB}`);
  await expect(page.getByText("نتيجة هذا الاستيراد لم تعد متاحة.")).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, "5-unavailable-ar.png") });
});
