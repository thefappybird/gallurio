/**
 * Item 3 — Columns block: column-count and col/row-span controls.
 *
 * Fixture: The "new draft 2" seeded draft must contain a Columns block with a
 * Container child (type="Container"). If the fixture changes and these no longer
 * exist, the tests fail with explicit assertion errors, not silent timeouts
 * (.waitFor / expect(locator) throws rather than timing out silently).
 *
 * Verifies:
 *   1. Changing the column-count control to 3 applies pf-cols-3 class AND shows
 *      3 real tracks in the editor (via isEditing inline override).
 *   2. Setting Column span=2 on a child block applies grid-column: span 2.
 *   3. Setting Row span=2 on a child block applies grid-row: span 2.
 *
 * The isEditing path (column-count editor preview) is covered by the unit test
 * "editor-mode (puck.isEditing=true): 2-col block gets inline grid-template-columns"
 * in manualBlocks.test.tsx.
 */
import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

test.describe("Columns block — grid controls", () => {
  test("column-count control: changing 2→3 updates class to pf-cols-3 and shows 3 tracks in editor", async ({ page }) => {
    test.setTimeout(120_000);
    await openEditorWithDraft(page, "new draft 2");

    // Fixture guard: the draft must have at least one .pf-cols element.
    const grid = page.locator(".pf-cols").first();
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Select the Columns block via its breadcrumb button in the left outline panel.
    const colsBreadcrumb = page.getByRole("button", { name: "Columns" }).first();
    await colsBreadcrumb.waitFor({ state: "visible", timeout: 10_000 });
    await colsBreadcrumb.click();
    await page.waitForTimeout(400);

    // Open Content tab.
    const contentTab = page.getByRole("button", { name: "Content", exact: true }).first();
    if (await contentTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await contentTab.click();
      await page.waitForTimeout(200);
    }

    // Scope to the COLUMNS CountControl (not the ROWS one — both have a "3" button).
    // The DOM label text is "Columns" (text-transform:uppercase is CSS-only).
    const columnsSection = page
      .locator("div.flex.flex-col.gap-2")
      .filter({ has: page.getByText("Columns", { exact: true }) })
      .first();
    await expect(columnsSection).toBeVisible({ timeout: 5_000 });
    const btn3 = columnsSection.getByRole("button", { name: "3", exact: true });
    await expect(btn3).toBeVisible({ timeout: 5_000 });

    const beforeClass = await grid.evaluate((el) => el.className);
    expect(beforeClass).not.toContain("pf-cols-3"); // starts at 2

    await btn3.click();
    await page.waitForTimeout(500);

    // Class updated.
    const afterClass = await grid.evaluate((el) => el.className);
    expect(afterClass).toContain("pf-cols-3");

    // The editor injects inline gridTemplateColumns via puck.isEditing, so the
    // canvas shows 3 real tracks even though the canvas is only ~428px wide.
    const trackCols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    const trackCount = trackCols.trim().split(/\s+/).length;
    expect(trackCount).toBe(3);

    // The @container rule for full columns is present in the injected <style> tag
    // (used on the public page when the container is wide enough).
    const has3ColRule = await page.evaluate(() => {
      const styles = Array.from(document.querySelectorAll("style"));
      return styles.some((s) => s.textContent?.includes("pf-cols-3") && s.textContent?.includes("repeat(3"));
    });
    expect(has3ColRule).toBe(true);
  });

  test("col-span control: setting span=2 applies grid-column: span 2", async ({ page }) => {
    test.setTimeout(120_000);
    await openEditorWithDraft(page, "new draft 2");

    // Fixture guard: the draft must have a Columns grid with a Container child.
    // .pf-cols > [data-block='container'] is the Container block rendered directly
    // inside the Columns slot. If the fixture changes, the .waitFor below will
    // throw clearly rather than silently time out.
    const grid = page.locator(".pf-cols").first();
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const containerChild = page.locator(".pf-cols > [data-block='container']").first();
    await expect(containerChild).toBeVisible({ timeout: 10_000 });
    await containerChild.click({ position: { x: 4, y: 4 } });
    await page.waitForTimeout(400);

    // Open Layout tab.
    const layoutTab = page
      .getByRole("tab", { name: "Layout" })
      .or(page.getByRole("button", { name: "Layout", exact: true }));
    await layoutTab.first().waitFor({ state: "visible", timeout: 10_000 });
    await layoutTab.first().click();
    await page.waitForTimeout(300);

    // Expand the "Layout" drawer (it auto-closes; "Spacing" is auto-open).
    const layoutDrawerBtn = page.locator('button[aria-expanded]').filter({ hasText: /^Layout$/i });
    const expanded = await layoutDrawerBtn.first().getAttribute("aria-expanded").catch(() => "true");
    if (expanded === "false") {
      await layoutDrawerBtn.first().click();
      await page.waitForTimeout(300);
    }

    // Find the Column span input scoped to its row div to avoid matching Row span.
    const colSpanLabel = page.getByText("Column span", { exact: true });
    await expect(colSpanLabel).toBeVisible({ timeout: 5_000 });
    const colSpanRow = page
      .locator("div.flex.items-center.justify-between")
      .filter({ has: colSpanLabel })
      .first();
    const colSpanInput = colSpanRow.locator('input[type="number"]').first();
    await expect(colSpanInput).toBeVisible({ timeout: 5_000 });

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

    // Fixture guard: same as col-span test — requires Container child in Columns.
    const grid = page.locator(".pf-cols").first();
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const containerChild = page.locator(".pf-cols > [data-block='container']").first();
    await expect(containerChild).toBeVisible({ timeout: 10_000 });
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
