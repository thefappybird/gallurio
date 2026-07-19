import { test, expect, type Page } from "@playwright/test";

// Temporary verification spec for items 2/3/4 (guide sandbox + anchoring + footer).
// Captures screenshots for manual review and asserts structural invariants:
// main canvas renders, guide overlay mounts, tooltip never overflows horizontally.

const ART = "e2e/.artifacts";

async function dismissEntryDialogs(page: Page) {
  // Entry chooser (non-dismissible): pick "Start from scratch" (the only always-
  // enabled option) — scope to the VISIBLE dialog (a hidden template picker also
  // renders a "Start from scratch" button).
  // The entry dialog mounts AFTER hydration (later than networkidle), so wait for it.
  const welcome = page.getByText(/where would you like to start/i);
  const appeared = await welcome
    .waitFor({ state: "visible", timeout: 12000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return; // guide may have auto-opened instead
  await page.getByRole("button", { name: /start from scratch/i }).first().click();
  await welcome.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
  // The "Choose a template" picker opens next; it is dismissible — Escape to land
  // in the editor (don't apply a template — avoid mutating the owner's draft).
  const picker = page.getByText(/choose a template/i);
  if (await picker.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false)) {
    await page.keyboard.press("Escape");
    await picker.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
  }
  await page.waitForTimeout(500);
}

async function openGuide(page: Page) {
  const overlay = page.locator('[aria-label="Portfolio editor guide"]');
  if (!(await overlay.isVisible().catch(() => false))) {
    const guideBtn = page.getByRole("button", { name: "Guide", exact: true }).first();
    await expect(guideBtn).toBeVisible({ timeout: 20_000 });
    await guideBtn.click();
  }
  await expect(overlay).toBeVisible({ timeout: 20_000 });
}

async function stepAndShoot(page: Page, prefix: string, count: number, vw: number) {
  for (let i = 0; i < count; i++) {
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    const o = await dialog.evaluate((el) => ({ sx: el.scrollWidth, cx: el.clientWidth }));
    expect(o.sx, `horizontal overflow @${vw}: ${JSON.stringify(o)}`).toBeLessThanOrEqual(o.cx + 1);
    const box = await dialog.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(-2);
      expect(box.x + box.width).toBeLessThanOrEqual(vw + 2);
    }
    await page.screenshot({ path: `${ART}/${prefix}-step${i}.png` });
    const next = dialog.getByRole("button", { name: /next|finish/i }).first();
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click().catch(() => {});
    await page.waitForTimeout(450);
  }
}

test("guide sandbox: overlay mounts, tooltip fits at desktop + 375px", async ({ page }) => {
  // Desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/portfolio");
  await page.waitForLoadState("networkidle").catch(() => {});
  await dismissEntryDialogs(page);
  await openGuide(page);
  await stepAndShoot(page, "guide-desktop", 6, 1280);

  // Mobile 375px
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/portfolio");
  await page.waitForLoadState("networkidle").catch(() => {});
  await dismissEntryDialogs(page);
  await openGuide(page);
  await stepAndShoot(page, "guide-375", 4, 375);
});
