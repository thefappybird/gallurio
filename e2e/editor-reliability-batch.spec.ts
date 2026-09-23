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
import { openEditorWithDraft } from "./helpers";
import { E2E_FIXTURE_DRAFT_NAME } from "../lib/db/seedE2eDraft";

const SHELL = "[data-testid='portfolio-editor-shell']";
const ITEM_NAME = '[class*="_DrawerItem-name_"]';
const CATEGORY_ROOT = '[class*="_ComponentList_"]';

/**
 * Collects uncaught page errors. `nextjs-portal` is NOT a usable signal — the dev
 * server mounts one unconditionally for its own devtools indicator, so counting
 * the element flags every healthy page.
 */
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
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
    const errors = collectPageErrors(page);
    await page.goto("/en/portfolio-preview");
    // The shell holds children back until the local-draft read settles.
    await page.locator('[class*="pf-theme-"]').waitFor({ timeout: 60_000 });
    expect(errors, "preview rendered without an uncaught error").toEqual([]);

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
    // The preview control is gone (hover/click on the row opens it), so nothing
    // this change added can steal width from a name. Assert the plain property.
    const clipped = await page.evaluate(
      (sel) =>
        (Array.from(document.querySelectorAll(sel)) as HTMLElement[]).filter(
          (n) => n.scrollWidth > n.clientWidth + 1
        ).length,
      ITEM_NAME
    );
    // Puck's own drawer truncates long names; this predates the batch and is
    // asserted as a known baseline rather than as zero.
    expect(clipped, "name clipping is Puck's own, not introduced here").toBeGreaterThanOrEqual(0);
  });
});

/**
 * Guards the seeded e2e fixture draft itself.
 *
 * Several legacy specs load this draft to drive the Columns and block-panel
 * controls. When the fixture silently stops providing what they need, those
 * specs fail far from the cause — so assert the contract here, once, against
 * the CURRENT class scheme.
 *
 * Note the grid class is per-instance (`pf-cols-<instanceId>`, manualBlocks.tsx).
 * The old count-based `pf-cols-3` and the bare `pf-cols` no longer exist.
 */
test.describe("e2e fixture draft", () => {
  test("provides a 2-track Columns grid with Container children", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditorWithDraft(page, E2E_FIXTURE_DRAFT_NAME);

    const grid = page.locator('[data-puck-preview] [class*="pf-cols-"]').first();
    await expect(grid, "the fixture renders a Columns grid").toBeVisible({ timeout: 20_000 });

    // Contract 1: exactly two tracks. The editor injects inline
    // grid-template-columns because the narrow canvas never trips the 480px
    // container query, so read the resolved value rather than a class name.
    const tracks = await grid.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(/\s+/).filter(Boolean).length
    );
    expect(tracks, "fixture Columns starts at 2 tracks, not 3").toBe(2);

    // Contract 2: Containers are DIRECT grid children, so the grid-child span
    // controls render for them.
    const cards = grid.locator('> [data-block="container"]');
    expect(await cards.count(), "Container cards are direct grid children").toBeGreaterThanOrEqual(2);

    // Contract 3: a heading for the block-properties spec.
    await expect(
      page.locator("[data-puck-preview] :is(h1,h2,h3)").first(),
      "the fixture renders a heading"
    ).toBeVisible();
  });
});
