import { test, expect } from "@playwright/test";

// Regression: a hard (full-document) load of a protected /{locale}/* route must
// render translated chrome. The bug was proxy.ts clobbering next-intl's
// `x-middleware-override-headers` manifest with authkit's, dropping the
// `x-next-intl-locale` header so getRequestConfig fell back to the default
// locale — English chrome under a correct dir/lang. Affected every non-default
// locale, so we probe both an RTL (ar) and an LTR (id) locale.
const CASES = [
  { locale: "ar", dir: "rtl", bookings: "الحجوزات" },
  { locale: "id", dir: "ltr", bookings: "Pemesanan" },
] as const;

for (const { locale, dir, bookings } of CASES) {
  test(`hard reload of /${locale}/bookings renders ${locale} chrome`, async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto(`/${locale}/bookings`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main", { timeout: 60_000 });

    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", dir);
    await expect(html).toHaveAttribute("lang", locale);

    // The sidebar nav (client component fed by NextIntlClientProvider) is the
    // surface that showed English when the server resolved the wrong locale.
    const body = await page.locator("body").innerText();
    const hasLocalized = body.includes(bookings);
    const hasEnglish = /\bBookings\b/.test(body);
    console.log(`[probe ${locale}] localized '${bookings}':`, hasLocalized, "| english 'Bookings':", hasEnglish);

    expect(hasLocalized, `${locale} sidebar label should render on hard reload`).toBe(true);
  });
}
