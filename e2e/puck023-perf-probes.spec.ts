import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { measureFirstLoadJs, openEditorWithDraft } from "./helpers";

/**
 * Run 1 of the perf wave (docs/portfolio/puck-023-followups.md, "Session
 * 2026-09-26 — perf wave"): the
 * "before" numbers and the geometry probes captured BEFORE any app change.
 * Every test here RECORDS — it writes a JSON artifact and annotates the
 * report — and asserts only that it observed something. The numbers land in
 * the scope doc's baseline table by hand; artifacts are observations, never
 * verdicts.
 *
 * One session, one login, 1280 unless the probe is about 375. Read-only:
 * nothing is saved or published.
 */

const SHELL = "[data-testid='portfolio-editor-shell']";
const ARTIFACT_DIR = "e2e/.artifacts/perf-probes";
const OWNER_STATE = "e2e/.auth/owner.json";

function record(name: string, data: unknown) {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(`${ARTIFACT_DIR}/${name}.json`, JSON.stringify(data, null, 2));
  test.info().annotations.push({ type: name, description: JSON.stringify(data) });
}

/** Zone switcher button, scoped to the visible toolbar copy. */
function zoneButton(page: Page, name: "Home" | "Gallery") {
  return page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
}

test("2a baseline: transferred JS on first load of /portfolio", async ({ browser }) => {
  test.setTimeout(240_000);
  const editor = await measureFirstLoadJs(browser, "/portfolio", { storageState: OWNER_STATE });
  const preview = await measureFirstLoadJs(browser, "/en/portfolio-preview?zone=home", { storageState: OWNER_STATE });
  record("2a-first-load", { capturedAt: new Date().toISOString(), mode: "pnpm dev (unminified)", editor, preview });
  expect(editor.count, "editor loaded JS chunks").toBeGreaterThan(0);
});

test("item 8 baseline: /api/portfolio/gallery requests over the picker script", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  // Minimal Template: its Gallery zone holds one GalleryMasonry (the seed has
  // no GalleryGrid — see the plan's finding #9). The recipe's "second Gallery
  // block" is approximated by leaving and re-entering the Gallery zone, which
  // remounts the fields panel and therefore a fresh picker instance.
  await openEditorWithDraft(page, "Minimal Template");

  const steps: Array<{ step: string; requests: string[] }> = [];
  let current: string[] = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith("/api/portfolio/gallery")) current.push(`${u.pathname}${u.search}`);
  });
  const mark = (step: string) => {
    steps.push({ step, requests: current });
    current = [];
  };

  // Minimal's masonry lanes hold manual Image blocks ("Pick an image" prompt
  // in the canvas). Selecting the nth tile shows its MediaField in the fields
  // panel, whose "Choose photos" button opens the MediaPicker.
  const openPicker = async (tileIndex: number) => {
    const tile = page.getByText("Pick an image", { exact: false }).filter({ visible: true }).nth(tileIndex);
    await expect(tile).toBeVisible({ timeout: 15_000 });
    await tile.click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /^Choose photo$/ }).filter({ visible: true }).first().click();
    await page.getByRole("dialog").filter({ hasText: "All photos" }).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(700);
  };
  const openCollection = async (name: string) => {
    await page.getByRole("button", { name, exact: true }).filter({ visible: true }).first().click();
    await page.getByRole("button", { name: "Back to collections" }).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(900);
  };
  const back = async () => {
    await page.getByRole("button", { name: "Back to collections" }).click();
    await page.waitForTimeout(500);
  };

  await zoneButton(page, "Gallery").click();
  await page.waitForTimeout(1_000);
  mark("switch to Gallery zone");
  await openPicker(0);
  mark("open picker (block 1)");
  await openCollection("Weddings");
  mark("open Weddings");
  await back();
  await openCollection("Editorial");
  mark("switch to Editorial");
  await back();
  await openCollection("Weddings");
  mark("switch back to Weddings");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  mark("close picker");
  await openPicker(1);
  mark("open picker (block 2)");
  await openCollection("Weddings");
  mark("open Weddings again");

  const total = steps.reduce((n, s) => n + s.requests.length, 0);
  const seen = new Map<string, number>();
  for (const s of steps) for (const r of s.requests) seen.set(r, (seen.get(r) ?? 0) + 1);
  const duplicates = [...seen].filter(([, n]) => n > 1).map(([url, n]) => ({ url, n }));
  record("item-8-picker-requests", { capturedAt: new Date().toISOString(), total, duplicates, steps });
  expect(total, "the script issued gallery requests").toBeGreaterThan(0);
});

