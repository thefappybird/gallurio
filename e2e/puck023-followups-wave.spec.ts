import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import en from "../messages/en.json";
import ar from "../messages/ar.json";
import { measureFirstLoadJs, openEditorWithDraft, publishCurrent } from "./helpers";

/**
 * Batched browser checks for the Puck 0.23 follow-ups wave (see
 * docs/portfolio/puck-023-followups.md). One session per test, 1280px, editor
 * chrome only; the public-page measurements ride on plain navigations.
 *
 * Ordered so the first test absorbs Turbopack's cold compile of the editor
 * routes and every later test measures the app, not the bundler.
 */

const SHELL = "[data-testid='portfolio-editor-shell']";
const ARTIFACT_DIR = "e2e/.artifacts/wave";

test("warm-up: editor and preview routes compile", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/portfolio");
  await page.locator(SHELL).waitFor({ timeout: 240_000 });
  await page.goto("/en/portfolio-preview?zone=home");
  await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => {});
  await expect(page.locator("body")).not.toContainText("Unhandled Runtime Error");
});

test("item 4: presets host a bridge anchor and anchors carry no Puck chrome", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openEditorWithDraft(page, "Editorial Template");

  const canvas = page.locator("[data-puck-preview]").first();
  const anchorIds = await canvas
    .locator('[data-puck-component$="--anchor"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-puck-component") ?? ""));
  expect(anchorIds.length, "at least one anchor in the canvas").toBeGreaterThan(0);
  const presetAnchors = anchorIds.filter((id) => /Preset-/.test(id));
  expect(presetAnchors.length, `anchors hosted by presets: ${anchorIds.join(", ")}`).toBeGreaterThan(0);

  // componentOverlay returns an empty fragment for anchors: no overlay node at all.
  await expect(
    canvas.locator('[data-puck-component$="--anchor"] [class*="DraggableComponent-overlay"]'),
  ).toHaveCount(0);

  // Hovering an anchor must not raise Puck's hover chrome either.
  const firstAnchor = canvas.locator('[data-puck-component$="--anchor"]').first();
  const box = await firstAnchor.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + Math.max(1, box.height / 2));
  await page.waitForTimeout(200);
  await expect(
    canvas.locator('[data-puck-component$="--anchor"] [class*="DraggableComponent-actionsOverlay"]'),
  ).toHaveCount(0);

  // No setData thrash on load: the console must not carry Puck's warning.
  const warnings: string[] = [];
  page.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));
  await page.waitForTimeout(1500);
  expect(warnings.filter((w) => /setData is expensive/i.test(w))).toEqual([]);
});

test("item 14: left and right panel sections transition their height", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openEditorWithDraft(page, "Editorial Template");

  const shell = page.locator(SHELL);
  // Pin the trigger by index: a `[aria-expanded="false"]` locator would
  // re-resolve to the NEXT collapsed section the moment this one opens.
  const triggers = shell.locator('[data-slot="collapsible-trigger"]:visible');
  const states = await triggers.evaluateAll((els) => els.map((el) => el.getAttribute("aria-expanded")));
  const collapsedIndex = states.indexOf("false");
  expect(collapsedIndex, `a collapsed left-panel section exists (states: ${states.join(",")})`).toBeGreaterThanOrEqual(0);
  const collapsedTrigger = triggers.nth(collapsedIndex);
  await expect(collapsedTrigger).toBeVisible();
  await collapsedTrigger.click();
  await expect(collapsedTrigger).toHaveAttribute("aria-expanded", "true");
  const panelId = await collapsedTrigger.getAttribute("aria-controls");
  expect(panelId, "Base UI wires aria-controls").toBeTruthy();
  const panel = page.locator(`[id="${panelId}"]`);
  await expect(panel).toBeVisible();
  const transition = await panel.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { property: cs.transitionProperty, duration: cs.transitionDuration, height: cs.height };
  });
  expect(transition.property, "panel transitions height").toMatch(/height/);
  expect(transition.duration, "200ms per DESIGN.md").toBe("0.2s");
  await collapsedTrigger.click();
  await expect(collapsedTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden({ timeout: 5_000 });

  // Right panel: select a block (root "Page" has flat fields, no sections), then
  // exercise a fields-panel section. Puck's overlay intercepts synthetic clicks,
  // so force the click on the first real component's top-left corner.
  const canvas = page.locator("[data-puck-preview]").first();
  const firstBlock = canvas
    .locator('[data-puck-component]:not([data-puck-component$="--anchor"])')
    .first();
  await firstBlock.waitFor({ state: "visible", timeout: 30_000 });
  await firstBlock.click({ force: true, position: { x: 8, y: 8 } });
  // A block's Content tab uses flat section headings; the collapsible
  // EditorDrawerSections sit under its Design tab.
  // The fields-panel tabs are plain buttons (not role="tab").
  const designTab = page.getByRole("button", { name: /^Design$/ }).first();
  await designTab.waitFor({ state: "visible", timeout: 15_000 });
  await designTab.click();
  const fieldTrigger = page
    .locator('[data-tour-id="properties-panel-body"] [data-slot="collapsible-trigger"]:visible')
    .first();
  await expect(fieldTrigger, "a fields-panel section exists").toBeVisible({ timeout: 15_000 });
  const wasOpen = (await fieldTrigger.getAttribute("aria-expanded")) === "true";
  await fieldTrigger.click();
  await expect(fieldTrigger).toHaveAttribute("aria-expanded", wasOpen ? "false" : "true");
  const fieldPanelId = await fieldTrigger.getAttribute("aria-controls");
  if (!wasOpen) {
    const fieldPanel = page.locator(`[id="${fieldPanelId}"]`);
    await expect(fieldPanel).toBeVisible();
    expect(await fieldPanel.evaluate((el) => getComputedStyle(el).transitionProperty)).toMatch(/height/);
  }
});

