import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openEditorWithDraft } from "./helpers";
import { E2E_FIXTURE_DRAFT_NAME } from "@/lib/db/seedE2eDraft";

/**
 * Run 2 of the public-surfaces pass (1.5.0, see
 * `CHANGELOG.md` → SEO): the marketing sweep (5 locales x light/dark x
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
          expect.soft(await overflow(page), `${url} @ ${width}: no horizontal overflow`).toBeLessThanOrEqual(1);
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

test("static home: the price island resolves the visitor's local currency", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { "cf-ipcountry": "PH" },
  });
  const page = await context.newPage();
  const pricingResponse = page.waitForResponse((r) => r.url().includes("/api/public/pricing"));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const res = await pricingResponse;
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("private");
  const body = (await res.json()) as { pricing: { local?: { currency: string } | null } };
  // The island swaps the server-rendered base price for the visitor's
  // currency; PHP renders with the peso sign.
  expect(body.pricing.local?.currency, "a PH visitor gets a PHP display price").toBe("PHP");
  // Beta may be the default tab; the Pro price lives under Monthly.
  await page.getByTestId("plan-tab-monthly").click();
  await expect(page.locator("#pricing")).toContainText("₱", { timeout: 10_000 });
  await context.close();
});

test.describe("signed-in landing", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("/ and /fil send the owner into the app; the header logo does too", async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    await page.goto("/fil", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/fil\/dashboard$/, { timeout: 30_000 });

    // Client navigation from a marketing page back to Home.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/pricing", { waitUntil: "networkidle" });
    // The logo is the header's first link ("/" or "/fil" once the fil visit
    // above set the locale cookie).
    await page.locator("header a").first().click();
    await expect(page).toHaveURL(/\/(fil\/)?dashboard$/, { timeout: 30_000 });
    expect(errors, "no page errors on the landing redirects").toEqual([]);
  });
});

test.describe("tenant modals", () => {
  // The seeded PUBLISHED portfolio binds no collections, so the modals are
  // driven through the preview route with the E2E fixture draft (a
  // Weddings-bound FeaturedWork + a GalleryGrid) — same components, same
  // lazy chunks as the published page.
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("collection popup and lightbox load on first open", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditorWithDraft(page, E2E_FIXTURE_DRAFT_NAME);
    // The Preview tab mounts the preview route (same client Render + lazy
    // chunks as the published page) in an iframe carrying the active draft.
    const chunks: string[] = [];
    page.on("request", (r) => {
      if (/\/_next\/static\/.*\.js/.test(r.url())) chunks.push(r.url());
    });
    await page.getByRole("button", { name: "Preview", exact: true }).first().click();
    await expect(page.locator('iframe[src*="portfolio-preview"]').first()).toBeAttached({ timeout: 30_000 });
    const preview = page.frameLocator('iframe[src*="portfolio-preview"]').first();

    const tile = preview.locator("[data-featured-tile]").filter({ hasText: "Weddings" }).first();
    await expect(tile, "fixture FeaturedWork tile renders").toBeVisible({ timeout: 30_000 });
    // The editor holds a live socket, so it never reaches networkidle; give
    // the preview a moment to settle before snapshotting the chunk count.
    await page.waitForTimeout(3000);
    const atIdle = chunks.length;
    await tile.click();
    await expect(preview.locator("[data-popup-shell]"), "collection popup opens").toBeVisible({ timeout: 15_000 });
    const afterPopup = chunks.length;
    // The fixture's GalleryGrid is unbound (no photos), so the Lightbox chain
    // is exercised from a photo inside the collection popup, from the keyboard.
    const photo = preview.locator("[data-popup-shell] button:has(img)").first();
    await expect(photo, "popup photo renders").toBeVisible({ timeout: 20_000 });
    await photo.focus();
    await photo.press("Enter");
    await expect(preview.locator("[data-lightbox-close]").first(), "lightbox opens from the keyboard").toBeVisible({
      timeout: 15_000,
    });
    test.info().annotations.push({
      type: "modal-chunks",
      description: `JS requests at idle ${atIdle}, after popup ${afterPopup}, after lightbox ${chunks.length}`,
    });
  });
});