test("375 probe: header/canvas geometry after dismissing the mobile banner", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/portfolio");
  await page.locator(SHELL).waitFor({ timeout: 120_000 });
  const continueEditing = page.getByRole("button", { name: "Continue where you left off" });
  if (await continueEditing.waitFor({ state: "visible", timeout: 10_000 }).then(() => true, () => false)) {
    await continueEditing.click();
  }
  const skipGuide = page.getByRole("button", { name: "Skip Guide" });
  if (await skipGuide.waitFor({ state: "visible", timeout: 3_000 }).then(() => true, () => false)) {
    await skipGuide.click();
    await page.getByRole("button", { name: "Skip Guide" }).click();
  }
  const continueAnyway = page.getByRole("button", { name: "Continue anyway" });
  if (await continueAnyway.waitFor({ state: "visible", timeout: 5_000 }).then(() => true, () => false)) {
    await continueAnyway.click();
  }
  await page.waitForTimeout(1_500);

  const geometry = await page.evaluate(() => {
    const rect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const layout = document.querySelector('[class*="_PuckLayout_"]');
    const inner = document.querySelector('[class*="_PuckLayout-inner_"]');
    const header = document.querySelector('[class*="_PuckLayout-header_"]');
    const ourHeader = document.querySelector("[data-testid='portfolio-editor-shell'] header");
    const canvas = document.querySelector("[data-puck-preview]");
    const trigger = document.querySelector('[data-testid="canvas-controls-trigger"]');
    const tr = trigger?.getBoundingClientRect();
    const hit = tr ? document.elementFromPoint(tr.x + tr.width / 2, tr.y + tr.height / 2) : null;
    const describe = (el: Element | null) =>
      el ? `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}[${(el.getAttribute("data-puck-component") ?? el.getAttribute("data-testid") ?? el.className.toString().slice(0, 60))}]` : null;
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      layoutClasses: layout?.className.toString() ?? null,
      innerGridRows: inner ? getComputedStyle(inner).gridTemplateRows : null,
      puckHeader: { rect: rect(header), overflow: header ? getComputedStyle(header).overflow : null },
      ourHeader: rect(ourHeader),
      canvas: rect(canvas),
      trigger: rect(trigger),
      elementAtTriggerCenter: describe(hit),
      triggerIsHit: hit === trigger || (hit ? trigger?.contains(hit) ?? false : false),
    };
  });
  await page.screenshot({ path: `${ARTIFACT_DIR}/375-editor.png` });
  record("375-geometry", geometry);
  expect(geometry.trigger, "canvas-controls-trigger exists in the DOM").not.toBeNull();
});

test("scroll probe: which ancestor scrolls the editor at 1280", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openEditorWithDraft(page, "Minimal Template");

  const read = () =>
    page.evaluate(() => {
      const pick = (sel: string) => document.querySelector(sel) as HTMLElement | null;
      const main = pick("main");
      const wrapper = main?.firstElementChild as HTMLElement | null;
      const shell = pick("[data-testid='portfolio-editor-shell']");
      const layout = pick('[class*="_PuckLayout_"]');
      const sidebars = Array.from(document.querySelectorAll<HTMLElement>('[class*="_Sidebar_"]'));
      // Every ancestor between the Puck layout and <body>: the 81px overflow
      // seen in Run 1 was scrolled by an element the fixed list above missed.
      const chain: Array<{ tag: string; cls: string; clientHeight: number; scrollHeight: number; scrollTop: number; overflowY: string; height: number }> = [];
      for (let node = layout?.parentElement ?? null; node && node !== document.body; node = node.parentElement) {
        chain.push({
          tag: node.tagName.toLowerCase(),
          cls: (node.getAttribute("class") ?? node.getAttribute("data-tour-id") ?? node.getAttribute("data-testid") ?? "").toString().slice(0, 70),
          clientHeight: node.clientHeight,
          scrollHeight: node.scrollHeight,
          scrollTop: node.scrollTop,
          overflowY: getComputedStyle(node).overflowY,
          height: Math.round(node.getBoundingClientRect().height),
        });
      }
      const box = (el: HTMLElement | null) =>
        el
          ? {
              clientHeight: el.clientHeight,
              scrollHeight: el.scrollHeight,
              scrollTop: el.scrollTop,
              overflowY: getComputedStyle(el).overflowY,
              top: Math.round(el.getBoundingClientRect().top),
              height: Math.round(el.getBoundingClientRect().height),
            }
          : null;
      return {
        windowScrollY: window.scrollY,
        innerHeight: window.innerHeight,
        main: box(main),
        wrapper: { className: wrapper?.className ?? null, ...box(wrapper) },
        shell: box(shell),
        layout: box(layout),
        sidebars: sidebars.map((s) => ({ className: s.className.toString().slice(0, 80), ...box(s) })),
        chain,
      };
    });

  const before = await read();
  const canvas = page.locator("[data-puck-preview]").first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(200, box.height / 2));
    await page.mouse.wheel(0, 800);
  }
  await page.waitForTimeout(500);
  const afterCanvasWheel = await read();
  const left = page.locator('[class*="_Sidebar--left_"]').first();
  const lbox = await left.boundingBox();
  if (lbox) {
    await page.mouse.move(lbox.x + lbox.width / 2, lbox.y + lbox.height / 2);
    await page.mouse.wheel(0, 800);
  }
  await page.waitForTimeout(500);
  const afterSidebarWheel = await read();
  record("scroll-ancestors", { before, afterCanvasWheel, afterSidebarWheel });
  expect(before.layout, "Puck layout root found").not.toBeNull();
});

test("unique-key capture: console errors on the published home + gallery pages", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  const messages: Array<{ url: string; type: string; text: string }> = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") messages.push({ url: page.url(), type: m.type(), text: m.text() });
  });
  for (const url of ["/w/seed-owner-demo", "/w/seed-owner-demo/gallery"]) {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1_500);
  }
  await context.close();
  const keyWarnings = messages.filter((m) => /unique "key"|unique key/i.test(m.text));
  record("unique-key-console", { capturedAt: new Date().toISOString(), keyWarnings, all: messages });
  expect(messages.length, "console listener attached").toBeGreaterThanOrEqual(0);
});
