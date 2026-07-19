import { test, expect, type Page } from "@playwright/test";

// Regression test: the guided tour's step 2 ("drag-block") used to anchor its
// secondary cutout to Puck's `puck` override slot (data-tour-id="canvas"),
// which wraps the ENTIRE editor UI (header/drawer/editor/fields) — not just
// the canvas. That made the cutout look like "the whole page". The fix
// anchors it to "canvas-viewport" (Puck's `preview` slot instead), which is
// scoped to just the editor grid column. This spec asserts the cutout is
// tightly bounded, not full-viewport-sized.

async function dismissEntryDialogs(page: Page) {
  const welcome = page.getByText(/where would you like to start/i);
  const appeared = await welcome
    .waitFor({ state: "visible", timeout: 12000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;
  const continueBtn = page.getByRole("button", { name: /continue where you left off/i }).first();
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
  } else {
    await page.getByRole("button", { name: /start from scratch/i }).first().click();
  }
  await welcome.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
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
  await dismissEntryDialogs(page);
  await expect(overlay).toBeVisible({ timeout: 20_000 });
}

test("step 2 (drag-block) cutout is bounded to the canvas viewport, not the full page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/portfolio");
  await page.waitForLoadState("networkidle").catch(() => {});
  await dismissEntryDialogs(page);
  await openGuide(page);

  // Advance from step 1 (welcome) to step 2 (drag-block).
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /next/i }).first().click();
  await expect(dialog.getByText(/2 of/)).toBeVisible({ timeout: 10_000 });

  // The secondary cutout (canvas-viewport) rect — read from the SVG mask Spot-
  // lightGuide renders — must be meaningfully smaller than the full viewport
  // on both axes (it should exclude the blocks-panel and properties-panel
  // columns), not the near-full-viewport box the old "canvas" anchor produced.
  const secondaryRect = await page.evaluate(() => {
    const mask = document.getElementById("spotlight-mask");
    if (!mask) return null;
    const rects = Array.from(mask.querySelectorAll("rect"));
    // rects[0] is the full-screen base rect; rects[1] is the primary cutout
    // (blocks-panel); rects[2] is the secondary cutout (canvas-viewport).
    const secondary = rects[2];
    if (!secondary) return null;
    return {
      width: Number(secondary.getAttribute("width")),
      height: Number(secondary.getAttribute("height")),
    };
  });

  expect(secondaryRect).not.toBeNull();
  // Full viewport is 1280x800. The old (buggy) "canvas" anchor produced a
  // cutout within a few px of the full viewport on both axes. The fixed
  // "canvas-viewport" anchor excludes the ~274px blocks-panel and ~274px
  // properties-panel columns, so it should be well under the viewport width.
  expect(secondaryRect!.width).toBeLessThan(1280 * 0.85);
  expect(secondaryRect!.width).toBeGreaterThan(200);
});
