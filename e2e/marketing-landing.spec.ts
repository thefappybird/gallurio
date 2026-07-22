import { test, expect } from "@playwright/test";

// Public marketing landing page (`/`) — no auth required. Runs with an
// anonymous context since the default `chromium` project's owner.json
// storageState would otherwise redirect a signed-in owner straight past
// this page (see the landing page's auth-redirect check).
test.use({ storageState: { cookies: [], origins: [] } });

const HEADLINE = "Show your work. Run your business.";

async function expectCoreSectionsVisible(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: HEADLINE })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What is Gallurio?" })).toBeVisible();
  await expect(page.getByText("Drag-and-drop portfolio builder", { exact: true })).toBeVisible();
  await expect(page.getByText("Business workspace", { exact: true })).toBeVisible();
  await expect(page.getByText("Booking inquiries", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Every portfolio worth trusting. Every booking accounted for. Nothing left ambiguous.", {
      exact: false,
    })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Simple pricing" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Build a portfolio that's ready for the next booking." })
  ).toBeVisible();
}

test("landing page renders all sections with no horizontal overflow at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expectCoreSectionsVisible(page);

  await expect(page.getByRole("link", { name: "Pricing" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Contact" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
  // Terms/Privacy/Refunds each appear twice — once in the in-page Transparency
  // section, once in the footer — same duplication Pricing/Contact/Get started
  // above already account for with .first().
  await expect(page.getByRole("link", { name: "Terms" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Refunds" }).first()).toBeVisible();

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
  await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();

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
  await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Refunds" }).first()).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(
    scrollWidth,
    `documentElement.scrollWidth (${scrollWidth}) exceeds viewport (375)`
  ).toBeLessThanOrEqual(380);

  // Below the sm: breakpoint, "Sign in" lives inside the collapsed hamburger
  // menu (only "Get started" stays directly visible) — open it to reach it.
  // Checked after the overflow measurement so the open sheet doesn't skew it.
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("cadence toggle switches the Pro price between monthly and yearly", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByText("1 month free")).toBeVisible();
  await expect(page.getByText("/mo", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /Yearly/ }).click();
  await expect(page.getByText("/yr", { exact: false })).toBeVisible();
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

  await expect(page.getByRole("link", { name: "الأسعار" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "تواصل معنا" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "ما هو Gallurio؟" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "اعرض أعمالك. أدر أعمالك.",
    })
  ).toBeVisible();
});
