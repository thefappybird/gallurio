/**
 * Verifies the inquiries-calendar overhaul:
 *  - Inquiry candles render an "Inquiry" status pill (not "Booked")
 *  - Filter chips: "Inquiry" (renamed from New), "Booked", "Conflicted"
 *  - A real booking renders a "Booked" candle
 *  - A past inquiry candle shows the "Past" pill and opens a READ-ONLY modal
 *    (no Archive/Decline/Convert actions)
 *  - Screenshots at 375 / 768 / 1280
 *
 * Read-only side-effect policy: opens the read-only modal but performs no
 * mutation. Seeded data (lib/db/seed.ts) provides today "inquiry" inquiries,
 * a today booking, and two fixed past "inquiry" inquiries (-7 / -14 days).
 */

import path from "node:path";
import { test, expect } from "@playwright/test";

const SHOT_DIR = path.resolve(
  process.env.PLAYWRIGHT_SCREENSHOT_DIR ?? "test-results/inquiries-calendar",
);

const BREAKPOINTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

test.describe("Inquiries calendar", () => {
  test("Inquiry pill, filters, Booked candle, past read-only; 3 breakpoints", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/inquiries?view=calendar");

    // Avoid networkidle (the notifications socket keeps the connection open).
    await page.locator(".rbc-calendar").waitFor({ timeout: 60_000 });
    const inquiryChip = page.getByRole("button", { name: "Inquiry", exact: true });
    await inquiryChip.waitFor({ state: "visible", timeout: 30_000 });

    // 1. Filter chips renamed/present.
    await expect(inquiryChip).toBeVisible();
    await expect(page.getByRole("button", { name: "Booked", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Conflicted", exact: true })).toBeVisible();

    // Candles mount a tick after the toolbar — wait for the first one (auto-retry)
    // before counting (`.count()` is a one-shot with no auto-wait).
    const inquiryCandles = page.locator('[aria-label*="Inquiry"]');
    await expect(inquiryCandles.first()).toBeVisible({ timeout: 30_000 });

    // 2. >=1 inquiry candle shows the "Inquiry" pill (aria-label "<title> · Inquiry").
    expect(await inquiryCandles.count(), "expected >=1 Inquiry candle").toBeGreaterThan(0);

    // 3. A booking candle shows "Booked".
    const bookedCandles = page.locator('[aria-label*="Booked"]');
    await expect(bookedCandles.first()).toBeVisible({ timeout: 15_000 });
    expect(await bookedCandles.count(), "expected >=1 Booked candle").toBeGreaterThan(0);

    // 4. A past candle shows the "Past" pill.
    const pastPills = page.locator('[aria-label="Past"]');
    await expect(pastPills.first()).toBeVisible({ timeout: 15_000 });
    expect(await pastPills.count(), "expected >=1 Past pill").toBeGreaterThan(0);

    await page.screenshot({ path: path.join(SHOT_DIR, "desktop-1280-calendar.png") });

    // 5. Click a PAST INQUIRY candle -> read-only modal (no actions). The candle
    //    span carries aria-label "…· Inquiry" and contains the "Past" pill.
    const pastInquiryEvent = page
      .locator('[aria-label*="Inquiry"]')
      .filter({ has: page.locator('[aria-label="Past"]') })
      .first();
    await pastInquiryEvent.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(
      dialog.getByRole("button", { name: "Archive" }),
      "read-only modal must hide Archive",
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: /Decline/ }),
      "read-only modal must hide Decline",
    ).toHaveCount(0);
    await page.screenshot({ path: path.join(SHOT_DIR, "desktop-1280-readonly-modal.png") });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // 6. Breakpoint screenshots.
    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(500);
      await expect(inquiryChip).toBeVisible();
      await page.screenshot({ path: path.join(SHOT_DIR, `${bp.name}-calendar.png`) });
    }
  });
});
