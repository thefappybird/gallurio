/**
 * The nav block's manual reorder control (Order, in the Navigation block's
 * Content panel) — verifies the real Puck data-flow wiring (button click ->
 * setProp -> live canvas re-render) that a component-level test with a mock
 * setProp can't exercise. Editor-internal surface: 1280px only.
 *
 * One session, one login, no re-navigation. Read-only: nothing is saved or
 * published, so the shared seeded workspace is left exactly as found.
 */
import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

const SHELL = "[data-testid='portfolio-editor-shell']";

test.use({ viewport: { width: 1280, height: 900 } });

test("reordering nav items in the Content panel updates the live canvas", async ({ page }) => {
  await openEditorWithDraft(page, "Minimal Template");

  // Default order: Home, Gallery, Contact are the 3 collapsible items.
  const navRow = page.locator(SHELL).locator("nav[aria-label]").first();
  await expect(navRow.getByRole("link", { name: /Home/i })).toBeVisible();

  // Click the rendered nav in canvas to select the Navigation block — Puck's
  // own overlay intercepts the click for block selection instead of
  // following the link, but also fails Playwright's normal actionability
  // check, so dispatch via raw mouse coordinates (same technique the
  // portfolio-testing skill uses for canvas drag).
  const navBox = await navRow.boundingBox();
  if (!navBox) throw new Error("nav row has no bounding box");
  await page.mouse.click(navBox.x + navBox.width / 2, navBox.y + navBox.height / 2);

  // Move "Contact" up twice so it becomes the first collapsible item.
  const contactUp = page.getByRole("button", { name: "Move Contact up" });
  await expect(contactUp).toBeVisible();
  await contactUp.click();
  await contactUp.click();

  // The canvas nav row must now render Contact before Home/Gallery — a real
  // Puck data-flow round trip (setProp -> block re-render), not just a panel
  // state change.
  const items = navRow.locator("button, a").filter({ hasText: /Home|Gallery|Contact/i });
  const order = (await items.allTextContents()).map((t) => t.trim());
  const contactIndex = order.findIndex((t) => /contact/i.test(t));
  const homeIndex = order.findIndex((t) => /home/i.test(t));
  const galleryIndex = order.findIndex((t) => /gallery/i.test(t));
  expect(contactIndex).toBeGreaterThanOrEqual(0);
  expect(contactIndex).toBeLessThan(homeIndex);
  expect(contactIndex).toBeLessThan(galleryIndex);
});
