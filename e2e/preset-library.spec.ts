/**
 * The grouped section-preset drawer, verified in a real browser.
 *
 * The library went from 10 flat presets to 33 in 11 collapsible groups, each
 * item carrying a localized one-line description. Structure and contrast are
 * already unit-tested (sectionPresets/presetContrast/editorConfig); what only a
 * browser can answer is whether the drawer actually renders that way — grouped,
 * three per group, descriptions present, collapsed except Hero, and without
 * horizontal overflow or RTL breakage under Arabic chrome.
 *
 * Breakpoints are 768 and 1280: the editor is a desktop-only surface and Puck's
 * left side bar is not rendered at all at 375px (probed, not assumed).
 *
 * Read-only: nothing is saved or published, so the shared seeded workspace is
 * left exactly as found.
 */
import { test, expect, type Page } from "@playwright/test";

const SHELL = "[data-testid='portfolio-editor-shell']";
// Puck ships CSS-module class names, so match on the stable hashed prefix.
const CATEGORY_TITLE = '[class*="_ComponentList-title_"]';
const CATEGORY_ROOT = '[class*="_ComponentList_"]';
// Puck renders each drawer item twice — the draggable and a `Drawer-draggableBg`
// ghost behind it — so every selector matches 2x per item. Count DISTINCT names
// rather than elements.
const ITEM_NAME = '[class*="_DrawerItem-name_"]';

/** The distinct variant names inside one category, deduped across Puck's ghost copy. */
async function variantNames(page: Page, title: string): Promise<string[]> {
  const texts = await categoryFor(page, title).locator(ITEM_NAME).allInnerTexts();
  return [...new Set(texts.map((t) => t.trim()))].sort();
}

/** The 11 group headings, in drawer order. Puck uppercases them in CSS. */
const GROUPS = [
  "Hero",
  "About",
  "Services",
  "Call to action",
  "Contact",
  "Gallery grid",
  "Gallery masonry",
  "Featured work",
  "Gallery landing",
  "Video",
  "Footer",
] as const;

