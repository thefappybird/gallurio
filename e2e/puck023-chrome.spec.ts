import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

/**
 * Upgrade verification for the editor chrome on Puck 0.23, batched into one
 * session: the dark-theme token re-scoping, the removal of the 0.21 plugin
 * rail, and the Components/Outline tabs that replace it.
 *
 * Editor chrome is desktop-only in-app UI, so 1280px only (see the
 * portfolio-testing skill's budget rules).
 */
test("editor chrome on 0.23: theme, no rail, sidebar tabs", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });

  const consoleErrors: string[] = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 160)}`));

  await openEditorWithDraft(page, "Editorial Template");

  const readTheme = () =>
    page.evaluate(() => {
      const host = document.querySelector(".gallurio-editor");
      if (!host) return null;
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const ctx = c.getContext("2d") as CanvasRenderingContext2D;
      const raster = (v: string) => {
        if (!v) return null;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return `${d[0]},${d[1]},${d[2]}`;
      };
      const cs = getComputedStyle(host);
      const tok = (n: string) => raster(cs.getPropertyValue(n).trim());
      const paintOf = (sel: string) => {
        let n: Element | null = document.querySelector(sel);
        while (n) {
          const bg = getComputedStyle(n).backgroundColor;
          const m = bg.match(/[\d.]+/g);
          if (m && (m.length < 4 || Number(m[3]) > 0.99)) return raster(bg);
          n = n.parentElement;
        }
        return null;
      };
      return {
        surface: tok("--puck-color-surface"),
        surfaceSubtle: tok("--puck-color-surface-subtle"),
        text: tok("--puck-color-text"),
        border: tok("--puck-color-border"),
        interactive: tok("--puck-color-interactive"),
        linePlaceholder: tok("--puck-color-line-placeholder"),
        appCard: tok("--card"),
        appForeground: tok("--foreground"),
        fieldsPanelPaint: paintOf('[data-tour-id="properties-panel-body"]'),
      };
    });

  const light = await readTheme();
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(500);
  const dark = await readTheme();
  await page.screenshot({ path: "e2e/.artifacts/puck023-editor-dark.png" });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.waitForTimeout(300);
  await page.screenshot({ path: "e2e/.artifacts/puck023-editor-light.png" });

  // ---- The plugin rail is gone, replaced by our own two-tab sidebar ----
  //
  // Puck 0.21 splits the sidebar into an icon rail (Blocks / Outline / Fields
  // as separate tabs). `EditorSideBar` takes that column over via a plugin
  // named `legacy-side-bar` — the literal the rail hard-codes to stand down.
  // Any other name leaves the rail up, which is exactly the regression this
  // pins, so assert on the LAYOUT, not on tab-node counts: with the rail
  // suppressed the other plugins stay mounted as `mobileOnly` and merely sit
  // off to the side.
  const tabs = page.locator('button[aria-pressed]');
  const componentsTab = tabs.filter({ hasText: /^Components$/ }).first();
  const outlineTab = tabs.filter({ hasText: /^Outline$/ }).first();
  await expect(componentsTab).toBeVisible();
  await expect(outlineTab).toBeVisible();
  // Components is the tab an owner lands on.
  await expect(componentsTab).toHaveAttribute("aria-pressed", "true");

  const railGone = await page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const host = document.querySelector(".gallurio-editor");
    const blocks = document.querySelector('[data-tour-id="blocks-panel"]');
    return {
      // The rail is `<nav class="_Nav_">` with `<li class="_NavItem_">` rows.
      // NOT `_PuckPluginTab_` — those are the panel BODIES, and the sidebar's
      // own panel is one of them, so counting them can never reach zero.
      railWidth: (() => {
        const nav = document.querySelector('nav[class*="_Nav_"]');
        return nav ? Math.round(nav.getBoundingClientRect().width) : 0;
      })(),
      visibleRailItems: [...document.querySelectorAll('li[class*="_NavItem_"]')].filter(visible)
        .length,
      // A rail occupies its own column and pushes the block tree right by
      // roughly its width. This is the decisive check.
      blocksInsetFromEditorLeft:
        host && blocks
          ? Math.round(blocks.getBoundingClientRect().left - host.getBoundingClientRect().left)
          : null,
      blocksVisible: !!blocks && visible(blocks),
      // Presence is the WRONG question on 0.23. `_PuckPluginTab_` is
      // `display: none`, not unmounted, so Puck's own mobile Outline panel is
      // always in the DOM — measured: one LayerTree present, zero visible,
      // while the Components tab is active. Only visibility distinguishes the
      // tab an owner is looking at.
      outlineVisible: [...document.querySelectorAll('[class*="_LayerTree_"]')].some(visible),
    };
  });
  expect(railGone.blocksVisible).toBe(true);
  expect(railGone.blocksInsetFromEditorLeft).not.toBeNull();
  expect(railGone.blocksInsetFromEditorLeft!).toBeLessThan(40);
  expect(railGone.railWidth, "the rail takes no horizontal space").toBe(0);
  expect(railGone.visibleRailItems, "no rail rows on desktop").toBe(0);
  // The two panels are tabs, not a stack: only one is SHOWN at a time.
  expect(railGone.outlineVisible).toBe(false);

  // ---- Outline tab: swaps the panel and opens PageBody on first visit ----
  await outlineTab.click();
  await page.waitForTimeout(500);
  const outline = await page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    // Scoped to VISIBLE rows on purpose: Puck's hidden mobile Outline panel
    // renders its own full copy of the tree, so an unscoped query finds
    // PageBody in a panel nobody is looking at and proves nothing.
    const rows = [...document.querySelectorAll('[class*="_Layer_"]')].filter(visible);
    const named = (el: Element) =>
      (el.querySelector('[class*="_Layer-name_"]')?.textContent ?? "").trim();
    const pageBody = rows.find((r) => /page body/i.test(named(r)));
    return {
      blocksVisible: [...document.querySelectorAll('[data-tour-id="blocks-panel"]')].some(visible),
      rowCount: rows.length,
      names: rows.map(named).filter(Boolean).slice(0, 12),
      pageBodyFound: !!pageBody,
      // The whole point of the auto-expand: the owner's blocks are nested
      // inside the locked PageBody, so a collapsed outline opens on nothing
      // but the pinned nav and footer.
      pageBodyExpanded: !!pageBody?.className.includes("Layer--isExpanded"),
    };
  });
  // Written BEFORE the assertions so a failure still leaves diagnostics — but
  // that means the file records OBSERVATIONS, never a verdict. An earlier
  // version of this spec wrote the same file and then failed, and the
  // leftover artifact was misread as proof the rail was gone. It was not.
  const fs = await import("node:fs");
  fs.mkdirSync("e2e/.artifacts", { recursive: true });
  fs.writeFileSync(
    "e2e/.artifacts/puck023-chrome-report.json",
    JSON.stringify({ light, dark, railGone, outline, consoleErrors }, null, 2)
  );

  expect(outline.blocksVisible, "the block tree is swapped out, not stacked").toBe(false);
  expect(outline.rowCount).toBeGreaterThan(2);
  expect(outline.pageBodyFound, `outline rows: ${outline.names.join(", ")}`).toBe(true);
  expect(outline.pageBodyExpanded, "PageBody opens on the first outline visit").toBe(true);

  // Dark mode must actually follow the app's tokens now.
  expect(dark?.surface).toBe(dark?.appCard);
  expect(dark?.text).toBe(dark?.appForeground);
  expect(light?.surface).toBe(light?.appCard);
});
