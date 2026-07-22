import { test, expect } from "@playwright/test";

// Public pages — no auth required. Anonymous context, same reasoning as
// marketing-compliance-pages.spec.ts.
test.use({ storageState: { cookies: [], origins: [] } });

const MARKETING_PAGES = [
  { path: "/portfolio-maker", heading: "Build a portfolio your clients actually book from" },
  { path: "/book-demo", heading: "Book a demo" },
];

for (const width of [1280, 768, 375] as const) {
  test(`Portfolio Maker + Book a Demo pages render with no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const { path, heading } of MARKETING_PAGES) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(
        scrollWidth,
        `${path} documentElement.scrollWidth (${scrollWidth}) exceeds viewport (${width})`,
      ).toBeLessThanOrEqual(width + 5);
    }
  });
}

test("marketing nav links to Portfolio Maker and Book a Demo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Marketing" }).getByRole("link", { name: "Portfolio Builder" }).click();
  await expect(page).toHaveURL(/\/portfolio-maker$/);

  await page.goto("/");
  await page.getByRole("navigation", { name: "Marketing" }).getByRole("link", { name: "Book a Demo" }).click();
  await expect(page).toHaveURL(/\/book-demo$/);
});

test("Portfolio Maker page CTA links to the live demo", async ({ page }) => {
  await page.goto("/portfolio-maker");
  const cta = page.getByRole("link", { name: "Try the portfolio builder" });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", /\/portfolio-maker-demo/);
});

test("ar locale renders Portfolio Maker + Book a Demo pages right-to-left", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const { path } of MARKETING_PAGES) {
    await page.goto(`/ar${path}`);
    const dir = await page.evaluate(() => document.documentElement.getAttribute("dir"));
    expect(dir, `${path} should render dir="rtl"`).toBe("rtl");
  }
});

test("Book a Demo form validates required fields and shows a success state on submit", async ({ page }) => {
  await page.goto("/book-demo");

  const submit = page.getByRole("button", { name: "Request a demo" });
  await submit.click();
  // Native/zod validation should keep us on the form — no success heading yet.
  await expect(page.getByRole("heading", { name: "Request received" })).not.toBeVisible();

  await page.getByLabel("Your name").fill("Playwright Verification");
  await page.getByLabel("Email").fill("playwright-verify@example.com");
  await page.getByLabel("Business / studio name").fill("Playwright Test Studio");
  await page.getByLabel("What would you like to see?").fill("Just verifying the Book a Demo flow end-to-end.");

  await submit.click();
  await expect(page.getByRole("heading", { name: "Request received" })).toBeVisible({ timeout: 15_000 });
});
