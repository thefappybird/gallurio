import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import en from "../messages/en.json";
import fil from "../messages/fil.json";
import id from "../messages/id.json";
import ar from "../messages/ar.json";
import th from "../messages/th.json";

/**
 * Run 4 of the perf wave (docs/portfolio/puck-023-perf-wave-plan.md) — the
 * public-surface sweep after item 3 (next/image + Cloudflare loader,
 * modal-list virtualization). One consolidated file per the batching rule:
 *
 *  - /w/seed-owner-demo and /gallery at 375 / 768 / 1280 × light + dark:
 *    no horizontal overflow, no runtime error overlay, every portfolio
 *    image carries srcset + sizes (next/image landed), body text reads
 *    against its background, DOM node count recorded.
 *  - the 5-locale axis through the preview route at 375 (the published
 *    page has one formLocale; the preview route takes it as a query):
 *    the locale's own nav string renders (catches mojibake), no overflow.
 *  - ar: the featured-work popup opens with dir="rtl" and stays inside
 *    the viewport.
 *
 * Read-only: nothing is saved or published.
 */

const SLUG = "seed-owner-demo";
const ARTIFACT_DIR = "e2e/.artifacts/wave4";
const BREAKPOINTS = [375, 768, 1280] as const;
const SCHEMES = ["light", "dark"] as const;
const LOCALES = { en, fil, id, ar, th } as const;

type Catalog = { publicPage: { nav: { home: string; gallery: string } } };

function record(name: string, data: unknown) {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(`${ARTIFACT_DIR}/${name}.json`, JSON.stringify(data, null, 2));
  test.info().annotations.push({ type: name, description: JSON.stringify(data).slice(0, 1500) });
}

/** Rasterized sRGB of a CSS color (computed styles resolve to oklab here). */
async function pageMetrics(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const rgb = (c: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el: Element | null) => {
      let node = el as HTMLElement | null;
      while (node) {
        const c = rgb(getComputedStyle(node).backgroundColor);
        if (c.a > 0.99) return c;
        node = node.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    const text = Array.from(document.querySelectorAll<HTMLElement>("main p, main h1, main h2, main h3, main a"))
      .find((n) => (n.textContent ?? "").trim().length > 3 && n.getClientRects().length > 0);
    const fg = text ? rgb(getComputedStyle(text).color) : null;
    const bg = text ? bgOf(text) : null;
    const contrast = fg && bg ? (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05) : null;
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("[data-block] img"));
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      nodeCount: document.getElementsByTagName("*").length,
      bodyChars: (document.body.innerText ?? "").length,
      hasErrorOverlay: /Unhandled Runtime Error|Application error/i.test(document.body.innerText ?? ""),
      images: {
        total: imgs.length,
        withSrcset: imgs.filter((i) => i.hasAttribute("srcset")).length,
        withSizes: imgs.filter((i) => i.hasAttribute("sizes")).length,
        onImageDelivery: imgs.filter((i) => /imagedelivery\.net/.test(i.currentSrc || i.src)).length,
        broken: imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.getClientRects().length > 0).map((i) => i.src.slice(0, 120)),
      },
      sampleText: text?.textContent?.trim().slice(0, 40) ?? null,
      contrast,
    };
  });
}

for (const scheme of SCHEMES) {
  for (const width of BREAKPOINTS) {
    test(`public ${scheme} @ ${width}px: home + gallery render, no overflow, images optimized`, async ({ browser }) => {
      test.setTimeout(180_000);
      const context = await browser.newContext({ colorScheme: scheme, viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

      const results: Record<string, unknown> = {};
      for (const path of [`/w/${SLUG}`, `/w/${SLUG}/gallery`]) {
        await page.goto(path, { waitUntil: "networkidle" });
        await page.waitForTimeout(800);
        const m = await pageMetrics(page);
        results[path] = m;
        await page.screenshot({ path: `${ARTIFACT_DIR}/${scheme}-${width}${path.replace(/\//g, "_")}.png`, fullPage: false });
        expect(m.hasErrorOverlay, `${path} shows no error overlay`).toBe(false);
        expect(m.bodyChars, `${path} rendered real content`).toBeGreaterThan(200);
        expect(m.scrollWidth, `${path} no horizontal overflow at ${width}`).toBeLessThanOrEqual(m.clientWidth + 1);
        expect(m.images.broken, `${path} no broken visible images`).toEqual([]);
        if (m.images.total > 0) {
          expect(m.images.withSrcset, `${path} portfolio images carry srcset`).toBe(m.images.total);
          expect(m.images.withSizes, `${path} portfolio images carry sizes`).toBe(m.images.total);
        }
        if (m.contrast !== null) {
          expect(m.contrast, `${path} body text reads against its background (${scheme})`).toBeGreaterThanOrEqual(3);
        }
      }
      results.consoleErrors = errors.filter((e) => !/favicon|preload/i.test(e));
      record(`public-${scheme}-${width}`, results);
      expect(results.consoleErrors, "no console errors on the public pages").toEqual([]);
      await context.close();
    });
  }
}

test("preview route: 5 formLocales render their own chrome at 375, ar popup is RTL and in-bounds", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 375, height: 812 });
  const out: Record<string, unknown> = {};
  for (const [locale, catalog] of Object.entries(LOCALES) as Array<[string, Catalog]>) {
    await page.goto(`/en/portfolio-preview?zone=home&formLocale=${locale}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const navHome = catalog.publicPage.nav.home;
    await expect(page.getByText(navHome, { exact: true }).first(), `${locale}: nav "home" string renders`).toBeVisible({ timeout: 15_000 });
    const m = await pageMetrics(page);
    out[locale] = { navHome, overflow: m.scrollWidth - m.clientWidth, nodeCount: m.nodeCount };
    expect(m.scrollWidth, `${locale}: no horizontal overflow at 375`).toBeLessThanOrEqual(m.clientWidth + 1);
  }

  // ar: open the seeded featured-work popup from the preview and check its
  // direction + geometry (the RTL surface is the popup, not the page).
  await page.goto(`/en/portfolio-preview?zone=gallery&formLocale=ar&formDir=rtl`, { waitUntil: "networkidle" });
  const tile = page.locator("[data-featured-tile]").first();
  const hasTile = await tile.waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
  if (hasTile) {
    await tile.click();
    const shell = page.locator("[data-popup-shell]");
    await expect(shell).toBeVisible({ timeout: 15_000 });
    await expect(shell).toHaveAttribute("dir", "rtl");
    const box = await shell.boundingBox();
    expect(box, "popup shell has a box").not.toBeNull();
    expect(box!.x, "popup starts inside the viewport").toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width, "popup ends inside the viewport").toBeLessThanOrEqual(376);
    out.arPopup = box;
  } else {
    out.arPopup = "no featured tile in the published gallery zone — popup geometry not exercised";
  }
  record("preview-locales", out);
});
