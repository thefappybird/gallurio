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
      // Puck ids are `<ComponentType>-<uuid>` and land verbatim in
      // `data-puck-component` (chunk-55V3NZVF.mjs: `el.setAttribute(
      // "data-puck-component", id)`), so the id NAMES the block type. Three
      // earlier guesses at the roleless component were wrong because they
      // reasoned from the DOM shape instead of reading this attribute.
      //
      // `drag: false` is NOT the explanation and must not be guessed at again:
      // Navigation, Footer and PageBody all set it and all still carry
      // `role="button"`. Puck disables the draggable AFTER registration
      // (`sortable.draggable.disabled = !permissions.drag`) and marks it with
      // `data-puck-disabled` — dnd-kit leaves the a11y attributes in place.
      // So capture that attribute too, and let it falsify itself.
      componentsWithoutRole: [...document.querySelectorAll("[data-puck-component]")]
        .filter((el) => !el.hasAttribute("role"))
        .map((el) => {
          const chain: { id: string | null; role: string | null }[] = [];
          for (let p = el.parentElement; p; p = p.parentElement) {
            if (p.hasAttribute("data-puck-component")) {
              chain.push({
                id: p.getAttribute("data-puck-component"),
                role: p.getAttribute("role"),
              });
            }
          }
          return {
            id: el.getAttribute("data-puck-component"),
            tag: el.tagName.toLowerCase(),
            // The full attribute list shows whether dnd-kit applied SOME of
            // its attributes and not others (a torn update) versus none at
            // all (never registered). Those are different bugs.
            attrs: el.getAttributeNames(),
            puckDisabled: el.hasAttribute("data-puck-disabled"),
            dragging: el.hasAttribute("data-dnd-dragging"),
            placeholder: el.hasAttribute("data-dnd-placeholder"),
            connected: el.isConnected,
            text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
            ancestorComponents: chain,
          };
        }),
      // Any id stamped on two nodes at once. Puck's effect writes
      // `data-puck-component` on `ref.current` and removes it on cleanup, so
      // one id should mean one element; two means a node was stamped and
      // never un-stamped. Dump BOTH nodes and how they are related — nesting
      // vs siblings are different bugs with different fixes.
      duplicateComponentIds: (() => {
        const byId = new Map<string, Element[]>();
        for (const el of document.querySelectorAll("[data-puck-component]")) {
          const id = el.getAttribute("data-puck-component") ?? "";
          byId.set(id, [...(byId.get(id) ?? []), el]);
        }
        const describe = (el: Element) => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            role: el.getAttribute("role"),
            attrs: el.getAttributeNames(),
            childTags: [...el.children].map((c) => c.tagName.toLowerCase()),
            rect: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
            parentTag: el.parentElement?.tagName.toLowerCase() ?? null,
            parentComponent: el.parentElement?.closest("[data-puck-component]")?.getAttribute("data-puck-component") ?? null,
            text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
          };
        };
        return [...byId.entries()]
          .filter(([, els]) => els.length > 1)
          .map(([id, els]) => ({
            id,
            count: els.length,
            // Nested means one wraps the other (a wrapper/inner dragRef
            // split); disjoint means the component genuinely rendered twice.
            nested: els[0].contains(els[1]) ? "first-contains-second"
              : els[1].contains(els[0]) ? "second-contains-first"
              : "disjoint",
            nodes: els.map(describe),
          }));
      })(),
      // Census by component type. If a whole type is roleless the fix belongs
      // in that block's config; if it is one instance of a type whose siblings
      // are fine, it is a render-time anomaly instead.
      roleCensus: (() => {
        const byType: Record<string, { total: number; withRole: number }> = {};
        for (const el of document.querySelectorAll("[data-puck-component]")) {
          const type = (el.getAttribute("data-puck-component") ?? "").replace(/-[0-9a-f-]{8,}$/i, "");
          byType[type] ??= { total: 0, withRole: 0 };
          byType[type].total += 1;
          if (el.hasAttribute("role")) byType[type].withRole += 1;
        }
        return byType;
      })(),
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
