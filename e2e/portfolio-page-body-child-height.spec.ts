/**
 * The page body must behave like the canvas: a block dropped into it keeps its
 * own height instead of stretching over the whole vacant row.
 *
 * Regression: PageBodyBlock rendered its slot as a flex column, which turned
 * every child into a flex item; Container carries `flexGrow: 1`, so a single
 * dropped section (and its background) filled everything between Navigation and
 * Footer. The slot is block flow now, which makes that `flexGrow` inert.
 */
import { expect, test } from "@playwright/test";

const SHELL = "[data-testid='portfolio-editor-shell']";
const ITEM_NAME = '[class*="_DrawerItem-name_"]';
const SLOT = '[data-block="page-body"] > [data-puck-dropzone$=":content"]';

test("a block dropped into the page body keeps its own height", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/portfolio");
  await page.locator(SHELL).waitFor({ timeout: 90_000 });
  const scratch = page.getByRole("button", { name: /start from scratch/i });
  await scratch.waitFor({ state: "visible", timeout: 30_000 });
  await scratch.click();
  // Entry dialog hands off to the template picker; pick the empty canvas there.
  const picker = page.getByRole("dialog").filter({ hasText: "Choose a template" });
  await expect(picker).toBeVisible({ timeout: 15_000 });
  await picker.getByText(/I'll start from scratch/i).click();
  await picker.getByRole("button", { name: /use this template/i }).click();
  await expect(picker).toBeHidden({ timeout: 20_000 });
  await page.waitForTimeout(2_000);

  // An empty canvas is the point: only a body row with free space can reveal a
  // child that stretches into it.
  const slot = page.locator(`[data-puck-preview] ${SLOT}`);
  await expect(slot).toHaveCount(1);
  // The mechanism: block flow makes a child Container's `flexGrow: 1` inert.
  expect(await slot.evaluate((el) => getComputedStyle(el).display)).toBe("block");

  const before = await slot.evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    children: el.querySelectorAll(':scope > [data-block="container"]').length,
  }));

  // Drag a short preset in (dnd-kit pointer sensor — see portfolio-testing skill).
  const group = page
    .locator(`${SHELL} section > div > [role="button"]`)
    .filter({ hasText: /^Call to action$/i })
    .first();
  if ((await group.getAttribute("aria-expanded")) !== "true") await group.click();
  const item = page.locator(ITEM_NAME).filter({ hasText: /^Accent band$/i }).first();
  await item.scrollIntoViewIfNeeded();
  const from = await item.boundingBox();
  const to = await slot.boundingBox();
  if (!from || !to) throw new Error("missing drag geometry");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 6, from.y + from.height / 2 + 6);
  await page.waitForTimeout(60);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 18 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 4, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(1_500);

  const dropped = slot.locator('> [data-block="container"]');
  await expect(dropped).toHaveCount(before.children + 1);

  const geometry = await slot.evaluate((el) => {
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const sections = Array.from(
      el.querySelectorAll(':scope > [data-block="container"]'),
    ) as HTMLElement[];
    return {
      slotHeight: box.height,
      slotContentWidth: box.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      slotContentLeft: box.left + parseFloat(cs.paddingLeft),
      sections: sections.map((s) => {
        const r = s.getBoundingClientRect();
        return { height: r.height, width: r.width, left: r.left };
      }),
    };
  });

  // The body still fills the row, so the whole gap stays droppable.
  expect(geometry.slotHeight).toBeGreaterThan(400);
  // No section swallows the row; each keeps its own natural height.
  for (const s of geometry.sections) {
    expect(s.height).toBeLessThan(geometry.slotHeight * 0.75);
    // ...and stays inside the body's horizontal margin instead of bleeding out.
    expect(s.width).toBeLessThanOrEqual(geometry.slotContentWidth + 1);
    expect(s.left).toBeGreaterThanOrEqual(geometry.slotContentLeft - 1);
  }
  expect(geometry.sections.length).toBeGreaterThan(0);
});
