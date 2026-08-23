/**
 * Verifies the frozen-FX-rate subtitle on the booking detail modal end to
 * end: creates ONE booking in a currency that differs from the workspace
 * currency, with a non-zero deposit and one payment marked paid at creation
 * — the exact condition the backend freezes a rate under (see
 * docs/pricing/currency-conversion.md) — then confirms both subtitle sites
 * (the booking total field and the paid payment row) render the frozen
 * figure against real data.
 */
import { test, expect, type Page } from "@playwright/test";

const RUN_TAG = `PWT-FX-${Date.now()}`;
const CLIENT_NAME = `Playwright FX Client ${RUN_TAG}`;
const BOOKING_TITLE = `Playwright FX Subtitle ${RUN_TAG}`;
const TOTAL = "1000";
const DEPOSIT = "500";

function futureDateStr(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

// frozenRate ICU string per locale (messages/<locale>.json,
// app.bookings.payments.frozenRate) — marker word/phrase between the two
// "·" separators, checked alongside "≈" and a digit so mojibake is caught.
const LOCALES = ["en", "fil", "id", "ar", "th"] as const;
const FX_REGEX: Record<(typeof LOCALES)[number], RegExp> = {
  en: /≈.*rate.*\d/,
  fil: /≈.*rate na.*\d/,
  id: /≈.*kurs.*\d/,
  ar: /≈.*السعر.*\d/,
  th: /≈.*อัตรา.*\d/,
};
const WIDTHS = [375, 768, 1280] as const;
const THEMES = ["light", "dark"] as const;

// localePrefix "as-needed": en has no prefix, every other locale does.
function detailPath(locale: string, id: string): string {
  return locale === "en" ? `/bookings?detail=${id}` : `/${locale}/bookings?detail=${id}`;
}

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

function hasOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
}