async function openEditor(page: Page, locale = "en"): Promise<void> {
  await page.goto(`/${locale}/portfolio`);
  await page.locator(SHELL).waitFor({ timeout: 90_000 });

  // The entry dialog lays a fixed backdrop over the whole editor, so a category
  // title stays visible but is not clickable until it closes. It mounts a beat
  // after the shell hydrates, and `isVisible()` does NOT wait — it answers
  // immediately — so wait for it explicitly or the dismissal silently no-ops and
  // every later click burns its full timeout against the backdrop.
  const dialog = page.getByRole("dialog").first();
  const appeared = await dialog
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (appeared) {
    // Prefer "Continue where you left off": it resumes the local draft and closes
    // outright. "Start from scratch" opens a SECOND dialog (the template chooser),
    // so it is only the fallback for an account with nothing to resume.
    // Matched by English name where possible; under a translated locale fall back
    // to the dialog's first button, which is this same "continue" choice.
    const named = dialog.getByRole("button", { name: /Continue where you left off/i });
    const resume = (await named.count()) ? named : dialog.getByRole("button");
    if (await resume.first().isEnabled()) {
      await resume.first().click();
    } else {
      await dialog.getByRole("button", { name: /Start from scratch/i }).first().click();
      const templates = page.getByRole("dialog").filter({ hasText: /Choose a template/i });
      await templates.waitFor({ state: "visible", timeout: 15_000 });
      // The empty canvas — applies no starter layout, so nothing is seeded.
      await templates.getByRole("button", { name: /I'll start from scratch/i }).first().click();
      await templates.getByRole("button", { name: /Use this template/i }).first().click();
    }
    // Every dialog must be gone before the drawer accepts clicks.
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
  }
  await page.waitForTimeout(1_000);
}

/** The category root for a group title, matched case-insensitively. */
function categoryFor(page: Page, title: string) {
  return page
    .locator(CATEGORY_ROOT)
    .filter({ has: page.locator(CATEGORY_TITLE).filter({ hasText: new RegExp(`^${title}$`, "i") }) })
    .first();
}

/** Expand one category if it is collapsed. */
async function expandGroup(page: Page, title: string): Promise<void> {
  const category = categoryFor(page, title);
  await category.waitFor({ state: "visible", timeout: 15_000 });
  if ((await category.getAttribute("class"))?.includes("--isExpanded")) return;
  await category.locator(CATEGORY_TITLE).first().click();
  await page.waitForTimeout(250);
}

test.describe("grouped section-preset drawer", () => {
  test("shows 11 section groups plus Manual blocks, three variants each", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);

    const titles = (await page.locator(CATEGORY_TITLE).allInnerTexts()).map((t) =>
      t.trim().toUpperCase()
    );
    for (const group of GROUPS) {
      expect(titles, `drawer shows the "${group}" group`).toContain(group.toUpperCase());
    }
    expect(titles, "Manual blocks stays its own category").toContain("MANUAL BLOCKS");

    for (const group of GROUPS) {
      await expandGroup(page, group);
      expect(await variantNames(page, group), `${group} holds three variants`).toHaveLength(3);
    }
  });

  test("only Hero is expanded on arrival — 33 items all open is unusable", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);

    const expanded = await page.evaluate(
      ({ rootSel, titleSel }) =>
        Array.from(document.querySelectorAll(rootSel))
          .filter((el) => el.className.includes("--isExpanded"))
          .map((el) => el.querySelector(titleSel)?.textContent?.trim().toUpperCase() ?? "?"),
      { rootSel: CATEGORY_ROOT, titleSel: CATEGORY_TITLE }
    );

    // "Other" is Puck's bucket for uncategorised components — it holds only the
    // editor-internal ContainerAnchor (insert: false) and predates this work.
    expect(expanded.filter((t) => t !== "OTHER")).toEqual(["HERO"]);
  });

  test("each preset item shows its variant name, description moved to the preview", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);

    const hero = categoryFor(page, "Hero");
    const text = (await hero.innerText()).trim();

    // Variant names, not the old flat group label.
    expect(text).toContain("Immersive cover");
    expect(text).toContain("Split introduction");
    expect(text).toContain("Typographic statement");

    // The one-line description used to sit inline under every name. With 33
    // presets that made the drawer unscannable, so it moved into the hover /
    // focus preview popover alongside a live miniature of the preset.
    // `editor-reliability-batch.spec.ts` covers the popover itself.
    expect(text).not.toContain("Copy and CTA beside an editable image");
  });

  test("the drawer does not overflow horizontally at 768 or 1280", async ({ page }) => {
    test.setTimeout(180_000);
    // Open ONCE and resize between measurements: a second navigation re-opens the
    // entry dialog, which marks the page inert and blocks the drawer.
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);
    // Longest group title and longest subtitles in the library.
    await expandGroup(page, "Gallery masonry");

    for (const width of [768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(400);

      const overflow = await page.evaluate((rootSel) => {
        const items = Array.from(document.querySelectorAll(rootSel)) as HTMLElement[];
        return items
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => `${el.innerText.split("\n")[0]}: ${el.scrollWidth}>${el.clientWidth}`);
      }, CATEGORY_ROOT);

      expect(overflow, `no drawer category overflows at ${width}px`).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        `page does not scroll horizontally at ${width}px`
      ).toBe(true);
    }
  });

  test("Arabic chrome mirrors the drawer without breaking it", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page, "ar");

    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");

    // Group titles are translated — neither the English fallback nor a raw i18n
    // key may leak through.
    const titles = (await page.locator(CATEGORY_TITLE).allInnerTexts()).join("\n");
    expect(titles, "no untranslated i18n key rendered").not.toContain("puckConfig.");
    expect(titles.toUpperCase(), "not showing English group names").not.toContain("GALLERY MASONRY");

    // Items must stay inside their panel once mirrored.
    const bounds = await page.evaluate(
      ({ rootSel, nameSel }) => {
        const name = document.querySelector(nameSel) as HTMLElement | null;
        if (!name) return null;
        const panel = name.closest(rootSel) as HTMLElement;
        const i = name.getBoundingClientRect();
        const p = panel.getBoundingClientRect();
        return { itemLeft: i.left, itemRight: i.right, panelLeft: p.left, panelRight: p.right };
      },
      { rootSel: CATEGORY_ROOT, nameSel: ITEM_NAME }
    );

    expect(bounds, "a drawer item is present under RTL").not.toBeNull();
    expect(bounds!.itemLeft).toBeGreaterThanOrEqual(bounds!.panelLeft - 1);
    expect(bounds!.itemRight).toBeLessThanOrEqual(bounds!.panelRight + 1);
  });
});
