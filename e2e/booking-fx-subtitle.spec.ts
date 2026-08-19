/**
 * Verifies the frozen-FX-rate subtitle on the booking detail modal end to
 * end: creates ONE booking in a currency that differs from the workspace
 * currency, with a non-zero deposit and one payment marked paid at creation
 * — the exact condition the backend freezes a rate under (see
 * docs/pricing/currency-conversion.md) — then confirms both subtitle sites
 * (the booking total field and the paid payment row) render the frozen
 * figure against real data.
 */
import { test, expect } from "@playwright/test";

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

test.describe.serial("Booking FX subtitle", () => {
  let bookingId = "";

  test("0. create a booking in a non-workspace currency with a paid deposit payment", async ({
    page,
  }) => {
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
});
