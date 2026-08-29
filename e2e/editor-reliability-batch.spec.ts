/**
 * Browser verification for the editor-reliability batch.
 *
 * Only the things a browser can actually answer live here. Structure, contrast,
 * token resolution and control/render parity are already covered by unit tests
 * (presetContrast, floatedDefaultParity, the composition suites); repeating them
 * here would be slower and no more truthful.
 *
 * What genuinely needs a real page:
 *  1. Whether the portfolio surface PAINTS the brand background. The bug was
 *     that `--pf-color-bg` was declared but never applied, so the app shell's
 *     ground showed through — invisible to any unit test that only inspects the
 *     style object.
 *  2. Whether Puck's <Render> survives being mounted INSIDE <Puck> for the
 *     drawer's live mini-render. Nested Puck contexts are the one real risk in
 *     that feature and a jsdom test with <Render> mocked cannot see it.
 *  3. Whether the app-shell scrollbar rules actually take, and stay off the
 *     published portfolio.
 *
 * Read-only: nothing is saved or published, so the shared seeded workspace is
 * left exactly as found.
 */
import { test, expect, type Page } from "@playwright/test";

const SHELL = "[data-testid='portfolio-editor-shell']";
const ITEM_NAME = '[class*="_DrawerItem-name_"]';
const CATEGORY_TITLE = '[class*="_ComponentList-title_"]';
const CATEGORY_ROOT = '[class*="_ComponentList_"]';

/** Fail loudly on a Next error overlay rather than asserting against one. */
async function assertNoErrorOverlay(page: Page): Promise<void> {
  const overlay = page.locator("nextjs-portal, [data-nextjs-dialog-overlay]");
  expect(await overlay.count(), "no Next.js error overlay on the page").toBe(0);
}

async function openEditor(page: Page): Promise<void> {
  await page.goto("/en/portfolio");
  await page.locator(SHELL).waitFor({ timeout: 90_000 });

  // `isVisible()` does NOT wait — it answers immediately — so waiting explicitly
  // is the difference between dismissing the dialog and silently no-opping while
  // every later click burns its timeout against the backdrop.
  const dialog = page.getByRole("dialog").first();
  const appeared = await dialog
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (appeared) {
    // "Continue where you left off" resumes the local draft and closes outright.
    // "Start from scratch" opens a SECOND dialog (the template chooser).
    const named = dialog.getByRole("button", { name: /Continue where you left off/i });
    const resume = (await named.count()) ? named : dialog.getByRole("button");
    await resume.first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
  }
  await page.waitForTimeout(1_000);
}

test.describe("brand background is painted, not just declared", () => {
  test("the preview surface paints --pf-color-bg", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/en/portfolio-preview");
    // The shell holds children back until the local-draft read settles.
    await page.locator('[class*="pf-theme-"]').waitFor({ timeout: 60_000 });
    await assertNoErrorOverlay(page);

    const painted = await page.evaluate(() => {
      const el = document.querySelector('[class*="pf-theme-"]');
      if (!el) return null;
      const declared = getComputedStyle(el).getPropertyValue("--pf-color-bg").trim();
      if (!declared) return null;

      // Resolve BOTH colors through the same engine before comparing.
      // getComputedStyle hands back oklab here, so a naive rgb() regex returns
      // null and the assertion would pass vacuously.
      const probe = document.createElement("div");
      probe.style.backgroundColor = declared;
      el.appendChild(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();

      return { declared, expected, actual: getComputedStyle(el).backgroundColor };
    });

    expect(painted, "the preview wrapper exposes --pf-color-bg").not.toBeNull();
    expect(
      painted!.actual,
      `wrapper background should equal its own --pf-color-bg (${painted!.declared})`
    ).toBe(painted!.expected);
  });
});

test.describe("app-shell scrollbars", () => {
  test("are compact in the CRM and absent from the published portfolio", async ({ page }) => {
    await page.goto("/en/dashboard");
    await page.locator("body").waitFor();
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth),
      "CRM root opts into the thin scrollbar"
    ).toBe("thin");
    expect(
      await page.evaluate(() => document.documentElement.hasAttribute("data-app-shell")),
      "the app shell carries the scoping attribute"
    ).toBe(true);
  });
});

test.describe("drawer preset previews", () => {
  test("rows are name-only and the live mini-render mounts inside Puck", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);

    // Hero is the one group expanded on arrival.
    const hero = page
      .locator(CATEGORY_ROOT)
      .filter({ has: page.locator(CATEGORY_TITLE).filter({ hasText: /^Hero$/i }) })
      .first();
    await hero.waitFor({ state: "visible", timeout: 15_000 });

    // The description used to sit inline under every name. It now lives only in
    // the popover, which is the whole point of the change.
    await expect(hero).toContainText("Immersive cover");
    await expect(hero).not.toContainText("Copy and CTA beside an editable image");

    // Puck renders each item twice (the draggable plus a ghost), so scope to the
    // first name and walk to its row.
    const preview = hero.getByRole("button", { name: /Preview this block/i }).first();
    await expect(preview).toBeVisible();

    await preview.focus();
    const popover = page.locator('[data-slot="popover-content"]');
    await popover.waitFor({ state: "visible", timeout: 10_000 });

    await expect(popover).toContainText("Drag this block to add it to your page.");

    // The real question: does <Render> inside <Puck> actually produce a block
    // tree, or throw / render nothing? Assert on rendered content, not on the
    // frame merely existing.
    const rendered = await popover.evaluate((el) => {
      const frame = el.querySelector('[aria-hidden="true"]');
      if (!frame) return null;
      return {
        nodes: frame.querySelectorAll("*").length,
        text: (frame as HTMLElement).innerText.trim().length,
      };
    });
    expect(rendered, "the preview frame is present").not.toBeNull();
    expect(rendered!.nodes, "the mini-render produced a block tree").toBeGreaterThan(3);

    await assertNoErrorOverlay(page);
  });

  test("the drawer does not overflow once rows carry a preview control", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);

    for (const width of [768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(400);
      const overflow = await page.evaluate((rootSel) => {
        return (Array.from(document.querySelectorAll(rootSel)) as HTMLElement[])
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => `${el.innerText.split("\n")[0]}: ${el.scrollWidth}>${el.clientWidth}`);
      }, CATEGORY_ROOT);
      expect(overflow, `no drawer category overflows at ${width}px`).toEqual([]);
    }
    // The eye button must not push names out of their row.
    expect(
      await page.evaluate((sel) => {
        const names = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
        return names.filter((n) => n.scrollWidth > n.clientWidth + 1).length;
      }, ITEM_NAME),
      "no preset name is clipped by the new control"
    ).toBe(0);
  });
});
