import { test, expect } from "@playwright/test";

// Public marketing landing page (`/`) — no auth required. Runs with an
// anonymous context since the default `chromium` project's owner.json
// storageState would otherwise redirect a signed-in owner straight past
// this page (see the landing page's auth-redirect check).
test.use({ storageState: { cookies: [], origins: [] } });

const HEADLINE = "The booking-ready portfolio, run like a ledger.";

async function expectCoreSectionsVisible(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: HEADLINE })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What is Gallurio?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Built for Creative Businesses" })).toBeVisible();
  await expect(page.getByText("Portfolio builder", { exact: true })).toBeVisible();
  await expect(page.getByText("Business workspace", { exact: true })).toBeVisible();
  await expect(page.getByText("Booking inquiry forms", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Every booking accounted for. Every client trusted. Nothing left ambiguous.", {
      exact: false,
    })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Simple pricing" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Start building your creative workspace with Gallurio." })
  ).toBeVisible();
}

test("landing page renders all sections with no horizontal overflow at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expectCoreSectionsVisible(page);

  await expect(page.getByRole("link", { name: "Pricing" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Contact" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Join the Beta" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Refunds" })).toBeVisible();

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
  await expect(page.getByRole("link", { name: "Pricing" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Join the Beta" }).first()).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(
    scrollWidth,
    `documentElement.scrollWidth (${scrollWidth}) exceeds viewport (768)`
  ).toBeLessThanOrEqual(773);
});

test("landing page renders all sections with no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await expectCoreSectionsVisible(page);
  await expect(page.getByRole("link", { name: "Pricing" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Contact" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Join the Beta" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Refunds" })).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(
    scrollWidth,
    `documentElement.scrollWidth (${scrollWidth}) exceeds viewport (375)`
  ).toBeLessThanOrEqual(380);
});

test("dark hero header appears only on the landing page, not on other marketing pages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto("/");
  await expect(page.locator("header.dark")).toHaveCount(1);
  await expect(page.locator("footer.dark")).toHaveCount(1);

  await page.goto("/pricing");
  await expect(page.locator("header.dark")).toHaveCount(0);
  await expect(page.locator("footer.dark")).toHaveCount(0);
});

test("cadence toggle switches the Pro price between monthly and yearly", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByText("$14/mo", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /Yearly/ }).click();
  await expect(page.getByText("$10/mo, billed yearly", { exact: false })).toBeVisible();
});

test("ar locale renders right-to-left with translated header/footer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/ar");

  const dir = await page.evaluate(() => document.documentElement.getAttribute("dir"));
  expect(dir).toBe("rtl");

  await expect(page.getByRole("link", { name: "الأسعار" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "تواصل معنا" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "ما هو Gallurio؟" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "معرض الأعمال الجاهز للحجز، يُدار كسجل محاسبي دقيق.",
    })
  ).toBeVisible();
});
