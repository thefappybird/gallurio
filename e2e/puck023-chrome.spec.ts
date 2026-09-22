import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

/**
 * Upgrade verification for the editor chrome on Puck 0.23, batched into one
 * session: the dark-theme token re-scoping, the removal of the 0.21 plugin
 * rail, and the outline's position relative to the block tree.
 *
 * Editor chrome is desktop-only in-app UI, so 1280px only (see the
 * portfolio-testing skill's budget rules).
 */
test("editor chrome on 0.23: theme, rail, outline placement", async ({ page }) => {
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

  // The 0.21 rail is `_Nav_` / `_NavItem_` / `_PuckPluginTab_`, not "Rail".
  // Count only VISIBLE nodes: with legacySideBarPlugin the other plugins are
  // still mounted but flagged mobileOnly, so they sit in the DOM hidden.
  const chrome = await page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const countVisible = (s: string) => [...document.querySelectorAll(s)].filter(visible).length;

    const blocks = document.querySelector('[data-tour-id="blocks-panel"]');
    const sections = [...document.querySelectorAll('[class*="SidebarSection"]')].filter(visible);
    const outlineTree = document.querySelector('[class*="LayerTreeRoot"], [class*="LayerTree"]');

    // The outline must render after the whole block tree, inside the same
    // scrolling sidebar column - i.e. underneath "Manual blocks".
    let order: string = "missing";
    if (blocks && outlineTree) {
      const rel = blocks.compareDocumentPosition(outlineTree);
      order = rel & Node.DOCUMENT_POSITION_FOLLOWING ? "outline-after-blocks" : "outline-before-blocks";
    }

    return {
      visibleRailTabs: countVisible('[class*="PuckPluginTab"]'),
      visibleRailNavItems: countVisible('[class*="_NavItem"]'),
      // The decisive check: a rail would occupy its own column and push the
      // block tree right by roughly its width. Counting tab nodes is not
      // enough - with legacySideBarPlugin they stay mounted for the mobile
      // panel, merely laid out off to the side.
      blocksInsetFromEditorLeft: (() => {
        const host = document.querySelector(".gallurio-editor");
        if (!host || !blocks) return null;
        return Math.round(blocks.getBoundingClientRect().left - host.getBoundingClientRect().left);
      })(),
      sidebarSectionTitles: sections
        .map((s) => (s.textContent || "").trim().split(/\n/)[0].slice(0, 40))
        .slice(0, 6),
      outlinePresent: !!outlineTree,
      blocksPresent: !!blocks,
      order,
      sharesScrollParent:
        blocks && outlineTree
          ? blocks.closest('[class*="Sidebar"]') === outlineTree.closest('[class*="Sidebar"]')
          : null,
    };
  });

  const fs = await import("node:fs");
  fs.mkdirSync("e2e/.artifacts", { recursive: true });
  fs.writeFileSync(
    "e2e/.artifacts/puck023-chrome-report.json",
    JSON.stringify({ light, dark, chrome, consoleErrors }, null, 2)
  );

  // Dark mode must actually follow the app's tokens now.
  expect(dark?.surface).toBe(dark?.appCard);
  expect(dark?.text).toBe(dark?.appForeground);
  expect(light?.surface).toBe(light?.appCard);
  // The rail must be gone and the outline must sit below the block tree.
  expect(chrome.blocksInsetFromEditorLeft).not.toBeNull();
  expect(chrome.blocksInsetFromEditorLeft!).toBeLessThan(40);
  expect(chrome.outlinePresent).toBe(true);
  expect(chrome.order).toBe("outline-after-blocks");
});
