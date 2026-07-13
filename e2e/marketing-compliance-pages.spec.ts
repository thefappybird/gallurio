import { test, expect } from "@playwright/test";

// Public compliance/utility pages (/pricing, /terms, /privacy, /refunds,
// /contact) — no auth required. Anonymous context, same reasoning as
// marketing-landing.spec.ts.
test.use({ storageState: { cookies: [], origins: [] } });

const COMPLIANCE_PAGES = [
  { path: "/pricing", heading: "Simple plans for creative professionals and studios." },
  { path: "/terms", heading: "Terms of Service" },
  { path: "/privacy", heading: "Privacy Policy" },
  { path: "/refunds", heading: "Refund Policy" },
  { path: "/contact", heading: "Need help with Gallurio?" },
];

test("compliance pages render with no horizontal overflow at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  for (const { path, heading } of COMPLIANCE_PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(
      scrollWidth,
      `${path} documentElement.scrollWidth (${scrollWidth}) exceeds viewport (1280)`,
    ).toBeLessThanOrEqual(1285);
  }
});

test("compliance pages render with no horizontal overflow at 768px", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });

  for (const { path, heading } of COMPLIANCE_PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(
      scrollWidth,
      `${path} documentElement.scrollWidth (${scrollWidth}) exceeds viewport (768)`,
    ).toBeLessThanOrEqual(773);
  }
});

test("compliance pages render with no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  for (const { path, heading } of COMPLIANCE_PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(
      scrollWidth,
      `${path} documentElement.scrollWidth (${scrollWidth}) exceeds viewport (375)`,
    ).toBeLessThanOrEqual(380);
  }
});

test("pricing page shows a single Pro plan with the 1-month-free story", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/pricing");

  await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();
  await expect(page.getByText("Recommended")).toBeVisible();
  await expect(page.getByText("Start with 1 month free, no card required.")).toBeVisible();
  await expect(page.getByText("Beta Plan")).not.toBeVisible();
  await expect(page.getByText("Studio", { exact: true })).not.toBeVisible();
  await expect(page.getByText("Business", { exact: true })).not.toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Start my free month" })).toBeVisible();
});

test("contact page renders a real mailto link", async ({ page }) => {
  await page.goto("/contact");
  const mailLink = page.locator('a[href="mailto:support@gallurio.com"]').first();
  await expect(mailLink).toBeVisible();
});

test("ar locale renders the compliance pages right-to-left", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  for (const { path } of COMPLIANCE_PAGES) {
    await page.goto(`/ar${path}`);
    const dir = await page.evaluate(() => document.documentElement.getAttribute("dir"));
    expect(dir, `${path} should render dir="rtl"`).toBe("rtl");
  }

  await page.goto("/ar/pricing");
  await expect(
    page.getByRole("heading", { name: "خطط بسيطة للمحترفين والاستوديوهات الإبداعية." }),
  ).toBeVisible();

  await page.goto("/ar/contact");
  const mailLink = page.locator('a[href="mailto:support@gallurio.com"]').first();
  await expect(mailLink).toBeVisible();
});
