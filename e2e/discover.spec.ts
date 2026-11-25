import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Discover: one batched verification run.
 * Public surfaces (banner, /discover grid + modal, header) at 375/768/1280 x
 * 5 locales x light/dark; in-app chrome (settings toggle, publish dialog) at
 * 1280 only, read-only (never submits a publish). Requires `pnpm seed`.
 */

const LOCALES = ["en", "fil", "id", "ar", "th"] as const;
const WIDTHS = [375, 768, 1280] as const;
const THEMES = ["light", "dark"] as const;
const SHOTS = path.join(process.cwd(), ".driver-shots", "discover");

type Messages = { marketing: { discover: { headline: string; banner: { title: string; pause: string; resume: string } } } };
const msgs = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(path.join(process.cwd(), "messages", `${l}.json`), "utf8")) as Messages]),
) as Record<(typeof LOCALES)[number], Messages>;

const prefix = (l: string) => (l === "en" ? "" : `/${l}`);

async function noHorizontalOverflow(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, "horizontal overflow px").toBeLessThanOrEqual(1);
}

test.describe("public discover surfaces", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.setTimeout(30 * 60_000);

  test("banner, grid, modal and header across locales, widths and themes", async ({ browser }) => {
    const shoot = (l: string, w: number, th: string) =>
      (l === "en" || l === "ar") && (w === 375 || w === 1280);

    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme);
        const page = await ctx.newPage();

        for (const locale of LOCALES) {
          const m = msgs[locale].marketing.discover;
          const tag = `${locale}-${width}-${theme}`;

          // --- Home banner ---
          await page.goto(`${prefix(locale)}/`, { waitUntil: "domcontentloaded" });
          const banner = page.locator('section[aria-labelledby="discover-banner-title"]');
          await expect(banner, `banner ${tag}`).toBeVisible({ timeout: 30_000 });
          await expect(banner.locator("h2")).toHaveText(m.banner.title);
          await expect(banner.locator(".dsc-row")).toHaveCount(3);
          const pause = banner.getByRole("button", { name: m.banner.pause });
          if (await pause.isVisible()) {
            await pause.click();
            await expect(banner.getByRole("button", { name: m.banner.resume })).toBeVisible();
            await banner.getByRole("button", { name: m.banner.resume }).click();
          }
          await noHorizontalOverflow(page);
          if (shoot(locale, width, theme)) {
            await banner.scrollIntoViewIfNeeded();
            await banner.screenshot({ path: path.join(SHOTS, `banner-${tag}.png`) });
          }

          // --- Header order (desktop nav only renders >= xl) ---
          if (width === 1280) {
            const nav = page.locator('header nav[aria-label="Marketing"]').first();
            const hrefs = await nav.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
            const norm = hrefs.map((h) => h.replace(/^\/(fil|id|ar|th)(?=\/|$)/, "") || "/");
            expect(norm, `nav order ${tag}`).toEqual(["/discover", "/about", "/pricing", "/portfolio-maker-demo"]);
            const headerHrefs = await page.locator("header a").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
            expect(headerHrefs.some((h) => /\/(resources|compare)$/.test(h)), `no resources/compare ${tag}`).toBe(false);
          }

          // --- /discover grid ---
          await page.goto(`${prefix(locale)}/discover`, { waitUntil: "domcontentloaded" });
          await expect(page.locator("h1")).toHaveText(m.headline);
          const tiles = page.locator('main a[href^="?p="]');
          await expect(tiles.first()).toBeVisible({ timeout: 30_000 });
          expect(await tiles.count(), `tile count ${tag}`).toBeGreaterThanOrEqual(8);
          await expect(page.locator('a[href="?p=sample-sable-thread"]'), "opted-out sample hidden").toHaveCount(0);
          await noHorizontalOverflow(page);
          if (shoot(locale, width, theme)) await page.screenshot({ path: path.join(SHOTS, `grid-${tag}.png`) });

          // Hover overlay on desktop (pointer devices only)
          if (width === 1280 && (locale === "en" || locale === "ar")) {
            await tiles.first().hover();
            await page.waitForTimeout(300);
            await tiles.first().screenshot({ path: path.join(SHOTS, `tile-hover-${tag}.png`) });
          }

          // --- Modal ---
          await tiles.first().click();
          const dialog = page.locator('dialog[aria-labelledby="discover-dialog-name"]');
          await expect(dialog, `dialog ${tag}`).toBeVisible({ timeout: 20_000 });
          const visit = dialog.locator('a[target="_blank"]').first();
          await expect(visit).toHaveAttribute("rel", /noopener/);
          expect(page.url(), `deep link ${tag}`).toContain("p=");
          // Dialog must fit the viewport (bottom sheet on phones).
          const box = await dialog.boundingBox();
          expect(box && box.x >= -1 && box.x + box.width <= width + 1, `dialog in viewport ${tag}`).toBe(true);
          if (shoot(locale, width, theme)) await page.screenshot({ path: path.join(SHOTS, `modal-${tag}.png`) });
          await page.keyboard.press("Escape");
          await expect(dialog).toBeHidden();
        }
        await ctx.close();
      }
    }
  });

  test("deep link to an unlisted portfolio renders the grid without a dialog", async ({ page }) => {
    await page.goto("/discover?p=sample-sable-thread");
    await expect(page.locator('main a[href^="?p="]').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('dialog[aria-labelledby="discover-dialog-name"]')).toBeHidden();
  });
});

test.describe("in-app listing controls (1280, read-only)", () => {
  test.setTimeout(5 * 60_000);

  test("settings toggle and publish dialog warning", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    // Settings: main seeded workspace has discover unset -> ticked by default.
    await page.goto("/settings/public-page");
    const sw = page.getByRole("switch", { name: "List on Discover" });
    await expect(sw).toBeVisible({ timeout: 60_000 });
    await expect(sw).toBeChecked();
    await sw.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "settings-toggle-1280.png") });

    // Publish dialog: published workspace + unset saved state => warning + relabel.
    await page.goto("/portfolio");
    // First-visit chooser ("Welcome back") blocks the editor; resume the latest edits.
    const resume = page.getByRole("button", { name: /Continue where you left off/ });
    await resume.waitFor({ timeout: 60_000 }).then(() => resume.click()).catch(() => {});
    const publish = page.getByRole("button", { name: /^Publish/ }).first();
    await expect(publish).toBeVisible({ timeout: 90_000 });
    await publish.click();
    // Restored local edits trigger a "Save your changes?" prompt; Discard drops only
    // this test browser's local copy (no DB write) and continues to the publish dialog.
    const discard = page.getByRole("button", { name: "Discard" });
    await discard.waitFor({ timeout: 5_000 }).then(() => discard.click()).catch(() => {});
    const status = page.getByRole("status").filter({ hasText: "Discover" });
    await expect(status).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Publish and list on Discover" })).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, "publish-dialog-1280.png") });
    // Read-only: close without publishing.
    await page.keyboard.press("Escape");
  });
});
