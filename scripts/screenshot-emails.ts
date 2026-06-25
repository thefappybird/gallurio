/**
 * Email screenshot harness — driven by Playwright CLI.
 *
 * For each HTML file in the render artifact dir, takes 4 screenshots:
 *   - desktop (1280px) × light
 *   - desktop (1280px) × dark
 *   - mobile  (375px)  × light
 *   - mobile  (375px)  × dark
 *
 * Saves PNGs alongside the HTML in the same temp dir.
 *
 * Usage (standalone — does NOT require the app to be running):
 *   pnpm exec ts-node --project tsconfig.json scripts/screenshot-emails.ts
 *   OR via the Playwright test runner (see scripts/screenshot-emails.spec.ts).
 */

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const OUT_DIR = path.join(os.tmpdir(), "gallurio-email-render");

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.error(`[screenshot] Artifact dir not found: ${OUT_DIR}`);
    console.error("[screenshot] Run the render harness first: pnpm exec vitest run scripts/render-emails.test.ts");
    process.exit(1);
  }

  const htmlFiles = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".html"));
  if (!htmlFiles.length) {
    console.error("[screenshot] No HTML files found in", OUT_DIR);
    process.exit(1);
  }

  console.log(`[screenshot] Screenshotting ${htmlFiles.length} HTML files → ${OUT_DIR}`);

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "desktop", width: 1280, height: 900 },
    { name: "mobile",  width: 375,  height: 812 },
  ] as const;

  const schemes = ["light", "dark"] as const;

  let count = 0;
  const errors: string[] = [];

  for (const htmlFile of htmlFiles) {
    const filePath = path.join(OUT_DIR, htmlFile);
    const fileUrl = `file:///${filePath.replace(/\\/g, "/")}`;
    const base = htmlFile.replace(/\.html$/, "");

    for (const vp of viewports) {
      for (const scheme of schemes) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: scheme,
        });
        const page = await context.newPage();

        try {
          await page.goto(fileUrl, { waitUntil: "networkidle" });
          // Scroll to full height so nothing is clipped
          const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
          await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, bodyHeight) });

          const pngName = `${base}--${vp.name}--${scheme}.png`;
          const pngPath = path.join(OUT_DIR, pngName);
          await page.screenshot({ path: pngPath, fullPage: true });
          count++;
        } catch (err) {
          const msg = `FAILED: ${htmlFile} ${vp.name} ${scheme} — ${String(err)}`;
          console.error("[screenshot]", msg);
          errors.push(msg);
        } finally {
          await context.close();
        }
      }
    }
  }

  await browser.close();

  console.log(`[screenshot] Done — ${count} PNGs written to ${OUT_DIR}`);
  if (errors.length) {
    console.error(`[screenshot] ${errors.length} error(s):`, errors);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[screenshot] Fatal:", err);
  process.exit(1);
});
