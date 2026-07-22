import { test, expect } from "@playwright/test";

// Public pages — no auth required. Anonymous context, same reasoning as
// marketing-compliance-pages.spec.ts.
test.use({ storageState: { cookies: [], origins: [] } });

const MARKETING_PAGES = [{ path: "/book-demo", heading: "Book a demo" }];

for (const width of [1280, 768, 375] as const) {
  test(`Book a Demo page renders with no horizontal overflow at ${width}px`, async ({
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

// "Portfolio Builder" now links straight to the live demo canvas — the old
// intermediate /portfolio-maker marketing page was removed in favor of an
// opt-in intro dialog on the demo canvas itself (see portfolio-maker-demo-editor.spec.ts).
test("marketing nav links to the Portfolio Builder demo and Book a Demo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Marketing" }).getByRole("link", { name: "Portfolio Builder" }).click();
  await expect(page).toHaveURL(/\/portfolio-maker-demo$/);

  await page.goto("/");
  await page.getByRole("navigation", { name: "Marketing" }).getByRole("link", { name: "Book a Demo" }).click();
  await expect(page).toHaveURL(/\/book-demo$/);
});

test("ar locale renders the Book a Demo page right-to-left", async ({ page }) => {
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
