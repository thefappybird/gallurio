/**
 * Verifies the booking-payments polish batch end-to-end in a real browser:
 *  1. Wizard "Payments" step — empty state, required title/price validation,
 *     balance-cap enforcement (Add payment disables at 0 remaining), status
 *     casing, then create a booking with two payments summing to the total.
 *  2. Detail modal — "Payments" tab (split from "Event & Location"), the
 *     outstanding-balance badge (unpaid payments don't reduce it), delete a
 *     payment (re-opens the balance, re-enables Add payment), edit the
 *     remaining payment to fully paid, and confirm the completion guard still
 *     auto-completes on a zero remaining balance.
 *  3. Invoice/receipt footer button — opens a new tab to the PDF route
 *     without a client error (byte contents are NOT inspected here).
 *  4. Invoice theme picker — 4 presets + Custom, save one selection.
 *  5. RTL sanity — Arabic locale renders the Payments tab without breaking,
 *     <html dir="rtl">.
 *
 * Side-effect policy: creates exactly ONE new booking via the wizard for this
 * verification, and edits it. No other seeded data is touched.
 */

import path from "node:path";
import { test, expect } from "@playwright/test";

const SHOT_DIR = path.resolve(
  process.env.PLAYWRIGHT_SCREENSHOT_DIR ?? "test-results/booking-payments",
);

const BREAKPOINTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

// Unique per run: earlier debug runs of this spec left orphan bookings with a
// fixed title in the shared dev DB, and a non-unique title made the row
// lookup below ambiguous (it could resolve to a STALE booking from a prior
// run instead of the one this run just created). The timestamp suffix plus a
// server-side search filter guarantees the row we click is the one we made.
const RUN_TAG = `PWT-${Date.now()}`;
const CLIENT_NAME = `Playwright Test Client ${RUN_TAG}`;
const BOOKING_TITLE = `Playwright Payments Verification ${RUN_TAG}`;
const TOTAL = "500";
const PAYMENT_A_PRICE = "300";
const PAYMENT_B_PRICE = "200";

