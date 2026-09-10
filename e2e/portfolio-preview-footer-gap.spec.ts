/**
 * The draft Preview must end at the footer.
 *
 * Regression: PageBodyBlock sized itself with `height: 100%`, which resolved
 * against the element holding Navigation + PageBody + Footer — so the body
 * claimed the entire page height and pushed the footer down by the height of
 * the chrome, leaving dead space above it. The sticky-footer frame the editor
 * canvas used lived on the root wrapper, whose only child is the wrapper
 * <Render> puts around the zone, so it never applied here at all.
 */
import { expect, test } from "@playwright/test";

const SHELL = "[data-testid='portfolio-editor-shell']";

test("the preview page ends at the footer, with no dead space above it", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/portfolio");
  await page.locator(SHELL).waitFor({ timeout: 90_000 });
  const scratch = page.getByRole("button", { name: /start from scratch/i });
  await scratch.waitFor({ state: "visible", timeout: 30_000 });
  await scratch.click();
  const picker = page.getByRole("dialog").filter({ hasText: "Choose a template" });
  await expect(picker).toBeVisible({ timeout: 15_000 });
  // A content-rich template: the complaint is about a page that has plenty and
  // still shows the gap, so the body must be taller than the viewport here.
  await picker.getByText(/^Editorial$/).click();
  await picker.getByRole("button", { name: /use this template/i }).click();
  await expect(picker).toBeHidden({ timeout: 30_000 });
  await page.waitForTimeout(3_000);

  await page.locator('[data-tour-id="preview-toggle"]').click();
  const body = page.frameLocator("iframe").first().locator('[data-block="page-body"]');
  await body.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2_000);

  const frame = await body.evaluate((main) => {
    const doc = main.ownerDocument;
    const holder = main.parentElement!;
    const slot = main.firstElementChild as HTMLElement;
    const kids = Array.from(slot.children) as HTMLElement[];
    const last = kids[kids.length - 1];
    return {
      holderDisplay: getComputedStyle(holder).display,
      holderDirection: getComputedStyle(holder).flexDirection,
      scrollHeight: doc.documentElement.scrollHeight,
      holderBottom: Math.round(holder.getBoundingClientRect().bottom),
      mainBottom: Math.round(main.getBoundingClientRect().bottom),
      mainHeight: Math.round(main.getBoundingClientRect().height),
      lastChildBottom: Math.round(last.getBoundingClientRect().bottom),
      childCount: kids.length,
    };
  });

  // The shared frame reached the element that actually holds the three blocks.
  expect(frame.holderDisplay).toBe("flex");
  expect(frame.holderDirection).toBe("column");
  expect(frame.childCount).toBeGreaterThan(1);

  // The body ends where its content ends — it no longer overhangs the page by
  // the height of the chrome, which is what opened the gap above the footer.
  expect(frame.mainBottom).toBe(frame.lastChildBottom);
  expect(frame.mainBottom).toBeLessThanOrEqual(frame.holderBottom);
  // Nothing scrolls past the end of the page.
  expect(frame.scrollHeight).toBeLessThanOrEqual(frame.holderBottom + 1);
});
