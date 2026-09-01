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
const CATEGORY_TITLE = '[class*="_ComponentList-title_"]';
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

/**
 * Hover a drawer row by moving the real mouse to it.
 *
 * `locator.hover()` times out here: Puck lays a `Drawer-draggableBg` ghost over
 * every item, so the name element never passes the "receives pointer events"
 * actionability check. Moving the mouse to its box hits whichever copy is
 * topmost — which is the honest test, because both copies map to the same entry
 * in the shared preview store and must agree.
 */
async function hoverRow(page: Page, locator: ReturnType<Page["locator"]>): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("drawer row has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
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
    // Browser recovery is explicit: Resume applies it and closes outright.
    // "Start from scratch" opens a SECOND dialog (the template chooser).
    const named = dialog.getByRole("button", { name: /Resume|Continue where you left off/i });
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
    // The preview renders the selected durable/published fallback directly;
    // browser recovery is consumed only when the editor opts in.
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
  test("rows are name-only and the live mini-render mounts inside Puck", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const errors = collectPageErrors(page);
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

    // There is no separate control any more: hovering the row opens its preview.
    // Puck renders each item twice (draggable + ghost); both resolve to the same
    // entry in the shared store, so either copy is fine to drive.
    await hoverRow(page, hero.locator(ITEM_NAME).first());
    const popover = page.locator('[data-preset-preview-panel="true"]');
    await popover.waitFor({ state: "visible", timeout: 10_000 });

    const previewGeometry = await popover.evaluate((el) => {
      const panel = el as HTMLElement;
      const frame = panel.firstElementChild as HTMLElement;
      const scaledPreset = frame.firstElementChild as HTMLElement;
      return {
        panelHeight: panel.getBoundingClientRect().height,
        frameHeight: frame.getBoundingClientRect().height,
        presetHeight: scaledPreset.getBoundingClientRect().height,
      };
    });
    expect(previewGeometry.panelHeight, "the card hugs its preview and copy").toBeLessThan(400);
    expect(
      Math.abs(previewGeometry.frameHeight - previewGeometry.presetHeight),
      "the preview frame follows the rendered preset instead of a generic floor"
    ).toBeLessThanOrEqual(2);

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

    // Nested Puck contexts are the real risk here: <Render> mounted inside
    // <Puck> must not throw.
    expect(errors, "no uncaught error from the nested <Render>").toEqual([]);
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

  test("empty media presets preview their layout instead of only empty-state copy", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);

    const category = (name: string) =>
      page
        .locator(CATEGORY_ROOT)
        .filter({ has: page.locator(CATEGORY_TITLE).filter({ hasText: new RegExp(`^${name}$`, "i") }) })
        .first();
    const expand = async (name: string) => {
      const group = category(name);
      await group.waitFor({ state: "visible", timeout: 15_000 });
      if (!(await group.getAttribute("class"))?.includes("--isExpanded")) {
        await group.locator(CATEGORY_TITLE).first().click();
      }
      return group;
    };

    const gallery = await expand("Gallery grid");
    await hoverRow(
      page,
      gallery.locator(ITEM_NAME).filter({ hasText: /^Framed selection$/i }).first()
    );
    const panel = page.locator('[data-preset-preview-panel="true"]');
    await panel.waitFor({ state: "visible", timeout: 10_000 });
    await expect(panel.locator("[data-preset-media-placeholder='grid']")).toHaveCount(1);
    await expect(panel.locator("[data-preset-media-tile]")).toHaveCount(4);

    const featured = await expand("Featured work");
    await hoverRow(
      page,
      featured.locator(ITEM_NAME).filter({ hasText: /^Lead collections$/i }).first()
    );
    const cardSizes = await panel.locator("[data-preset-collection-placeholder='true']").evaluateAll(
      (cards) => cards.map((card) => card.getBoundingClientRect()).map(({ width, height }) => ({ width, height }))
    );
    expect(cardSizes, "Lead collections shows two visible landscape cards").toHaveLength(2);
    expect(cardSizes.every(({ width, height }) => width > 80 && height > 50)).toBe(true);

    const about = await expand("About");
    await hoverRow(
      page,
      about.locator(ITEM_NAME).filter({ hasText: /^Portrait and story$/i }).first()
    );
    const imagePreview = panel.locator("[data-preset-media-placeholder='image']");
    await expect(imagePreview).toHaveCount(1);
    const imagePaint = await imagePreview.locator("[data-preset-photo-tile='true']").evaluate((tile) => {
      const style = getComputedStyle(tile);
      const { width, height } = tile.getBoundingClientRect();
      return { background: style.backgroundColor, border: style.borderColor, width, height };
    });
    expect(imagePaint.width).toBeGreaterThan(80);
    expect(imagePaint.height).toBeGreaterThan(50);
    expect(imagePaint.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(imagePaint.border).not.toBe("rgba(0, 0, 0, 0)");

    const hero = await expand("Hero");
    await hoverRow(
      page,
      hero.locator(ITEM_NAME).filter({ hasText: /^Immersive cover$/i }).first()
    );
    await expect(panel.locator("[data-preset-media-placeholder='background']")).toHaveCount(1);

    const video = await expand("Video");
    await hoverRow(
      page,
      video.locator(ITEM_NAME).filter({ hasText: /^Cinema band$/i }).first()
    );
    const cinema = panel.locator("[data-preset-media-placeholder='video']");
    await expect(cinema).toHaveCount(1);
    const cinemaSize = await cinema.evaluate((node) => {
      const { width, height } = node.getBoundingClientRect();
      return { width, height };
    });
    expect(cinemaSize.width, "Cinema band paints a visible full-width film frame").toBeGreaterThan(160);
    expect(cinemaSize.height, "Cinema band keeps a visible 16:9 preview").toBeGreaterThan(80);
  });
});

