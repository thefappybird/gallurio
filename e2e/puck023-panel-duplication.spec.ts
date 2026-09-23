import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

/**
 * Diagnostic: does Puck 0.23 mount more than one copy of the editor panels?
 *
 * Several specs that pass on 0.20 fail on 0.23 with Playwright strict-mode
 * violations — `getByLabel("Instagram username")` resolving to 2 elements, a
 * PageBody count of 6 where 1 is expected. The suspicion is 0.23's plugin
 * architecture: `_PuckPluginTab_` is `display: none` rather than unmounted, so
 * every plugin's panel is in the DOM at once and only the active one is shown.
 *
 * This measures it instead of arguing about it. It asserts nothing about what
 * the right answer is — it records what is actually there, so the specs can be
 * fixed against fact.
 */
test("how many copies of each editor panel exist on 0.23", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });

  await openEditorWithDraft(page, "Editorial Summer Refresh");

  const counts = await page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const tally = (selector: string) => {
      const all = [...document.querySelectorAll(selector)];
      return { total: all.length, visible: all.filter(visible).length };
    };
    return {
      pluginTabs: tally('[class*="_PuckPluginTab_"]'),
      pluginTabsVisibleClass: tally('[class*="_PuckPluginTab--visible"]'),
      preview: tally("[data-puck-preview]"),
      pageBody: tally('[data-block="page-body"]'),
      blocksPanel: tally('[data-tour-id="blocks-panel"]'),
      fieldsPanel: tally('[data-tour-id="properties-panel-body"]'),
      layerTree: tally('[class*="_LayerTree_"]'),
      // The canvas wrapper 0.23 gives every component. If this now carries
      // role=button, every `getByRole("button")` in the suite gained matches.
      canvasComponents: tally("[data-puck-component]"),
      canvasComponentsAsButtons: tally('[data-puck-component][role="button"]'),
      // `@dnd-kit/dom`'s accessibility plugin only walks REGISTERED
      // draggables, so a component whose `drag` permission is false never
      // gets `role="button"`. Identify the exceptions rather than guess at
      // them — the count alone says nothing about which block it is.
      componentsWithoutRole: [...document.querySelectorAll("[data-puck-component]")]
        .filter((el) => !el.hasAttribute("role"))
        .map((el) => {
          // dnd-kit sets the role on `draggable.handle ?? draggable.element`.
          // We forward `puck.dragRef` to an inner element in ~25 blocks, so
          // for those the handle IS that inner element and the wrapper stays
          // roleless. Record where the role landed instead of assuming.
          const inner = el.querySelector('[aria-roledescription="draggable"]');
          return {
            tag: el.tagName.toLowerCase(),
            ownBlock: el.getAttribute("data-block"),
            tabIndex: el.getAttribute("tabindex"),
            text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
            handleInside: inner
              ? {
                  tag: inner.tagName.toLowerCase(),
                  role: inner.getAttribute("role"),
                  block: inner.getAttribute("data-block"),
                  isSameNode: inner === el,
                }
              : null,
            parentIsDraggable:
              el.parentElement?.getAttribute("aria-roledescription") === "draggable",
          };
        }),
      rootZones: tally('[data-puck-dropzone="root:default-zone"]'),
    };
  });

  const fs = await import("node:fs");
  fs.mkdirSync("e2e/.artifacts", { recursive: true });
  fs.writeFileSync(
    "e2e/.artifacts/puck023-panel-duplication.json",
    JSON.stringify(counts, null, 2)
  );

  // The only real assertion: whatever is DUPLICATED must at least be hidden,
  // so an owner never sees two of the same control. A duplicate that is also
  // visible is a shipping bug, not just a test-selector problem.
  expect(counts.fieldsPanel.visible, "one visible properties panel").toBeLessThanOrEqual(1);
  expect(counts.blocksPanel.visible, "one visible block tree").toBeLessThanOrEqual(1);
  expect(counts.preview.visible, "one visible canvas").toBeLessThanOrEqual(1);
});
