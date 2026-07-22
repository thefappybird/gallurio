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

// A fresh visit opens the opt-in intro dialog first — the guide never
// auto-launches. "I'll explore myself" is the fast path straight to the same
// 2-option entry screen the guide's own skip/finish also leads to.
async function skipGuideAndReachEntry(page: Page) {
  await page.goto("/portfolio-maker-demo");
  await page.getByRole("dialog", { name: "Welcome to the portfolio demo" }).getByRole("button", {
    name: "I'll explore myself",
  }).click();
  await expect(page.getByRole("heading", { name: "Try the portfolio editor" })).toBeVisible();
}

test("demo editor shows the disclaimer banner and an opt-in intro dialog, never auto-launching the guide", async ({
  page,
}) => {
  await page.goto("/portfolio-maker-demo");

  await expect(disclaimerBanner(page)).toContainText(
    "Demo mode — nothing you do here is saved to a database or shared with anyone.",
  );
  const intro = page.getByRole("dialog", { name: "Welcome to the portfolio demo" });
  await expect(intro).toBeVisible();
  await expect(intro.getByRole("button", { name: "Show me around" })).toBeVisible();
  await expect(intro.getByRole("button", { name: "I'll explore myself" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Welcome to your portfolio editor" })).not.toBeVisible();
});

test("choosing 'Show me around' starts the spotlight tour, and skipping it reaches the entry screen", async ({
  page,
}) => {
  await page.goto("/portfolio-maker-demo");
  await page.getByRole("dialog", { name: "Welcome to the portfolio demo" }).getByRole("button", {
    name: "Show me around",
  }).click();
  await expect(page.getByRole("dialog", { name: "Welcome to your portfolio editor" })).toBeVisible();

  await page.getByRole("button", { name: "Skip Guide" }).click();
  // "Skip Guide" opens a confirm dialog ("Skip the guide?") before actually
  // dismissing the tour — confirm it.
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

  // Regression guard: the disclaimer banner used to sit on top of a
  // `min-h-svh` EditorShell instead of sharing a clipped `h-svh` flex column
  // with it, so the pair's combined height leaked past the viewport into a
  // page-level vertical scroll — hiding the nav tabs/banner above the fold
  // and, per the report, leaving no way to scroll back up to reach them.
  test(`demo editor page never grows a page-level vertical scrollbar at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/portfolio-maker-demo");
    await page.getByRole("dialog", { name: "Welcome to the portfolio demo" }).waitFor();

    const scrollHeightWithIntro = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(scrollHeightWithIntro, "page scrolls vertically while the intro dialog is open").toBeLessThanOrEqual(900);

    await page.getByRole("dialog", { name: "Welcome to the portfolio demo" }).getByRole("button", {
      name: "I'll explore myself",
    }).click();
    await page.getByRole("button", { name: "Start from scratch" }).click();
    await expect(page.getByRole("button", { name: "Publish" })).toBeVisible({ timeout: 15_000 });

    const scrollHeightOnCanvas = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(scrollHeightOnCanvas, "page scrolls vertically once on the editor canvas").toBeLessThanOrEqual(900);
  });
}

test("demo editor route is not indexed by search engines", async ({ page }) => {
  await page.goto("/portfolio-maker-demo");
  const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robotsMeta ?? "").toMatch(/noindex/i);
});
