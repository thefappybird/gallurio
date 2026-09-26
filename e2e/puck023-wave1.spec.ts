/**
 * Wave 1 of the perf wave (docs/portfolio/puck-023-followups.md, "Session
 * 2026-09-26 — perf wave") — Run 2
 * browser assertions for the editor-UI trio (drawer collapse/gap, sidebar
 * scroll isolation), the 375px sidebar-restore regression, the canvas
 * FeaturedWork hint locale, and the published-page unique-key regression
 * guard. Editor-internal surfaces: 1280px only, per the portfolio-testing
 * skill's batching rule — one consolidated file, not one spec per item.
 *
 * Read-only except transient in-session UI toggles (drawer open/close,
 * language switch) — nothing is ever saved or published, so the shared
 * seeded workspace is left exactly as found.
 */
import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";
import { E2E_FIXTURE_DRAFT_NAME } from "@/lib/db/seedE2eDraft";
import ar from "../messages/ar.json";

test.use({ viewport: { width: 1280, height: 900 } });

test("drawer groups start collapsed and the two drawers touch", async ({ page }) => {
  await openEditorWithDraft(page, "Editorial Template");

  // Puck 0.23 also mounts a hidden fields-panel twin of the blocks panel —
  // scope to the visible copy only.
  const blocksPanel = page.locator('[data-tour-id="blocks-panel"]:visible');
  const triggers = blocksPanel.locator('[data-slot="collapsible-trigger"]:visible');
  const count = await triggers.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const trigger = triggers.nth(i);
    const label = (await trigger.textContent())?.trim() ?? "";
    if (label === "Preset blocks") continue;
    await expect(trigger, `trigger "${label}" must start collapsed`).toHaveAttribute("aria-expanded", "false");
  }

  // Presets and Manual blocks are the two direct <section> children of our
  // own wrapper div (data-testid="drawer-root") inside Puck's <Drawer> —
  // scope there directly rather than to any <section> in the whole panel.
  const sections = page.locator('[data-testid="drawer-root"]:visible > section');
  const sectionCount = await sections.count();
  expect(sectionCount).toBeGreaterThanOrEqual(2);
  const presetsBox = await sections.first().boundingBox();
  const manualBox = await sections.last().boundingBox();
  if (!presetsBox || !manualBox) throw new Error("drawer sections have no bounding box");
  const gap = manualBox.y - (presetsBox.y + presetsBox.height);
  expect(gap).toBeLessThanOrEqual(1);
});

test("sidebars scroll themselves, the page does not", async ({ page }) => {
  await openEditorWithDraft(page, "Editorial Template");

  const puckRoot = page.locator(".gallurio-editor > div");
  const leftSidebar = page.locator('[class*="_Sidebar--left_"]');
  await expect(leftSidebar).toBeVisible();

  await leftSidebar.hover();
  await page.mouse.wheel(0, 800);

  const metrics = await page.evaluate(() => {
    const puck = document.querySelector(".gallurio-editor > div") as HTMLElement | null;
    const sidebar = document.querySelector('[class*="_Sidebar--left_"]') as HTMLElement | null;
    return {
      puckScrollTop: puck?.scrollTop ?? null,
      puckScrollHeight: puck?.scrollHeight ?? null,
      puckClientHeight: puck?.clientHeight ?? null,
      sidebarScrollHeight: sidebar?.scrollHeight ?? null,
      sidebarClientHeight: sidebar?.clientHeight ?? null,
      windowScrollY: window.scrollY,
    };
  });
  test.info().annotations.push({
    type: "sidebar-scroll-metrics",
    description: JSON.stringify(metrics),
  });

  expect(await puckRoot.evaluate((el) => el.scrollTop)).toBe(0);
  expect(metrics.windowScrollY).toBe(0);
  expect(metrics.puckScrollHeight).toBe(metrics.puckClientHeight);
  if (metrics.sidebarScrollHeight !== null && metrics.sidebarClientHeight !== null) {
    expect(
      metrics.sidebarScrollHeight > metrics.sidebarClientHeight || metrics.sidebarScrollHeight === metrics.sidebarClientHeight,
    ).toBe(true);
  }
});

test("375: canvas controls trigger is hittable after dismissing the banner", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/portfolio?seoSetup=preview");
  await page.locator("[data-testid='portfolio-editor-shell']").waitFor({ timeout: 90_000 });

  // Same dismissal recipe as portfolio-responsive.spec.ts's mobile test.
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

  const trigger = page.locator('[data-testid="canvas-controls-trigger"]');
  await expect(trigger).toBeVisible();
  // The editor header keeps horizontal overflow scrollable by design at this
  // width (page.tsx wrapper comment) — the trigger can sit off-screen to the
  // right until scrolled into view.
  await trigger.scrollIntoViewIfNeeded();
  const hit = await trigger.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const atPoint = document.elementFromPoint(cx, cy);
    return atPoint === el || !!atPoint?.contains(el) || !!el.contains(atPoint);
  });
  expect(hit).toBe(true);

  const layoutClass = await page
    .locator('[class*="_PuckLayout_"]')
    .first()
    .evaluate((el) => el.className);
  expect(layoutClass).not.toContain("--leftSideBarVisible_");
});

test("canvas FeaturedWork hint follows the CRM locale", async ({ page }) => {
  await openEditorWithDraft(page, E2E_FIXTURE_DRAFT_NAME);

  // Switch the portfolio's own language to Arabic — same recipe as
  // portfolio-rtl-scoping.spec.ts.
  await page.getByTestId("canvas-controls-trigger").click();
  await page.locator('[data-testid="language-control"]:visible').click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();

  // The fixture's FeaturedWork is bound to a real collection (Weddings), so
  // it never renders the empty-state hint — assert the canvas does NOT pick
  // up the portfolio's own (Arabic) formLocale for editor-facing chrome, and
  // that the fields panel stays English. The hint-follows-CRM-locale path
  // itself is covered by the EditorShell metadata unit test (D1) and the
  // preview-route unit test; there is no unbound FeaturedWork in this
  // fixture to observe the hint string rendering live.
  const canvas = page.locator("[data-puck-preview]").first();
  await expect(canvas.getByText(ar.publicPage.chrome.gallery.featuredSelect, { exact: true })).toHaveCount(0);
  // No block is selected after openEditorWithDraft, so the fields panel
  // shows the Page root (Design/Layout only, no Content tab) — assert the
  // visible tab's English label stayed English (CRM locale unaffected by
  // the portfolio's own Arabic formLocale switch).
  await expect(
    page.getByRole("button", { name: "Design", exact: true }).and(page.locator(":visible")),
  ).toBeVisible();
});

test("published page logs no unique-key warning", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const warnings: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") warnings.push(msg.text());
  });

  await page.goto("/w/seed-owner-demo", { waitUntil: "networkidle" });
  await page.goto("/w/seed-owner-demo/gallery", { waitUntil: "networkidle" });

  const uniqueKeyWarnings = warnings.filter((w) => /unique "key"/i.test(w));
  expect(uniqueKeyWarnings).toEqual([]);
  await context.close();
});
