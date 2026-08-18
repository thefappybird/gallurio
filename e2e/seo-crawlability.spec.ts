import { test, expect } from "@playwright/test";

// Everything here is public by definition — these are the surfaces built to be
// crawled — so run anonymous, matching marketing-landing.spec.ts.
test.use({ storageState: { cookies: [], origins: [] } });

const BREAKPOINTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
];

const CONTENT_PAGES = [
  "/compare",
  "/compare/gallurio-vs-honeybook",
  "/blog",
  "/blog/how-to-price-event-photography-packages",
];

test("robots.txt closes app routes and names AI crawlers", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();

  // The defect this branch fixed: locale-prefixed marketing pages were blocked
  // while the unprefixed app routes were left wide open.
  expect(body).toContain("Disallow: /dashboard");
  expect(body).toContain("Disallow: /fil/dashboard");
  expect(body).not.toMatch(/^Disallow: \/fil\/$/m);

  for (const agent of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
    expect(body, `${agent} missing from robots.txt`).toContain(agent);
  }

  expect(body).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
});

test("sitemap.xml carries the marketing, comparison and blog URLs", async ({ request }) => {
  const body = await (await request.get("/sitemap.xml")).text();

  expect(body).toContain("/pricing");
  expect(body).toContain("/compare/gallurio-vs-honeybook");
  expect(body).toContain("/blog/how-to-price-event-photography-packages");
});

test("llms.txt serves plain text with the full page index", async ({ request }) => {
  const res = await request.get("/llms.txt");

  expect(res.headers()["content-type"]).toContain("text/plain");

  const body = await res.text();
  expect(body).toContain("# Gallurio");
  expect(body).toContain("/compare/gallurio-vs-honeybook");
  expect(body).toContain("/blog/how-to-price-event-photography-packages");
});

test("a comparison page serves its prose and table to a crawler that runs no JavaScript", async ({
  request,
}) => {
  // The Suspense boundary around the live price must not swallow the article
  // body. If it does, the page arrives empty for anything that does not execute
  // JS — which is the entire audience these pages exist for.
  const html = await (
    await request.get("/compare/gallurio-vs-honeybook", {
      headers: { "user-agent": "GPTBot" },
    })
  ).text();

  expect(html).toContain("HoneyBook");
  expect(html).toMatch(/<h2[^>]*>/);
  expect(html).toMatch(/<table[^>]*>/);
  // The FAQ block is what answering engines quote most readily.
  expect(html).toContain("FAQPage");
});

test("a blog post serves its prose to a crawler that runs no JavaScript", async ({ request }) => {
  const html = await (
    await request.get("/blog/how-to-price-event-photography-packages", {
      headers: { "user-agent": "ClaudeBot" },
    })
  ).text();

  expect(html).toContain("cost floor");
  expect(html).toContain("Article");
});

test("the pricing page emits SoftwareApplication structured data", async ({ request }) => {
  const html = await (await request.get("/pricing")).text();

  expect(html).toContain("SoftwareApplication");
  expect(html).toContain("priceCurrency");
});

test("a published portfolio links back to Gallurio", async ({ page }) => {
  // The seeded owner's workspace, from lib/db/seed.ts.
  await page.goto("/w/seed-owner-demo");

  const link = page.getByRole("link", { name: /powered by gallurio/i });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://gallurio.com");
  expect(await link.getAttribute("rel")).not.toContain("nofollow");
});

for (const { name, width, height } of BREAKPOINTS) {
  test(`content pages have one h1 and no sideways scroll at ${width}px (${name})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });

    for (const path of CONTENT_PAGES) {
      await page.goto(path);

      await expect(page.locator("h1"), `${path} should have exactly one h1`).toHaveCount(1);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(
        scrollWidth,
        `${path} scrollWidth (${scrollWidth}) exceeds viewport (${width})`
      ).toBeLessThanOrEqual(width + 5);
    }
  });
}

test("every content page declares a canonical URL", async ({ page }) => {
  for (const path of CONTENT_PAGES) {
    await page.goto(path);

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical, `${path} has no canonical`).toHaveCount(1);
    await expect(canonical).toHaveAttribute("href", new RegExp(`${path}$`));
  }
});

test("marketing pages declare hreflang for all five locales", async ({ page }) => {
  await page.goto("/pricing");

  for (const locale of ["en", "fil", "id", "ar", "th", "x-default"]) {
    await expect(
      page.locator(`link[rel="alternate"][hreflang="${locale}"]`),
      `hreflang ${locale} missing`
    ).toHaveCount(1);
  }
});