function futureDateStr(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

test.describe.serial("Booking payments", () => {
  let bookingId = "";

  test("1. wizard Payments step: empty state, required fields, balance cap", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/bookings?add=1");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText("New booking")).toBeVisible();

    // ── Client step: switch to "new client" mode ──
    await dialog.getByRole("button", { name: "Create new" }).click();
    await dialog.locator("#client-new-name").fill(CLIENT_NAME);
    await dialog.getByRole("button", { name: "Next" }).click();

    // ── Event step (pricing now lives on the Payments step) ──
    await dialog.locator("#wiz-title").fill(BOOKING_TITLE);

    const locationInput = dialog.locator("#wiz-location");
    await locationInput.fill("Rizal Park, Manila");
    await locationInput.blur();
    const acceptLocationBtn = dialog.getByRole("button", { name: "Accept location" });
    await expect(acceptLocationBtn).toBeEnabled({ timeout: 10_000 });
    await acceptLocationBtn.click();

    await dialog.getByRole("button", { name: "Next" }).click();

    // ── Payments step ──
    const paymentsStepTab = dialog.getByRole("button", { name: /payments/i });
    await expect(paymentsStepTab).toBeVisible();

    // Empty state before any payment row exists.
    await expect(
      dialog.getByText("No payments scheduled yet for this booking"),
    ).toBeVisible();
    const addPaymentBtn = dialog.getByRole("button", { name: "Add payment" });
    // Total is still 0 at this point — cap gate keeps Add disabled.
    await expect(addPaymentBtn).toBeDisabled();

    await dialog.locator("#wiz-total").fill(TOTAL);
    await expect(addPaymentBtn).toBeEnabled();

    // Add a payment row and try to advance without filling it — required
    // title/price validation must block navigation.
    await addPaymentBtn.click();
    await dialog.getByRole("button", { name: "Next" }).click();
    await expect(dialog.getByText("Title is required")).toBeVisible();
    await expect(dialog.getByText("Amount must be greater than 0")).toBeVisible();
    await expect(paymentsStepTab).toBeVisible(); // still on Payments step

    // Fill payment A and exercise the status casing fix.
    await dialog.locator("#wiz-payment-title-0").fill("Deposit A");
    await dialog.locator("#wiz-payment-price-0").fill(PAYMENT_A_PRICE);
    await dialog.locator("#wiz-payment-status-0").click();
    await page.getByRole("option", { name: "Unpaid" }).click();
    await expect(dialog.locator("#wiz-payment-status-0")).toHaveText("Unpaid");

    // Second payment covers the rest of the balance exactly.
    await addPaymentBtn.click();
    await dialog.locator("#wiz-payment-title-1").fill("Deposit B");
    await dialog.locator("#wiz-payment-price-1").fill(PAYMENT_B_PRICE);

    // Balance is now fully allocated — Add payment must disable.
    await expect(addPaymentBtn).toBeDisabled();

    // Breakpoint screenshots of the wizard Payments step.
    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOT_DIR, `${bp.name}-wizard-payments.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    await dialog.getByRole("button", { name: "Next" }).click();

    // ── Sessions & Location step ──
    // A randomized far-future offset avoids colliding with any leftover
    // booking from a previous run of this same spec at the exact same
    // team/date/time (the seeded data itself is sparse this far out).
    await dialog.locator("#wiz-startDate-0").fill(futureDateStr(60 + (Date.now() % 300)));
    const nextBtn = dialog.getByRole("button", { name: "Next" });
    await expect(nextBtn).toBeEnabled({ timeout: 15_000 });
    await nextBtn.click();

    // ── Review step ──
    await expect(dialog.getByText(BOOKING_TITLE)).toBeVisible();
    await expect(dialog.getByText(CLIENT_NAME)).toBeVisible();
    await expect(dialog.getByText("Unpaid").first()).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith("/api/bookings") && r.request().method() === "POST",
      ),
      dialog.getByRole("button", { name: "Create booking" }).click(),
    ]);
    expect(response.ok()).toBeTruthy();

    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // The created-booking id isn't in the POST response body reliably under
    // the dev server (response.json() can hang on the buffered body here) —
    // recover it from the row's own detail-link navigation instead. Filter
    // via the server-side search box first (by the unique RUN_TAG) so the
    // match can't land on a stale row from an earlier debug run.
    await page.goto(`/bookings?q=${encodeURIComponent(RUN_TAG)}`);
    // The row itself carries role="button" (it's a single clickable/keyboard-
    // activatable control), overriding <tr>'s implicit "row" role — so it's
    // exposed to the a11y tree as a button, not a row.
    const newRow = page.getByRole("button", { name: new RegExp(BOOKING_TITLE) });
    await expect(newRow).toBeVisible({ timeout: 15_000 });
    await newRow.click();
    // Wait for the detail modal itself rather than the URL change — on a
    // cold dev-server Turbopack compile of the detail-modal chunk can take
    // longer than the URL update takes to settle, and the modal is the
    // actually-meaningful signal that navigation completed.
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30_000 });
    await page.waitForURL(/[?&]detail=/, { timeout: 15_000 });
    const url = new URL(page.url());
    bookingId = url.searchParams.get("detail") ?? "";
    expect(bookingId).toBeTruthy();
  });

  test("2. detail modal: Payments tab, outstanding balance, delete, edit, completion guard", async ({
    page,
  }) => {
    expect(bookingId, "booking id from test 1 must be set").toBeTruthy();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/bookings?detail=${bookingId}`);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    // Outstanding badge is visible from the header regardless of active tab.
    // Neither payment is paid yet, so outstanding = full total (500), not 0 —
    // the bug this verifies used to ignore payments entirely. A generous
    // timeout covers the modal's initial fetch-and-render (loading skeleton).
    await expect(dialog.getByText(/Outstanding balance:\s*\D*500\b/)).toBeVisible({
      timeout: 20_000,
    });

    const paymentsTab = dialog.getByRole("tab", { name: "Payments" });
    await paymentsTab.click();

    await expect(dialog.getByText("Deposit A")).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText("Deposit B")).toBeVisible();
    await expect(dialog.getByText("Unpaid")).toHaveCount(2);

    const addPaymentBtn = dialog.getByRole("button", { name: "Add payment" });
    await expect(addPaymentBtn).toBeDisabled();

    // Breakpoint screenshots of the detail-modal Payments tab.
    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOT_DIR, `${bp.name}-detail-payments.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    // Delete "Deposit B" (still unpaid) — outstanding must NOT change (it
    // was already excluding unpaid payments), and the freed balance
    // re-enables Add payment.
    await dialog.getByRole("button", { name: "Delete Payment 2" }).click();
    await expect(dialog.getByText("Deposit B")).toBeHidden();
    await expect(dialog.getByText(/Outstanding balance:\s*\D*500\b/)).toBeVisible();
    await expect(addPaymentBtn).toBeEnabled();

    // Edit "Deposit A": raise its price to cover the full total and mark it
    // paid — this exercises both the cap (max is now the full 500, since
    // Deposit B is gone) and the completion guard.
    await dialog.getByRole("button", { name: "Edit Payment 1" }).click();
    const priceInput = dialog.locator("#existing-payment-price-0");
    await priceInput.fill(TOTAL);
    await dialog.locator("#existing-payment-status-0").click();
    await page.getByRole("option", { name: "Paid", exact: true }).click();
    await dialog.getByRole("button", { name: "Confirm" }).click();

    const [patchResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/api/bookings/${bookingId}`) && r.request().method() === "PATCH",
      ),
      dialog.getByRole("button", { name: "Save changes" }).click(),
    ]);
    expect(patchResp.ok()).toBeTruthy();

    // Reload and confirm: one payment (500, paid), the removed one gone for
    // good, outstanding is now 0, and the completion guard auto-flipped
    // status to "completed" (kept as-is, per explicit product decision).
    await page.reload();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText(/Outstanding balance:\s*\D*0\b/)).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole("tab", { name: "Payments" }).click();
    await expect(dialog.getByText("Deposit B")).toHaveCount(0);
    await expect(dialog.getByText("Deposit A")).toBeVisible();
    await expect(dialog.getByText("Paid", { exact: true })).toHaveCount(1);

    await dialog.getByRole("tab", { name: "Notes & activity" }).click();
    await expect(dialog.getByText(/completed/i).first()).toBeVisible({ timeout: 10_000 });

    await dialog.getByRole("tab", { name: "Payments" }).click();

    // Invoice/receipt footer button — booking is now completed, so this
    // renders as "Download receipt". Confirm it opens a new tab to the PDF
    // route without a 4xx/5xx — byte contents are NOT inspected.
    const downloadBtn = dialog.getByRole("button", { name: /download (invoice|receipt)/i });
    await expect(downloadBtn).toBeVisible();
    // Attach both waiters before clicking — the popup can finish its
    // navigation before we'd otherwise get a handle to it, so waiting on
    // popup.waitForResponse() after the fact risks missing/timing out on an
    // already-completed response. The context-level "response" event catches
    // it regardless of which page/tab it belongs to. The route responds with
    // Content-Disposition: attachment, so Chromium may resolve the opened
    // target straight into a download without ever exposing it as a
    // "popup" page — the response is the real assertion; the popup is only
    // opportunistic cleanup, so it gets a short allowance, not the full wait.
    const popupPromise = page.waitForEvent("popup", { timeout: 5_000 }).catch(() => null);
    const pdfRespPromise = page.context().waitForEvent("response", (r) =>
      /\/api\/bookings\/.+\/(invoice|receipt)/.test(r.url()),
    );
    await downloadBtn.click();

    // This seeded workspace has no business address/contact email set, so
    // the pre-download completeness warning (item 14) intercepts the click —
    // dismiss it via "Download anyway" before the popup/response land.
    const downloadAnywayBtn = dialog.getByRole("button", { name: "Download anyway" });
    if (await downloadAnywayBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await downloadAnywayBtn.click();
    }

    const [popup, pdfResp] = await Promise.all([popupPromise, pdfRespPromise]);
    expect(pdfResp.status()).toBeLessThan(400);
    await popup?.close();
  });

  test(
    "3. invoice theme picker: presets + custom",
    async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/bookings");

    const themeBtn = page.getByRole("button", { name: "Invoice theme" });
    await expect(themeBtn).toBeVisible({ timeout: 30_000 });
    await themeBtn.click();

    const dialog = page.getByRole("dialog").filter({ hasText: "Invoice theme" });
    await expect(dialog).toBeVisible();

    // 4 presets + Custom tile.
    for (const name of ["Classic", "Slate", "Navy Gold", "Forest", "Custom"]) {
      await expect(dialog.getByRole("button", { name })).toBeVisible();
    }

    await dialog.getByRole("button", { name: "Slate" }).click();
    await expect(dialog.getByRole("button", { name: "Slate" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await dialog.getByRole("button", { name: "Navy Gold" }).click();
    await expect(dialog.getByRole("button", { name: "Navy Gold" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Custom tile reveals two color swatches.
    await dialog.getByRole("button", { name: "Custom" }).click();
    await expect(dialog.getByText("Main color")).toBeVisible();
    await expect(dialog.getByText("Accent color")).toBeVisible();

    await dialog.getByRole("button", { name: "Save and apply" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    },
  );

  test("4. RTL sanity: Arabic locale detail modal Payments tab", async ({ page }) => {
    expect(bookingId, "booking id from test 1 must be set").toBeTruthy();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/ar/bookings?detail=${bookingId}`);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl", { timeout: 30_000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    // Position-based tab click (index 2 = "Payments" equivalent) so this
    // doesn't depend on the Arabic translation string.
    await dialog.getByRole("tab").nth(2).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOT_DIR, "rtl-ar-detail-payments.png") });
  });
});
