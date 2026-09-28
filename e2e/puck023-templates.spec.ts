import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

/**
 * Upgrade verification wave 2: every seeded template renders on the 0.23
 * canvas, and both preview paths work.
 *
 * One session, one login. Templates are switched through the in-editor drafts
 * dialog rather than by re-navigating, so this is a single editor boot for all
 * five. Editor chrome is desktop-only, so 1280px only.
 *
 * Read-only by design: nothing here publishes. The publish write path is
 * verified separately against a throwaway workspace so the shared seeded
 * portfolio other specs depend on is left intact.
 */
const TEMPLATE_DRAFTS = [
  "Editorial Template",
  "Luxury Template",
  "Modern Template",
  "Minimal Template",
  "Romantic Template",
];

test("templates render and both preview paths work on 0.23", async ({ page, context }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 900 });

  const consoleErrors: string[] = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));

  const report: Record<string, unknown> = {};

  // Boot once on the first template.
  await openEditorWithDraft(page, TEMPLATE_DRAFTS[0]);

  async function canvasSummary() {
    return page.evaluate(() => {
      const blocks = [...document.querySelectorAll("[data-puck-component]")];
      const text = (document.querySelector('[data-tour-id="canvas-viewport"]')?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim();
      return {
        blockCount: blocks.length,
        distinctTypes: new Set(
          blocks.map((b) => (b.getAttribute("data-puck-component") ?? "").replace(/-[0-9a-f-]{8,}$/, ""))
        ).size,
        textLength: text.length,
        sample: text.slice(0, 80),
      };
    });
  }

  /** Switch templates in-session via the drafts dialog. */
  async function applyDraft(name: string) {
    await page.locator('[data-tour-id="drafts"]').click();
    const apply = page.getByRole("button", { name: new RegExp(`^Apply ${name}$`, "i") });
    await apply.waitFor({ state: "visible", timeout: 20_000 });
    await apply.click();
    const discard = page.getByRole("button", { name: /^Discard$/ });
    if (await discard.isVisible({ timeout: 3_000 }).catch(() => false)) await discard.click();
    await page.getByText("Your drafts").waitFor({ state: "hidden", timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
  }

  const templates: Record<string, unknown> = {};
  for (const [i, name] of TEMPLATE_DRAFTS.entries()) {
    if (i > 0) await applyDraft(name);
    const summary = await canvasSummary();
    templates[name] = summary;
    // A template that renders nothing, or renders a single wrapper, is broken.
    expect(summary.blockCount, `${name} block count`).toBeGreaterThan(5);
    expect(summary.textLength, `${name} rendered copy`).toBeGreaterThan(40);
  }
  report.templates = templates;

  // ---- Preview tab (in-app iframe) ----
  await page.locator('[data-tour-id="preview-toggle"]').click();
  const frame = page.frameLocator("iframe").first();
  await frame.locator("body").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2_000);
  report.previewTab = await page.evaluate(() => {
    const iframe = document.querySelector("iframe") as HTMLIFrameElement | null;
    const doc = iframe?.contentDocument;
    const body = (doc?.body?.textContent ?? "").replace(/\s+/g, " ").trim();
    return {
      hasIframe: !!iframe,
      src: iframe?.getAttribute("src")?.slice(0, 80) ?? null,
      textLength: body.length,
      // A Next error overlay is served at the same URL, so assert on content.
      looksLikeErrorOverlay: /Unhandled Runtime Error|Build Error|Call Stack/i.test(body),
    };
  });
  expect((report.previewTab as { textLength: number }).textLength).toBeGreaterThan(40);
  expect((report.previewTab as { looksLikeErrorOverlay: boolean }).looksLikeErrorOverlay).toBe(false);

  // Back to edit mode so the new-tab control is available again.
  await page.locator('[data-tour-id="preview-toggle"]').click();
  await page.waitForTimeout(1_500);

  // ---- Preview in a new tab ----
  const popupPromise = context.waitForEvent("page", { timeout: 30_000 });
  await page.getByRole("button", { name: /open in new tab/i }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await popup.waitForTimeout(3_000);
  report.previewNewTab = await popup.evaluate(() => {
    const body = (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
    return {
      url: location.pathname + location.search.slice(0, 60),
      textLength: body.length,
      looksLikeErrorOverlay: /Unhandled Runtime Error|Build Error|Call Stack/i.test(body),
    };
  });
  await popup.close();
  expect((report.previewNewTab as { textLength: number }).textLength).toBeGreaterThan(40);
  expect((report.previewNewTab as { looksLikeErrorOverlay: boolean }).looksLikeErrorOverlay).toBe(
    false
  );

  report.consoleErrors = consoleErrors.slice(0, 20);
  const fs = await import("node:fs");
  fs.mkdirSync("e2e/.artifacts", { recursive: true });
  fs.writeFileSync(
    "e2e/.artifacts/puck023-templates-report.json",
    JSON.stringify(report, null, 2)
  );
});
