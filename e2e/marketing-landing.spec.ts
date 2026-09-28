import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Public marketing landing page (`/`) — no auth required. Runs with an
// anonymous context since the default `chromium` project's owner.json
// storageState would otherwise redirect a signed-in owner straight past
// this page (see the landing page's auth-redirect check).
test.use({ storageState: { cookies: [], origins: [] } });

type Catalog = {
  marketing: {
    hero: { headlineShow: string; headlineRun: string };
    whatIs: { body: string };
    features: {
      portfolioBuilder: { title: string };
      bookingInquiryForms: { title: string };
      businessWorkspace: { title: string };
      bookingMigration: {
        headline: string;
        upload: { title: string };
        normalize: { title: string };
        preview: { title: string };
      };
    };
    manifesto: { quote: string };
    pricingTeaser: {
      title: string;
      cadence: { yearly: string };
      pro: { badge: string; priceSuffixMonthly: string; priceSuffixYearly: string };
    };
    finalCta: { title: string };
    nav: { pricing: string; signIn: string; getStarted: string };
    footer: { contact: string; refundPolicy: string };
    terms: { title: string };
    privacy: { title: string };
  };
};

const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as Catalog;
const ar = JSON.parse(readFileSync("messages/ar.json", "utf8")) as Catalog;
const m = en.marketing;

async function expectCoreSectionsVisible(page: Page) {
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toContainText(m.hero.headlineShow);
  await expect(h1).toContainText(m.hero.headlineRun);
  await expect(page.getByText(m.whatIs.body)).toBeVisible();
  await expect(page.getByText(m.features.portfolioBuilder.title, { exact: true })).toBeVisible();
  await expect(page.getByText(m.features.businessWorkspace.title, { exact: true })).toBeVisible();
  await expect(page.getByText(m.features.bookingInquiryForms.title, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: m.features.bookingMigration.headline })).toBeVisible();
  await expect(page.getByRole("heading", { name: m.features.bookingMigration.upload.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: m.features.bookingMigration.normalize.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: m.features.bookingMigration.preview.title })).toBeVisible();
  await expect(page.getByText(m.manifesto.quote, { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: m.pricingTeaser.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: m.finalCta.title })).toBeVisible();
}

test("landing page renders all sections with no horizontal overflow at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expectCoreSectionsVisible(page);

  await expect(page.getByRole("link", { name: m.nav.pricing }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: m.footer.contact }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: m.nav.signIn })).toBeVisible();
  await expect(page.getByRole("link", { name: m.nav.getStarted }).first()).toBeVisible();
  // Terms/Privacy/Refunds each appear twice — once in the in-page Transparency
  // section, once in the footer — same duplication Pricing/Contact/Get started
  // above already account for with .first().
  await expect(page.getByRole("link", { name: m.terms.title }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: m.privacy.title }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: m.footer.refundPolicy }).first()).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(
    scrollWidth,
    `documentElement.scrollWidth (${scrollWidth}) exceeds viewport (1280)`
  ).toBeLessThanOrEqual(1285);
});

test("landing page renders all sections with no horizontal overflow at 768px", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");

  await expectCoreSectionsVisible(page);
  await expect(page.getByRole("link", { name: m.nav.pricing }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: m.nav.getStarted }).first()).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(
    scrollWidth,
    `documentElement.scrollWidth (${scrollWidth}) exceeds viewport (768)`
  ).toBeLessThanOrEqual(773);

  // Below the xl: breakpoint (1280px), "Sign in" lives inside the collapsed
  // hamburger menu — open it to reach it. Checked after the overflow
  // measurement so the open sheet doesn't skew it.
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: m.nav.signIn })).toBeVisible();
});

test("landing page renders all sections with no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await expectCoreSectionsVisible(page);
  await expect(page.getByRole("link", { name: m.nav.pricing }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: m.footer.contact }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: m.nav.getStarted }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: m.terms.title }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: m.privacy.title }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: m.footer.refundPolicy }).first()).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(
    scrollWidth,
    `documentElement.scrollWidth (${scrollWidth}) exceeds viewport (375)`
  ).toBeLessThanOrEqual(380);

  // Below the sm: breakpoint, "Sign in" lives inside the collapsed hamburger
  // menu (only "Get started" stays directly visible) — open it to reach it.
  // Checked after the overflow measurement so the open sheet doesn't skew it.
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: m.nav.signIn })).toBeVisible();
});

test("cadence toggle switches the Pro price between monthly and yearly", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  // Pin to the paid Pro card regardless of the beta-tab default so the
  // price-suffix assertions below are deterministic.
  await page.getByTestId("plan-tab-monthly").click();
  await expect(page.getByText(m.pricingTeaser.pro.badge)).toBeVisible();
  await expect(page.getByText(m.pricingTeaser.pro.priceSuffixMonthly, { exact: false })).toBeVisible();

  await page.getByRole("button", { name: m.pricingTeaser.cadence.yearly }).click();
  await expect(page.getByText(m.pricingTeaser.pro.priceSuffixYearly, { exact: false })).toBeVisible();
});

test("hero ambient background follows the site theme toggle", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const lightSvg = page.locator('img[src*="background-light.svg"]').first();
  const darkSvg = page.locator('img[src*="background-dark.svg"]').first();

  await expect(lightSvg).toBeVisible();
  await expect(darkSvg).toBeHidden();

  await page.getByRole("button", { name: "Theme" }).first().click();
  await page.getByRole("menuitem", { name: "Dark" }).click();

  await expect(darkSvg).toBeVisible();
  await expect(lightSvg).toBeHidden();
});

test("ar locale renders right-to-left with translated header/footer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/ar");

  const dir = await page.evaluate(() => document.documentElement.getAttribute("dir"));
  expect(dir).toBe("rtl");

  await expect(page.getByRole("link", { name: ar.marketing.nav.pricing }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: ar.marketing.footer.contact }).first()).toBeVisible();
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toContainText(ar.marketing.hero.headlineShow);
  await expect(h1).toContainText(ar.marketing.hero.headlineRun);
});
