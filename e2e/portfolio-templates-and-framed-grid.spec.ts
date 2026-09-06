/**
 * Verifies two related portfolio-maker changes in one browser session:
 *
 * 1. The template picker now offers 5 real starter templates (Minimal,
 *    Editorial, Luxury, Romantic, Modern) plus "start from scratch" — 6 cards
 *    that fill the 3-column grid evenly, replacing the old 4-template set
 *    that left a half-empty second row.
 * 2. The "Framed selection" gallery-grid preset was reworked from a single
 *    centered card into a split layout — a bordered grid on the wide track,
 *    an introduction strip alongside it — mirroring "Journal spread" but
 *    gallery-grid-based and mirrored (grid left, strip right).
 *
 * Editor-internal surface: 1280px only, one session, no re-navigation.
 */
import { test, expect, type Page } from "@playwright/test";

const ITEM_NAME = '[class*="_DrawerItem-name_"]';

async function openEditor(page: Page): Promise<void> {
  await page.goto("/portfolio");
  await page.locator("[data-testid='portfolio-editor-shell']").waitFor({ timeout: 90_000 });

  const dialog = page.getByRole("dialog").first();
  const appeared = await dialog
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;

  const named = dialog.getByRole("button", { name: /Continue where you left off/i });
  const resume = (await named.count()) ? named : dialog.getByRole("button");
  if (await resume.first().isEnabled()) {
    await resume.first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
    await page.waitForTimeout(1_000);
  } else {
    await dialog.getByRole("button", { name: /Start from scratch/i }).first().click();
  }
}

test.describe("portfolio maker: templates + framed grid", () => {
  test("template picker fills evenly, new templates apply, and Framed selection is a split layout", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);

    // --- 1. Template picker: 5 real templates + scratch, no orphan card ---
    // Reached via Drafts -> "Add new draft" (the non-welcome picker) rather than
    // the entry dialog's welcome flow, since the seeded owner has drafts to
    // resume and never sees the welcome "Start from scratch" branch.
    await page.getByRole("button", { name: /^Drafts$/ }).click();
    const drafts = page.getByRole("dialog").filter({ hasText: /Your drafts/i });
    await drafts.waitFor({ state: "visible", timeout: 15_000 });
    await drafts.getByRole("button", { name: /Add new draft/i }).click();

    const templates = page.getByRole("dialog").filter({ hasText: /Choose a template/i });
    await templates.waitFor({ state: "visible", timeout: 15_000 });

    // Each card's accessible name concatenates its label + description, so
    // match on the label's own <span> rather than the button's full name.
    const cardFor = (label: string) =>
      templates.locator("li button").filter({ has: page.getByText(label, { exact: true }) });

    const cards = templates.locator("ul > li button");
    await expect(cards).toHaveCount(6);
    const labels = ["Minimal", "Editorial", "Luxury", "Romantic", "Modern", "I'll start from scratch"];
    for (const label of labels) {
      await expect(cardFor(label), `template picker shows "${label}"`).toHaveCount(1);
    }

    // Apply a newly-ported template — proves its seed data loads without error.
    await cardFor("Romantic").click();
    await templates.getByRole("button", { name: /Use this template/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
    // The whole editor (canvas + drawer) remounts on template switch — wait for
    // the new canvas content, not just a fixed delay, before touching the drawer.
    await expect(page.locator("[data-testid='portfolio-editor-shell']")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Capturing moments that last forever/i })).toBeVisible({
      timeout: 20_000,
    });

    // --- 2. Framed selection preset: grid (left) + intro strip (right) ---
    const galleryToggle = page.getByRole("button", { name: "Gallery grid", exact: true });
    await galleryToggle.waitFor({ state: "visible", timeout: 20_000 });

    const framedRow = page.locator(ITEM_NAME).filter({ hasText: /^Framed selection$/i }).first();
    if (!(await framedRow.isVisible().catch(() => false))) {
      await galleryToggle.click();
      await framedRow.waitFor({ state: "visible", timeout: 10_000 });
    }
    // Puck renders every drawer row twice (draggable + ghost); the ghost
    // intercepts pointer events for a real .hover(), so move the mouse instead.
    await framedRow.scrollIntoViewIfNeeded();
    const rowBox = await framedRow.boundingBox();
    if (!rowBox) throw new Error("Framed selection row has no bounding box");
    await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
    await page.waitForTimeout(300);

    const panel = page.locator('[data-preset-preview-panel="true"]');
    await panel.waitFor({ state: "visible", timeout: 10_000 });

    // The grid's content slot holds real (empty) Image blocks, each rendering
    // its own placeholder tile — six of them, one per gridImages(6) seed.
    const gridSection = panel.locator("[data-block='gallery-grid']");
    await expect(gridSection).toHaveCount(1);
    await expect(gridSection.locator("[data-block='image']")).toHaveCount(6);

    const heading = panel.getByText("Gallery highlights", { exact: true });
    await expect(heading).toBeVisible();

    const [gridBox, headingBox] = await Promise.all([
      gridSection.boundingBox(),
      heading.boundingBox(),
    ]);
    expect(gridBox, "gallery grid section has a bounding box").not.toBeNull();
    expect(headingBox, "intro heading has a bounding box").not.toBeNull();
    // Grid occupies the wide (left) track; the intro strip sits to its right.
    expect(gridBox!.x).toBeLessThan(headingBox!.x);
    expect(gridBox!.x + gridBox!.width).toBeLessThanOrEqual(headingBox!.x + 1);
  });
});
