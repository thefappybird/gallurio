import { test, expect } from "@playwright/test";

test("booking detail deep link opens the modal", async ({ page }) => {
  // ── 1. Navigate to bookings with all filters off to find a real booking ──
  await page.goto("/bookings?showPast=1&includeCancelled=1");
  await page.waitForLoadState("networkidle", { timeout: 30_000 });

  // ── 2. Click the first row to get a real booking id from the URL ──
  const rowCount = await page.locator("table tbody tr").count();
  if (rowCount === 0) {
    test.skip(true, "No bookings seeded — cannot test booking deep link");
    return;
  }

  await page.locator("table tbody tr").first().click();
  await page.waitForURL((url) => url.searchParams.has("detail"), {
    timeout: 10_000,
  });
  const bookingId = new URL(page.url()).searchParams.get("detail")!;

  // ── 3. Navigate directly to the deep link (as an email link would) ──
  await page.goto(`/bookings?detail=${encodeURIComponent(bookingId)}`);
  await page.waitForLoadState("networkidle", { timeout: 30_000 });

  // ── 4. Assert the booking detail modal is open ──
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
});

test("inquiry detail deep link opens the modal", async ({ page }) => {
  // ── 1. Navigate to inquiries and find a real inquiry id ──
  await page.goto("/inquiries");
  await page.waitForLoadState("networkidle", { timeout: 30_000 });

  // Click the first row (desktop: router.push; updates URL to ?inquiryId=<id>)
  const rowCount = await page.locator("table tbody tr").count();
  if (rowCount === 0) {
    test.skip(true, "No inquiries seeded — cannot test inquiry deep link");
    return;
  }

  await page.locator("table tbody tr").first().click();
  await page.waitForURL((url) => url.searchParams.has("inquiryId"), {
    timeout: 10_000,
  });
  const inquiryId = new URL(page.url()).searchParams.get("inquiryId")!;

  // ── 2. Navigate directly to the deep link (as an email link would) ──
  await page.goto(`/inquiries?inquiryId=${encodeURIComponent(inquiryId)}`);
  await page.waitForLoadState("networkidle", { timeout: 30_000 });

  // ── 3. Assert the inquiry detail modal is open ──
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
});

// Logged-out context: no session cookies.
// Run this describe block with --no-deps so the setup project (which also
// signs in as owner) is skipped — only one owner sign-in per run stays
// within the rate limit.
test.describe("logged-out returnTo round-trip", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated /bookings redirects to sign-in with returnTo, then returns to /bookings after login", async ({
    page,
  }) => {
    // Override timeout: sign-in + cold Turbopack compile can exceed the 60s default.
    test.setTimeout(180_000);
    const email = process.env.SEED_OWNER_EMAIL;
    const password = process.env.SEED_OWNER_PASSWORD;
    expect(email, "SEED_OWNER_EMAIL must be set in .env.local").toBeTruthy();
    expect(
      password,
      "SEED_OWNER_PASSWORD must be set in .env.local",
    ).toBeTruthy();

    // ── 1. Navigate to protected path while logged out ──
    await page.goto("/bookings");
    await page.waitForURL((url) => url.pathname.includes("sign-in"), {
      timeout: 30_000,
    });

    // ── 2. Assert sign-in URL carries returnTo pointing at /bookings ──
    const signInUrl = page.url();
    expect(signInUrl).toContain("returnTo");
    const returnTo = new URL(signInUrl).searchParams.get("returnTo") ?? "";
    expect(decodeURIComponent(returnTo)).toContain("/bookings");

    // ── 3. Fill credentials and submit ──
    await page.locator("#signin-email").fill(email!);
    await page.locator("#signin-password").fill(password!);
    await page.locator('button[type="submit"]').click();

    // ── 4. Wait for post-login redirect — generous timeout for cold Turbopack compile ──
    await page.waitForURL(
      (url) => /\/(bookings|dashboard|onboarding)\b/.test(url.pathname),
      { timeout: 90_000 },
    );

    // ── 5. Assert we landed on /bookings, not /dashboard ──
    // The proxy.ts fix appends ?returnTo=/bookings on unauthenticated redirects
    // to /sign-in, and signInAction honors it via postAuthRedirect.
    const finalPathname = new URL(page.url()).pathname;
    expect(
      finalPathname.endsWith("/bookings") ||
        finalPathname.includes("/bookings"),
      `Expected /bookings after returnTo round-trip, but landed on: ${finalPathname}`,
    ).toBe(true);
  });
});
