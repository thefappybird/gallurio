/**
 * Item 4 — block controls surface their defaultProps as pre-filled, editable values.
 *
 * Live spot-check (the unit tests in fillBlockDefaults.test.ts + manualBlocks.test.tsx
 * cover the merge logic and render parity): open an existing saved draft and confirm
 * the Columns block's Gap control shows the surfaced default (16px) rather than blank.
 * "new draft 2" is seeded with every block and no per-block gap edit, so load-time
 * normalization fills _style.gap = 16 from columnsDefaultProps.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

const DRAFT_NAME = "new draft 2";

async function readColumnsGap(page: Page): Promise<string> {
  await openEditorWithDraft(page, DRAFT_NAME);

  await page.getByRole("button", { name: "Columns" }).first().click();
  // Switch to the Layout tab (the tab button has no aria-expanded).
  await page.getByRole("button", { name: "Layout", exact: true }).first().click();

  // Expand the collapsed "Layout" drawer SECTION (a button[aria-expanded]).
  const layoutSection = page
    .locator("button[aria-expanded]")
    .filter({ hasText: "Layout" })
    .first();
  if ((await layoutSection.getAttribute("aria-expanded")) === "false") {
    await layoutSection.click();
  }

  // Gap is a NumberInputRow: a justify-between row holding span "Gap" + number input.
  const gapInput = page
    .locator("div.justify-between")
    .filter({ hasText: /^Gap/ })
    .locator("input[type=number]")
    .first();
  await gapInput.waitFor({ state: "visible", timeout: 5_000 });
  return gapInput.inputValue();
}

test.describe("Item 4 — controls pre-filled with surfaced defaults", () => {
  test("desktop 1280px: Columns Gap shows the default 16", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await readColumnsGap(page)).toBe("16");
  });

  test("tablet 768px: Columns Gap shows the default 16", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 768, height: 1024 });
    expect(await readColumnsGap(page)).toBe("16");
  });
});
