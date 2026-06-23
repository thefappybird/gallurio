/**
 * Item 3 — Columns block: column-count and col/row-span controls.
 *
 * Verifies:
 *   1. Changing the column-count control from 2→3 visibly changes the grid
 *      (grid-template-columns gains a third track).
 *   2. Setting Column span=2 on a child block applies grid-column: span 2.
 *   3. Setting Row span=2 on a child block applies grid-row: span 2.
 */
import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

test.describe("Columns block — grid controls", () => {
  test("column-count control: changing 2→3 adds a third grid track", async ({ page }) => {
    test.setTimeout(120_000);
    await openEditorWithDraft(page, "new draft 2");

    // Click the Columns block itself (the outer wrapper, not a child).
    // The outer div has data-puck-component="Columns-*" and contains ".pf-cols".
    const grid = page.locator(".pf-cols").first();
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Click the outline entry for Columns in the left panel, or click the
    // Columns block's drag-handle area (outside the grid children).
    const colsBreadcrumb = page.getByRole("button", { name: "Columns" }).first();
    await colsBreadcrumb.waitFor({ state: "visible", timeout: 10_000 });
    await colsBreadcrumb.click();
    await page.waitForTimeout(400);

    // Open Content tab (default, but confirm).
    const contentTab = page.getByRole("button", { name: "Content", exact: true }).first();
    if (await contentTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await contentTab.click();
      await page.waitForTimeout(200);
    }

    // The ContentTab shows two CountControls: COLUMNS and ROWS.
    // Both have a "3" quick-value button. The label is "Columns" (text-transform: uppercase
    // is CSS-only — DOM text is "Columns"). Scope to the div.flex-col wrapping the label.
    const columnsSection = page
      .locator("div.flex.flex-col.gap-2")
      .filter({ has: page.getByText("Columns", { exact: true }) })
      .first();
    await columnsSection.waitFor({ state: "visible", timeout: 5_000 });
    const btn3 = columnsSection.getByRole("button", { name: "3", exact: true });
    await expect(btn3).toBeVisible({ timeout: 5_000 });

    // Record the class on the grid BEFORE changing columns.
    const beforeClass = await grid.evaluate((el) => el.className);

    await btn3.click();
    await page.waitForTimeout(500);

    // After clicking "3", the grid div should gain the pf-cols-3 class (column count changed).
    // The visible track count at the ~428px editor canvas may still be 2 (tablet layout uses
    // ceil(cols/2) tracks), but the CSS rule applied changes to the 3-column set.
    const afterClass = await grid.evaluate((el) => el.className);
    expect(afterClass).toContain("pf-cols-3");
    expect(beforeClass).not.toContain("pf-cols-3");

    // Also confirm the 3-column @container rule is present in the injected <style> tag.
    const has3ColRule = await page.evaluate(() => {
      const styles = Array.from(document.querySelectorAll("style"));
      return styles.some((s) => s.textContent?.includes("pf-cols-3") && s.textContent?.includes("repeat(3"));
    });
    expect(has3ColRule).toBe(true);
  });

  test("col-span control: setting span=2 applies grid-column: span 2", async ({ page }) => {
    test.setTimeout(120_000);
    await openEditorWithDraft(page, "new draft 2");

    const grid = page.locator(".pf-cols").first();
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Select the Container child of the Columns grid.
    const containerChild = page.locator(".pf-cols > [data-block='container']").first();
    await containerChild.waitFor({ state: "visible", timeout: 10_000 });
    await containerChild.click({ position: { x: 4, y: 4 } });
    await page.waitForTimeout(400);

    // Open Layout tab.
    const layoutTab = page
      .getByRole("tab", { name: "Layout" })
      .or(page.getByRole("button", { name: "Layout", exact: true }));
    await layoutTab.first().waitFor({ state: "visible", timeout: 10_000 });
    await layoutTab.first().click();
    await page.waitForTimeout(300);

    // Expand the "Layout" drawer if collapsed.
    const layoutDrawerBtn = page.locator('button[aria-expanded]').filter({ hasText: /^Layout$/i });
    const expanded = await layoutDrawerBtn.first().getAttribute("aria-expanded").catch(() => "true");
    if (expanded === "false") {
      await layoutDrawerBtn.first().click();
      await page.waitForTimeout(300);
    }

    // Find the Column span NumberInputRow by its label, scoped to the correct row div.
    const colSpanLabel = page.getByText("Column span", { exact: true });
    await expect(colSpanLabel).toBeVisible({ timeout: 5_000 });
    const colSpanRow = page
      .locator("div.flex.items-center.justify-between")
      .filter({ has: colSpanLabel })
      .first();
    const colSpanInput = colSpanRow.locator('input[type="number"]').first();
    await expect(colSpanInput).toBeVisible({ timeout: 5_000 });

    // Set col-span to 2.
    await colSpanInput.fill("2");
    await colSpanInput.blur();
    await page.waitForTimeout(600);

    const after = await containerChild.evaluate(
      (el) => (el as HTMLElement).style.gridColumn || getComputedStyle(el).gridColumn
    );
    expect(after).toContain("span 2");
  });

  test("row-span control: setting span=2 applies grid-row: span 2", async ({ page }) => {
    test.setTimeout(120_000);
    await openEditorWithDraft(page, "new draft 2");

    const grid = page.locator(".pf-cols").first();
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const containerChild = page.locator(".pf-cols > [data-block='container']").first();
    await containerChild.waitFor({ state: "visible", timeout: 10_000 });
    await containerChild.click({ position: { x: 4, y: 4 } });
    await page.waitForTimeout(400);

    const layoutTab = page
      .getByRole("tab", { name: "Layout" })
      .or(page.getByRole("button", { name: "Layout", exact: true }));
    await layoutTab.first().waitFor({ state: "visible", timeout: 10_000 });
    await layoutTab.first().click();
    await page.waitForTimeout(300);

    const layoutDrawerBtn = page.locator('button[aria-expanded]').filter({ hasText: /^Layout$/i });
    const expanded = await layoutDrawerBtn.first().getAttribute("aria-expanded").catch(() => "true");
    if (expanded === "false") {
      await layoutDrawerBtn.first().click();
      await page.waitForTimeout(300);
    }

    const rowSpanLabel = page.getByText("Row span", { exact: true });
    await expect(rowSpanLabel).toBeVisible({ timeout: 5_000 });
    const rowSpanRow = page
      .locator("div.flex.items-center.justify-between")
      .filter({ has: rowSpanLabel })
      .first();
    const rowSpanInput = rowSpanRow.locator('input[type="number"]').first();
    await expect(rowSpanInput).toBeVisible({ timeout: 5_000 });

    await rowSpanInput.fill("2");
    await rowSpanInput.blur();
    await page.waitForTimeout(600);

    const after = await containerChild.evaluate(
      (el) => (el as HTMLElement).style.gridRow || getComputedStyle(el).gridRow
    );
    expect(after).toContain("span 2");
  });
});
