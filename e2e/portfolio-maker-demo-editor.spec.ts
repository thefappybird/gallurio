import { test, expect, type Page } from "@playwright/test";

// Public, unauthenticated demo editor — no auth required, fresh anonymous
// context per test so each run starts with a clean localStorage (no
// recoverable buffer from a prior test bleeding into "Continue where you
// left off").
test.use({ storageState: { cookies: [], origins: [] } });

// The sticky disclaimer banner has role="status", but so do dnd-kit's hidden
// screen-reader announcement divs elsewhere on the page — scope to the text.
function disclaimerBanner(page: Page) {
  return page.getByRole("status").filter({ hasText: "Demo mode" });
}

// A fresh visit opens SpotlightGuide first (overlaying an already-live
// canvas), same sequencing as the real editor for a brand-new workspace —
// the 2-option entry screen only appears once the guide is dismissed.
async function skipGuideAndReachEntry(page: Page) {
  await page.goto("/portfolio-maker-demo");
  await page.getByRole("button", { name: "Skip Guide" }).click();
  // "Skip Guide" opens a confirm dialog ("Skip the guide?") before actually
  // dismissing the tour — confirm it.
  await page
    .getByRole("dialog", { name: "Skip the guide?" })
    .getByRole("button", { name: "Skip Guide" })
    .click();
  await expect(page.getByRole("heading", { name: "Try the portfolio editor" })).toBeVisible();
}

test("demo editor shows the disclaimer banner immediately, and the 2-option entry screen after the guide is skipped", async ({
  page,
}) => {
  await page.goto("/portfolio-maker-demo");

  await expect(disclaimerBanner(page)).toContainText(
    "Demo mode — nothing you do here is saved to a database or shared with anyone.",
  );
  await expect(page.getByRole("dialog", { name: "Welcome to your portfolio editor" })).toBeVisible();

  await page.getByRole("button", { name: "Skip Guide" }).click();
  await page
    .getByRole("dialog", { name: "Skip the guide?" })
    .getByRole("button", { name: "Skip Guide" })
    .click();
  await expect(page.getByRole("heading", { name: "Try the portfolio editor" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start from scratch" })).toBeVisible();
});

test("starting from scratch lands on the canvas with Publish visible", async ({ page }) => {
  await skipGuideAndReachEntry(page);
  await page.getByRole("button", { name: "Start from scratch" }).click();

  await expect(page.getByRole("button", { name: "Publish" })).toBeVisible({ timeout: 15_000 });
  // Disclaimer banner stays visible once on the canvas, not just at entry.
  await expect(disclaimerBanner(page)).toBeVisible();
});

test("clicking Publish opens the demo gate modal with the locked upsell copy, not a real publish", async ({
  page,
}) => {
  await skipGuideAndReachEntry(page);
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await expect(page.getByRole("button", { name: "Publish" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Publish" }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/Publishing is a Gallurio Pro feature/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up to build without restrictions" })).toHaveAttribute(
    "href",
    /\/sign-up/,
  );

  // Dismiss and confirm we're still on the demo editor, not redirected.
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await expect(page).toHaveURL(/\/portfolio-maker-demo/);
});

test("the bonus promo code persists in the disclaimer banner after the first gate hit", async ({ page }) => {
  await skipGuideAndReachEntry(page);
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await expect(page.getByRole("button", { name: "Publish" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText(/bonus code for an extra free month/)).toBeVisible();
  await page.getByRole("button", { name: "Keep exploring" }).click();

  // Reveal only shows once inline, but the code should now persist in the banner.
  await expect(disclaimerBanner(page)).toContainText("Your bonus code: DEMOPRO2026 (claimed)");
});

// The editor toolbar is a deliberately horizontal-scroll UI at narrow widths
// (see the real editor page's own "-m-6 h-svh overflow-x-auto" wrapper and its
// comment: "Horizontal overflow remains scrollable so the desktop editor is
// still usable on constrained screens") — unchanged, pre-existing behavior,
// not a regression from demoMode. So unlike the simple marketing pages, this
// suite checks the entry screen/heading render and are usable at each
// breakpoint, not a strict zero-overflow assertion.
for (const width of [1280, 768, 375] as const) {
  test(`demo editor entry screen is usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/portfolio-maker-demo");

    // Check the banner before any modal dialog opens — Radix's modal focus
    // trap correctly aria-hides background content (including the banner)
    // while a dialog has focus, so this assertion belongs before/after the
    // guide + entry dialogs, not while one is open.
    await expect(disclaimerBanner(page)).toBeVisible();

    await skipGuideAndReachEntry(page);
    await expect(page.getByRole("button", { name: "Start from scratch" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue where you left off" })).toBeVisible();
  });
}

test("demo editor route is not indexed by search engines", async ({ page }) => {
  await page.goto("/portfolio-maker-demo");
  const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robotsMeta ?? "").toMatch(/noindex/i);
});
