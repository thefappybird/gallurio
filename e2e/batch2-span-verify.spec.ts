import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

// #21 verification — column span applies to a Container card inside a Columns grid.
// The Services preset in "new draft 2" renders Container cards as direct children
// of a `.pf-cols` grid. With inline:true + dragRef forwarding, the Container's own
// <section> becomes the grid item, so setting Column span must write
// `grid-column: span N` onto that <section>.
test("#21 column span applies to a Container grid child", async ({ page }) => {
  test.setTimeout(120_000);
  await openEditorWithDraft(page, "new draft 2");

  // First Columns grid whose direct children are Container sections.
  const card = page
    .locator('[data-puck-preview] .pf-cols > [data-block="container"]')
    .first();
  await expect(card).toBeVisible({ timeout: 15_000 });

  // Select the Container itself (click its padding edge, not the inner text).
  await card.click({ position: { x: 4, y: 4 } });

  // Open the Layout tab and reveal the grid-child controls.
  const layoutTab = page
    .getByRole("tab", { name: "Layout" })
    .or(page.getByRole("button", { name: "Layout", exact: true }));
  await layoutTab.first().click();

  // The "Column span" row only renders for grid children — confirms isGridChild.
  const colSpanLabel = page.getByText("Column span", { exact: true });
  await expect(colSpanLabel).toBeVisible({ timeout: 10_000 });

  // The NumberInputRow pairs the label with a number input in the same row.
  const colSpanInput = page
    .locator("div")
    .filter({ has: colSpanLabel })
    .locator('input[type="number"]')
    .last();
  await colSpanInput.fill("2");
  await colSpanInput.blur();

  // The selected Container <section> should now carry grid-column: span 2.
  await expect
    .poll(
      async () =>
        card.evaluate(
          (el) =>
            (el as HTMLElement).style.gridColumn ||
            getComputedStyle(el).gridColumn,
        ),
      { timeout: 10_000 },
    )
    .toContain("span 2");
});
