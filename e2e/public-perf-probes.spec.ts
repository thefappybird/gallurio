import { test, expect, type Browser } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * First-load weight of the public surfaces (marketing + tenant portfolio),
 * captured before and after the public-surfaces perf pass
 * (docs/gallurio.com-Coverage-2026-09-17/plan-of-action.md). Every test here
 * RECORDS — it writes a JSON artifact and annotates the report — and asserts
 * only that it observed something. Anonymous visitor, no login, read-only.
 */

const ARTIFACT_DIR = "e2e/.artifacts/public-perf-probes";
const TAG = process.env.PROBE_TAG ?? "run";

const PAGES = ["/", "/fil", "/pricing", "/w/seed-owner-demo", "/w/seed-owner-demo/gallery"];

function record(name: string, data: unknown) {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(`${ARTIFACT_DIR}/${TAG}-${name}.json`, JSON.stringify(data, null, 2));
  test.info().annotations.push({ type: name, description: JSON.stringify(data) });
}

async function probe(browser: Browser, path: string, colorScheme: "light" | "dark") {
  // Explicitly anonymous: contexts created from the `browser` fixture inherit
  // the project's owner storageState, and a signed-in owner is redirected
  // from the landing page to the dashboard.
  const context = await browser.newContext({
    colorScheme,
    viewport: { width: 375, height: 812 },
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  const js = { count: 0, bytes: 0 };
  const images: Array<{ url: string; bytes: number }> = [];
  const pending: Promise<void>[] = [];
  page.on("response", (res) => {
    const u = res.url();
    const isJs = /\/_next\/static\/.*\.js(\?|$)/.test(u);
    const isImage = res.request().resourceType() === "image";
    if (!isJs && !isImage) return;
    pending.push(
      res
        .request()
        .sizes()
        .then((sizes) => {
          if (isJs) {
            js.count += 1;
            js.bytes += sizes.responseBodySize;
          } else {
            images.push({ url: u.slice(0, 160), bytes: sizes.responseBodySize });
          }
        })
        .catch(() => {}),
    );
  });
  const response = await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await Promise.all(pending);
  const finalUrl = page.url();
  const html = (await response?.text()) ?? "";
  const rscPayloadBytes = await page.evaluate(() =>
    Array.from(document.querySelectorAll("script:not([src])"))
      .map((s) => s.textContent ?? "")
      .filter((t) => t.includes("self.__next_f"))
      .reduce((sum, t) => sum + t.length, 0),
  );
  await context.close();
  return {
    path,
    finalUrl,
    colorScheme,
    htmlBytes: html.length,
    rscPayloadBytes,
    js,
    imageCount: images.length,
    imageBytes: images.reduce((sum, i) => sum + i.bytes, 0),
    images,
  };
}

test("public first-load weight, 375 light + home dark", async ({ browser }) => {
  test.setTimeout(300_000);
  const results = [];
  for (const path of PAGES) results.push(await probe(browser, path, "light"));
  results.push(await probe(browser, "/", "dark"));
  record("first-load", { capturedAt: new Date().toISOString(), mode: "pnpm dev (unminified)", results });
  expect(results.every((r) => r.htmlBytes > 0)).toBe(true);
});
