/**
 * Playwright spec wrapper for the email screenshot harness.
 *
 * This is intentionally placed in scripts/ (not e2e/) so it does NOT run in
 * the normal app-login-gated Playwright suite. Run it standalone:
 *
 *   pnpm exec playwright test scripts/screenshot-emails.spec.ts \
 *     --config scripts/playwright-screenshots.config.ts
 *
 * Or use the convenience alias:
 *   pnpm exec tsx scripts/screenshot-emails.ts
 *
 * Requires the render harness to have already written HTML to the temp dir.
 *   pnpm exec vitest run scripts/render-emails.test.ts
 */

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const OUT_DIR = path.join(os.tmpdir(), "gallurio-email-render");

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile",  width: 375,  height: 812 },
] as const;

const SCHEMES = ["light", "dark"] as const;

function getHtmlFiles(): string[] {
  if (!fs.existsSync(OUT_DIR)) return [];
  return fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".html"));
}

// Dynamically generate a test for each HTML × viewport × colorScheme combination.
for (const htmlFile of getHtmlFiles()) {
  const base = htmlFile.replace(/\.html$/, "");
  const filePath = path.join(OUT_DIR, htmlFile);
  const fileUrl = `file:///${filePath.replace(/\\/g, "/")}`;

  for (const vp of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      test(`${base} | ${vp.name} | ${scheme}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: scheme,
        });
        const page = await context.newPage();
        await page.goto(fileUrl, { waitUntil: "networkidle" });

        // Expand viewport to full content height
        const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
        await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, bodyHeight) });

        const pngName = `${base}--${vp.name}--${scheme}.png`;
        const pngPath = path.join(OUT_DIR, pngName);
        await page.screenshot({ path: pngPath, fullPage: true });

        // Lightweight structural assertions
        const content = await page.content();
        expect(content).toContain("<!DOCTYPE html");

        // For partner emails: accent color should appear in the rendered HTML
        if (htmlFile.startsWith("partner-")) {
          expect(content).toContain("#c05621");
        }

        // CTA button: min-height:44px present when filename ends with "-cta.html"
        // (excluding "-no-cta.html" files which contain that substring too)
        if (htmlFile.endsWith("-cta.html") && !htmlFile.endsWith("-no-cta.html")) {
          expect(content).toContain("min-height:44px");
        }

        // Dark-mode media query always present
        expect(content).toContain("prefers-color-scheme: dark");

        await context.close();

        // Verify PNG was written
        expect(fs.existsSync(pngPath)).toBe(true);
        const stat = fs.statSync(pngPath);
        expect(stat.size).toBeGreaterThan(1000); // not an empty file
      });
    }
  }
}

// Safety net: if no HTML files exist, fail loudly rather than silently pass.
test("artifact dir contains HTML files", () => {
  const files = getHtmlFiles();
  expect(files.length, `No HTML in ${OUT_DIR} — run vitest render harness first`).toBeGreaterThan(0);
});
