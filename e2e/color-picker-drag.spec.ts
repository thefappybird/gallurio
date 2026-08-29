import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";
import { E2E_FIXTURE_DRAFT_NAME } from "../lib/db/seedE2eDraft";

/**
 * Verifies that the BrandKitPicker color popover does NOT close when the user
 * drags the react-colorful spectrum (the original drag-dismiss bug).
 *
 * Flow: open the theme panel → open a color swatch popover → drag inside the
 * spectrum → popover stays open → click outside → popover closes.
 */
// DRIFT: react-colorful is still used (BrandKitPicker.tsx), but this spec cannot
// reach the swatch popover any more — `.react-colorful__interactive` never appears,
// so the Theme panel path to a colour swatch changed. The drag behaviour it guards
// is still worth testing; the navigation steps need re-deriving.
test.fixme("brand-kit color picker: spectrum drag keeps popover open; click outside closes it", async ({
  page,
}) => {
  await openEditorWithDraft(page, E2E_FIXTURE_DRAFT_NAME);

  // Open the Theme panel via the toolbar button (data-tour-id="theme").
  const themeBtn = page.locator("[data-tour-id='theme']");
  await themeBtn.waitFor({ state: "visible", timeout: 15_000 });
  await themeBtn.click();

  // Wait for the ThemePanelDialog to open.
  const themeDialog = page.getByRole("dialog").filter({ hasText: /theme/i });
  await themeDialog.waitFor({ state: "visible", timeout: 15_000 });

  // The Colors section is below the Fonts section — scroll into view inside the dialog.
  const colorsHeading = themeDialog.getByText("Colors").first();
  await colorsHeading.scrollIntoViewIfNeeded();

  // Click the first color trigger (the primary color swatch row).
  const firstColorTrigger = themeDialog
    .locator("[data-slot='popover-trigger']")
    .first();
  await firstColorTrigger.waitFor({ state: "visible", timeout: 10_000 });
  await firstColorTrigger.click();

  // Wait for the popover to open — it contains the spectrum (.react-colorful).
  const spectrum = page.locator(".react-colorful__interactive").first();
  await spectrum.waitFor({ state: "visible", timeout: 10_000 });

  // --- Reproduce the drag: start inside the spectrum, drag outside the popup ---
  const spectrumBBox = await spectrum.boundingBox();
  expect(spectrumBBox, "spectrum bounding box should be found").not.toBeNull();

  const startX = spectrumBBox!.x + spectrumBBox!.width * 0.3;
  const startY = spectrumBBox!.y + spectrumBBox!.height * 0.3;

  // Drag from inside the spectrum to well outside the popup.
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 200, startY - 200, { steps: 10 });
  await page.mouse.up();

  // The popover must still be visible after the drag.
  await expect(spectrum).toBeVisible({ timeout: 3_000 });

  // Click somewhere clearly outside the popover to dismiss it.
  await page.mouse.click(10, 10);
  await expect(spectrum).toBeHidden({ timeout: 5_000 });
});