test("item 1: Puck's own chrome renders in Arabic on /ar/portfolio", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });

  // Our sidebar tab label lives at app.pageBuilder.editor.puckConfig.sidebar.outline
  // (a value search would hit the "outline" button-style option first).
  const readPath = (obj: unknown, path: string[]) =>
    path.reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], obj) as string;
  const outlinePath = ["app", "pageBuilder", "editor", "puckConfig", "sidebar", "outline"];
  expect(readPath(en, outlinePath), "en sidebar tab key resolves").toBe("Outline");
  const arOutlineTab = readPath(ar, outlinePath);
  const arOutlineHeader = (ar as { puck: { chrome: Record<string, string> } }).puck.chrome["outline-header-title"];
  const arDelete = (ar as { puck: { chrome: Record<string, string> } }).puck.chrome["action-delete"];

  await page.goto("/ar/portfolio");
  await page.locator(SHELL).waitFor({ timeout: 120_000 });
  // The "Welcome back" entry dialog mounts a beat after the shell hydrates and
  // blocks every other interaction. Wait for it properly, then take the first
  // option (continue with the last-opened draft — Editorial Template).
  // `isVisible()` never waits (its timeout option is ignored) — use waitFor.
  const entryDialog = page.getByRole("dialog").first();
  const dialogShown = await entryDialog
    .waitFor({ state: "visible", timeout: 60_000 })
    .then(() => true)
    .catch(() => false);
  if (dialogShown) {
    await entryDialog.getByRole("button").first().click();
    await entryDialog.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  }
  await page.waitForTimeout(1500);

  const outlineTab = page.locator("button[aria-pressed]").filter({ hasText: arOutlineTab }).first();
  await expect(outlineTab, `our Outline tab reads "${arOutlineTab}"`).toBeVisible({ timeout: 30_000 });
  await outlineTab.click();
  // Puck's own outline header, from the dictionary — the actual item-1 assertion.
  // The same string also labels Puck's hidden rail tab (plugin-outline) and our
  // own tab button, so require a VISIBLE instance that is not a button.
  const puckOutlineHeader = page
    .getByText(arOutlineHeader, { exact: true })
    .and(page.locator(":not(button):visible"))
    .first();
  await expect(puckOutlineHeader).toBeVisible({ timeout: 15_000 });

  // Select a block: Puck's action bar labels come from the dictionary too.
  const canvas = page.locator("[data-puck-preview]").first();
  const firstBlock = canvas
    .locator('[data-puck-component]:not([data-puck-component$="--anchor"])')
    .first();
  await firstBlock.waitFor({ state: "visible", timeout: 30_000 });
  await firstBlock.click({ force: true, position: { x: 8, y: 8 } });
  const deleteAction = page.locator(`[title="${arDelete}"], [aria-label="${arDelete}"]`).first();
  const deleteVisible = await deleteAction.isVisible({ timeout: 5_000 }).catch(() => false);
  test.info().annotations.push({ type: "note", description: `action-delete rendered as "${arDelete}": ${deleteVisible}` });

  // RTL container check: the sidebar column must not overflow horizontally.
  const overflow = await page.locator(SHELL).evaluate((el) => {
    const bad: string[] = [];
    el.querySelectorAll<HTMLElement>("aside, [data-tour-id], nav").forEach((n) => {
      if (n.scrollWidth > n.clientWidth + 2) bad.push(`${n.tagName}.${n.className.toString().slice(0, 40)} ${n.scrollWidth}>${n.clientWidth}`);
    });
    return bad;
  });
  expect(overflow, "no horizontal overflow in editor chrome under ar").toEqual([]);
  await page.screenshot({ path: `${ARTIFACT_DIR}/ar-editor-1280.png`, fullPage: false });
});

test("item 2b baseline: transferred JS for portfolio A (editorial) and B (minimal)", async ({ page, browser }) => {
  // Re-publishes the seeded workspace twice; opt in explicitly so routine runs
  // never touch the published page: MEASURE_2B=1 pnpm exec playwright test ...
  test.skip(!process.env.MEASURE_2B, "measurement only — set MEASURE_2B=1 to re-publish A/B");
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  // A = what is published now (seed: editorial template).
  const a = await measureFirstLoadJs(browser, "/w/seed-owner-demo");

  // B = publish the Minimal Template draft, measure, then restore A by
  // re-publishing the Editorial Template draft. Sandbox DB; approved.
  await openEditorWithDraft(page, "Minimal Template");
  await publishCurrent(page);
  const b = await measureFirstLoadJs(browser, "/w/seed-owner-demo");
  await openEditorWithDraft(page, "Editorial Template");
  await publishCurrent(page);
  const aAgain = await measureFirstLoadJs(browser, "/w/seed-owner-demo");

  const result = { capturedAt: new Date().toISOString(), mode: "pnpm dev (unminified)", a, b, aRestored: aAgain };
  writeFileSync(`${ARTIFACT_DIR}/item-2b-transfer.json`, JSON.stringify(result, null, 2));
  test.info().annotations.push({ type: "2b", description: JSON.stringify(result) });
  expect(a.count, "portfolio A loaded JS chunks").toBeGreaterThan(0);
  expect(b.count, "portfolio B loaded JS chunks").toBeGreaterThan(0);
});
