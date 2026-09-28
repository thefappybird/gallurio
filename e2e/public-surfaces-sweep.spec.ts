import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * Run 2 of the public-surfaces pass (docs/gallurio.com-Coverage-2026-09-17/
 * plan-of-action.md): the marketing sweep (5 locales x light/dark x
 * 375/768/1280) after the message-catalog scoping, ThemedShot/Ambient
 * rewrites and logo swap, plus the SEO head checks and the tenant modals
 * that now load on first open. Anonymous visitor; read-only.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const LOCALES = ["en", "fil", "id", "ar", "th"] as const;
const WIDTHS = [375, 768, 1280] as const;
const MARKETING_PATHS = ["/", "/pricing", "/book-demo"] as const;

type Catalog = { marketing: { hero: { headlineShow: string } } };
const catalogs = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as Catalog]),
) as Record<(typeof LOCALES)[number], Catalog>;

function localized(locale: string, path: string) {
  if (locale === "en") return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

for (const scheme of ["light", "dark"] as const) {
  test(`marketing ${scheme}: 5 locales x 3 pages x 3 widths`, async ({ browser }) => {
    test.setTimeout(600_000);
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const requests: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("request", (r) => requests.push(r.url()));

    for (const locale of LOCALES) {
      for (const path of MARKETING_PATHS) {
        const url = localized(locale, path);
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(url, { waitUntil: "networkidle" });

        const body = await page.locator("body").innerText();
        expect(body, `${url}: no Next error overlay`).not.toMatch(/Unhandled Runtime Error|Application error/i);
        expect(body, `${url}: no raw message keys`).not.toMatch(/\bmarketing\.[a-zA-Z]+\.[a-zA-Z]+/);
        expect(await page.locator("html").getAttribute("dir")).toBe(locale === "ar" ? "rtl" : "ltr");
        if (path === "/") {
          await expect(page.getByRole("heading", { level: 1 })).toContainText(
            catalogs[locale].marketing.hero.headlineShow,
          );
        }

        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          expect(await overflow(page), `${url} @ ${width}: no horizontal overflow`).toBeLessThanOrEqual(1);
        }

        if (path === "/") {
          // The themed screenshot and ambient art resolve by CSS: only the
          // active scheme's variant is visible, and the other is never fetched.
          const visibleShots = await page
            .locator("img[alt]")
            .evaluateAll((imgs) =>
              (imgs as HTMLImageElement[])
                .filter((i) => i.offsetParent !== null && /screenshots/.test(i.currentSrc || i.src))
                .map((i) => decodeURIComponent(i.currentSrc || i.src)),
            );
          expect(visibleShots.length, `${url}: screenshots visible`).toBeGreaterThan(0);
          expect(visibleShots.every((s) => s.includes(`-${scheme}.png`)), `${url}: shots match ${scheme}`).toBe(true);
        }
      }
    }

    const other = scheme === "dark" ? "light" : "dark";
    expect(
      requests.filter((u) => decodeURIComponent(u).includes(`-${other}.png`) || u.includes(`background-${other}.svg`)),
      `no ${other}-scheme assets fetched`,
    ).toEqual([]);
    expect(requests.filter((u) => u.includes("gallurio-sq.svg")), "old logo SVG never requested").toEqual([]);
    expect(
      consoleErrors.filter((e) => /MISSING_MESSAGE|IntlError|hydrat/i.test(e)),
      "no missing-message or hydration errors",
    ).toEqual([]);
    await context.close();
  });
}

test("SEO head + robots: no redirecting canonical/hreflang, localized editorial links unprefixed", async ({ page }) => {
  await page.goto("/fil", { waitUntil: "domcontentloaded" });
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonical).toMatch(/\/fil$/);
  const alternates = await page
    .locator('link[rel="alternate"][hreflang]')
    .evaluateAll((ls) => ls.map((l) => (l as HTMLLinkElement).getAttribute("href") ?? ""));
  expect(alternates.length).toBe(6);
  for (const href of alternates) {
    expect(new URL(href).pathname === "/" || !href.endsWith("/"), `hreflang ${href} has no trailing slash`).toBe(true);
  }
  const editorial = await page
    .locator('a[href$="/resources"], a[href$="/compare"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(editorial.length).toBeGreaterThan(0);
  expect(editorial.every((h) => h === "/resources" || h === "/compare"), JSON.stringify(editorial)).toBe(true);

  // A visitor whose locale preference is not English must reach the
  // English-only editorial pages without a /fil <-> unprefixed redirect loop,
  // and no response may advertise redirecting hreflang URLs via a Link header.
  for (const path of ["/compare", "/resources", "/blog"]) {
    const res = await page.request.get(path, {
      headers: { cookie: "NEXT_LOCALE=fil", "accept-language": "th" },
      maxRedirects: 0,
    });
    expect(res.status(), `${path} with a fil cookie serves directly`).toBe(200);
    expect(res.headers()["link"] ?? "", `${path}: no hreflang Link header`).not.toMatch(/hreflang/);
  }

  const robots = await (await page.request.get("/robots.txt")).text();
  for (const locale of ["fil", "id", "ar", "th"]) {
    expect(robots).toContain(`Allow: /${locale}/portfolio-maker-demo`);
  }
});

test("tenant: modals load on first open", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const chunksBefore: string[] = [];
  page.on("request", (r) => {
    if (/\/_next\/static\/.*\.js/.test(r.url())) chunksBefore.push(r.url());
  });

  await page.goto("/w/seed-owner-demo", { waitUntil: "networkidle" });
  const tile = page.locator("[data-featured-tile]").first();
  await expect(tile, "featured tile renders").toBeVisible({ timeout: 20_000 });
  const loadedAtIdle = chunksBefore.length;
  await tile.click();
  await expect(page.locator("[data-popup-shell]")).toBeVisible({ timeout: 15_000 });
  test.info().annotations.push({
    type: "popup-chunks",
    description: `JS requests at idle ${loadedAtIdle}, after open ${chunksBefore.length}`,
  });
  await page.keyboard.press("Escape");

  await page.goto("/w/seed-owner-demo/gallery", { waitUntil: "networkidle" });
  const photo = page.getByRole("button", { name: /.+/ }).filter({ has: page.locator("img") }).first();
  await expect(photo, "gallery tile renders").toBeVisible({ timeout: 20_000 });
  await photo.click();
  await expect(page.getByRole("dialog").first(), "lightbox opens").toBeVisible({ timeout: 15_000 });
});