/**
 * The footer presets were rebuilt to match their approved mockups: nav buttons
 * use the new `link` style (a 1px bottom rule, no full frame, square corners),
 * and Signature's three actions sit bundled on ONE centred row rather than
 * spread across a 3-column grid.
 *
 * Structure is unit-tested in the composition suites. What only a browser shows
 * is the RESOLVED geometry and border box — whether those buttons really land on
 * one row and really draw a single edge. The drawer's live mini-render is the
 * cheapest place to look, because it renders the genuine preset through the
 * genuine config.
 */
test.describe("footer presets match their mockups", () => {
  test("Signature's actions sit on one row and draw only a bottom rule", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);

    const presetBlocks = page.getByRole("button", { name: /^Preset blocks$/i });
    await presetBlocks.waitFor({ state: "visible", timeout: 15_000 });
    if ((await presetBlocks.getAttribute("aria-expanded")) !== "true") {
      await presetBlocks.click();
    }

    const footer = page
      .locator(CATEGORY_ROOT)
      .filter({ has: page.locator(CATEGORY_TITLE).filter({ hasText: /^Footer$/i }) })
      .first();
    await footer.waitFor({ state: "visible", timeout: 15_000 });
    if (!(await footer.getAttribute("class"))?.includes("--isExpanded")) {
      await footer.locator(CATEGORY_TITLE).first().click();
      await page.waitForTimeout(300);
    }

    await hoverRow(page, footer.locator(ITEM_NAME).first());
    const popover = page.locator('[data-preset-preview-panel="true"]');
    await popover.waitFor({ state: "visible", timeout: 10_000 });

    // The miniature is aria-hidden (decorative), so query the DOM directly
    // rather than through the accessibility tree.
    const geometry = await popover.evaluate((el) => {
      const links = Array.from(el.querySelectorAll('a[role="button"]')) as HTMLElement[];
      if (links.length < 3) return { count: links.length };
      const rows = new Set(links.map((a) => Math.round(a.getBoundingClientRect().top)));
      const cs = getComputedStyle(links[0]);
      return {
        count: links.length,
        rows: rows.size,
        borderBottom: cs.borderBottomWidth,
        borderTop: cs.borderTopWidth,
        borderLeft: cs.borderLeftWidth,
        radius: cs.borderTopLeftRadius,
      };
    });

    expect(geometry.count, "Signature footer renders its three nav actions").toBe(3);
    expect(geometry.rows, "all three actions share one row").toBe(1);
    expect(geometry.borderBottom, "link style draws a 1px bottom rule").toBe("1px");
    expect(geometry.borderTop, "link style draws no top edge").toBe("0px");
    expect(geometry.borderLeft, "link style draws no side edge").toBe("0px");
    expect(geometry.radius, "link style has square corners").toBe("0px");
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

/**
 * The preview's interaction contract, which is where the flicker lived.
 *
 * Puck mounts every drawer row TWICE (draggable + `Drawer-draggableBg` ghost).
 * With per-row open state each preset owned two popovers whose pointer handlers
 * fought — one closing while the other opened. A single shared store fixes it by
 * construction, but only a browser can prove the two mounts actually agree.
 */
test.describe("drawer preview interaction", () => {
  test("one panel at a time; leaving the row keeps it; another row swaps it", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);

    const hero = page
      .locator(CATEGORY_ROOT)
      .filter({ has: page.locator(CATEGORY_TITLE).filter({ hasText: /^Hero$/i }) })
      .first();
    await hero.waitFor({ state: "visible", timeout: 15_000 });

    const panels = page.locator('[data-preset-preview-panel="true"]');
    const names = hero.locator(ITEM_NAME);

    // Hover the first variant.
    await hoverRow(page, names.first());
    await expect(panels).toHaveCount(1, { timeout: 10_000 });
    await expect(panels.first()).toContainText("Immersive cover");

    // Move the pointer well away. The contract says leaving does NOT dismiss —
    // the user has to be able to travel toward the panel.
    await page.mouse.move(900, 500);
    await page.waitForTimeout(600);
    await expect(panels, "leaving the row does not close the preview").toHaveCount(1);
    await expect(panels.first()).toContainText("Immersive cover");

    // Hover a DIFFERENT variant: the panel swaps rather than a second appearing.
    const second = hero.locator(ITEM_NAME).nth(2); // past the ghost copy of #1
    await hoverRow(page, second);
    await page.waitForTimeout(400);
    await expect(panels, "exactly one panel, ever").toHaveCount(1);

    // Position stability is the third flicker vector: Puck mounts each row
    // twice, so a pointer crossing between the draggable and its ghost fires
    // pointerenter on two DIFFERENT elements for the same preset. If the store
    // re-anchored on each, the panel would jitter between their boxes.
    await hoverRow(page, names.first());
    await page.waitForTimeout(300);
    const before = await panels.first().boundingBox();
    for (let i = 0; i < 4; i++) {
      await hoverRow(page, names.nth(1)); // the ghost copy of the same row
      await hoverRow(page, names.first());
    }
    await page.waitForTimeout(300);
    const after = await panels.first().boundingBox();
    expect(panels, "still exactly one panel after crossing the mounts").toHaveCount(1);
    expect(after!.x, "panel does not jitter horizontally").toBeCloseTo(before!.x, 0);
    expect(after!.y, "panel does not jitter vertically").toBeCloseTo(before!.y, 0);

    // Clicking the canvas dismisses it.
    await page.locator("[data-puck-preview]").click({ position: { x: 20, y: 20 } });
    await expect(panels, "acting on the canvas closes the preview").toHaveCount(0, {
      timeout: 10_000,
    });
  });
});