test.describe.serial("Booking FX subtitle", () => {
  let bookingId = "";

  test("0. create a booking in a non-workspace currency with a paid deposit payment", async ({
    page,
  }) => {
    // Cold Turbopack dev server first-hit-compiles the POST /api/bookings
    // route (plus the FX-freeze path) on this run's very first submit —
    // default 60s can be too tight; every other assertion in this test
    // still completed well inside the default.
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/bookings?add=1");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText("New booking")).toBeVisible();

    await dialog.getByRole("button", { name: "Create new" }).click();
    await dialog.locator("#client-new-name").fill(CLIENT_NAME);
    await dialog.getByRole("button", { name: "Next" }).click();

    await dialog.locator("#wiz-title").fill(BOOKING_TITLE);
    const locationInput = dialog.locator("#wiz-location");
    await locationInput.fill("Rizal Park, Manila");
    await locationInput.blur();
    const acceptLocationBtn = dialog.getByRole("button", { name: "Accept location" });
    await expect(acceptLocationBtn).toBeEnabled({ timeout: 10_000 });
    await acceptLocationBtn.click();
    await dialog.getByRole("button", { name: "Next" }).click();

    // ── Payments step ──
    await dialog.locator("#wiz-total").fill(TOTAL);
    await dialog.locator("#wiz-deposit").fill(DEPOSIT);

    // Currency select has no stable id (pre-existing label/htmlFor mismatch,
    // not this change's to fix) — it's the only combobox on the page before
    // any payment row is added, and its current value is the workspace
    // currency; pick whichever of PHP/SGD it ISN'T so the booking currency is
    // guaranteed to differ from the workspace currency.
    const currencyTrigger = dialog.getByRole("combobox").first();
    const currentCurrency = (await currencyTrigger.textContent())?.trim();
    const targetCurrency = currentCurrency === "SGD" ? "PHP" : "SGD";
    await currencyTrigger.click();
    await page.getByRole("option", { name: targetCurrency, exact: true }).click();

    const addPaymentBtn = dialog.getByRole("button", { name: "Add payment" });
    await expect(addPaymentBtn).toBeEnabled();
    await addPaymentBtn.click();
    await dialog.locator("#wiz-payment-title-0").fill("Deposit");
    await dialog.locator("#wiz-payment-price-0").fill(DEPOSIT);
    await dialog.locator("#wiz-payment-status-0").click();
    await page.getByRole("option", { name: "Paid", exact: true }).click();

    await dialog.getByRole("button", { name: "Next" }).click();

    // ── Sessions & Location step ──
    await dialog.locator("#wiz-startDate-0").fill(futureDateStr(90 + (Date.now() % 200)));
    const nextBtn = dialog.getByRole("button", { name: "Next" });
    await expect(nextBtn).toBeEnabled({ timeout: 15_000 });
    await nextBtn.click();

    // ── Review step ──
    await expect(dialog.getByText(BOOKING_TITLE)).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith("/api/bookings") && r.request().method() === "POST",
      ),
      dialog.getByRole("button", { name: "Create booking" }).click(),
    ]);
    expect(response.ok()).toBeTruthy();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    await page.goto(`/bookings?q=${encodeURIComponent(RUN_TAG)}`);
    const newRow = page.getByRole("button", { name: new RegExp(BOOKING_TITLE) });
    await expect(newRow).toBeVisible({ timeout: 15_000 });
    await newRow.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30_000 });
    await page.waitForURL(/[?&]detail=/, { timeout: 15_000 });
    bookingId = new URL(page.url()).searchParams.get("detail") ?? "";
    expect(bookingId).toBeTruthy();
  });

  // 1. Read-only: 3 breakpoints x 5 locales x light/dark = 30 checks that
  // both frozen-rate subtitle sites (booking total + paid payment row)
  // render against the ONE fixture created above. No further writes.
  for (const locale of LOCALES) {
    for (const width of WIDTHS) {
      for (const theme of THEMES) {
        test(`1. ${locale} @ ${width}px ${theme} — frozen-rate subtitle renders`, async ({
          page,
        }) => {
          if (theme === "dark") {
            await page.addInitScript(() => {
              window.localStorage.setItem("theme", "dark");
            });
          }
          const errors = trackConsoleErrors(page);
          await page.setViewportSize({ width, height: 900 });
          await page.goto(detailPath(locale, bookingId));

          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible({ timeout: 30_000 });

          if (locale === "ar") {
            await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
          }
          if (theme === "dark") {
            await expect(page.locator("html")).toHaveClass(/dark/);
          }

          // Payments tab is the 3rd tab regardless of locale (client,
          // eventPricing, payments, sessionsLocation, activity) — index is
          // stable; the localized aria-label text isn't known ahead of time.
          await dialog.locator('[data-slot="tabs-tab"]').nth(2).click();

          // Both subtitle sites (booking total, paid payment row) render the
          // same ICU string shape, so the marker regex matches exactly 2.
          const subtitles = dialog.getByText(FX_REGEX[locale]);
          await expect(subtitles).toHaveCount(2);

          const dialogBox = await dialog.boundingBox();
          expect(dialogBox).not.toBeNull();

          for (let i = 0; i < 2; i++) {
            const subtitle = subtitles.nth(i);
            await expect(subtitle).toBeVisible();

            if (locale === "ar") {
              // No bleed outside the dialog at any of the 3 widths (1px
              // tolerance for subpixel rounding), matching the RTL geometry
              // check in currency-locales.spec.ts.
              const box = await subtitle.boundingBox();
              expect(box).not.toBeNull();
              expect(box!.x).toBeGreaterThanOrEqual(dialogBox!.x - 1);
              expect(box!.x + box!.width).toBeLessThanOrEqual(
                dialogBox!.x + dialogBox!.width + 1
              );
              expect(box!.y).toBeGreaterThanOrEqual(dialogBox!.y - 1);
              expect(box!.y + box!.height).toBeLessThanOrEqual(
                dialogBox!.y + dialogBox!.height + 1
              );
            }

            if (theme === "dark") {
              // Measure computed colour against the dialog's own background
              // rather than assuming the muted-foreground token resolved.
              const subtitleColor = await subtitle.evaluate((el) => getComputedStyle(el).color);
              const dialogBg = await dialog.evaluate(
                (el) => getComputedStyle(el).backgroundColor
              );
              expect(subtitleColor).not.toBe(dialogBg);
            }
          }

          expect(await hasOverflow(page), "document has horizontal overflow").toBe(false);
          expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
        });
      }
    }
  }
});
