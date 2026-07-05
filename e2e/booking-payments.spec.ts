/**
 * Verifies the booking-payments feature end-to-end in a real browser:
 *  1. Wizard "Payments" step — add a payment row, review summary, create.
 *  2. Detail modal — payments section renders, add a second payment, edit the
 *     FIRST existing payment's status (unpaid -> paid) without corruption.
 *  3. Completion guard / auto-complete — when every payment is paid and the
 *     paid sum + deposit matches the total, the PATCH auto-flips status to
 *     "completed" and the activity timeline reflects it.
 *  4. Invoice/receipt footer button — opens a new tab to the PDF route
 *     without a client error (byte contents are NOT inspected here).
 *  5. Invoice theme picker — 4 presets + Custom, save one selection.
 *  7. RTL sanity — Arabic locale renders the Payments section without
 *     breaking, <html dir="rtl">.
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
const PAYMENT_PRICE = "500";

function futureDateStr(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

test.describe.serial("Booking payments", () => {
  let bookingId = "";

  test("1. wizard Payments step round-trips into a new booking", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/bookings?add=1");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText("New booking")).toBeVisible();

    // ── Client step: switch to "new client" mode ──
    await dialog.getByRole("button", { name: "Create new" }).click();
    await dialog.locator("#client-new-name").fill(CLIENT_NAME);
    await dialog.getByRole("button", { name: "Next" }).click();

    // ── Event & Pricing step ──
    await dialog.locator("#wiz-title").fill(BOOKING_TITLE);
    await dialog.locator("#wiz-total").fill(PAYMENT_PRICE);

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
    await dialog.getByRole("button", { name: "Add payment" }).click();
    await dialog.locator("#wiz-payment-price-0").fill(PAYMENT_PRICE);
    // Explicitly interact with the status select (even though "Unpaid" is the
    // append() default) to exercise the control end-to-end.
    await dialog.locator("#wiz-payment-status-0").click();
    await page.getByRole("option", { name: "Unpaid" }).click();

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
    await expect(dialog.getByText("Unpaid")).toBeVisible();

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
    const newRow = page.getByRole("row", { name: new RegExp(BOOKING_TITLE) });
    await expect(newRow).toBeVisible({ timeout: 15_000 });
    await newRow.click();
    await page.waitForURL(/[?&]detail=/, { timeout: 15_000 });
    const url = new URL(page.url());
    bookingId = url.searchParams.get("detail") ?? "";
    expect(bookingId).toBeTruthy();
  });

  test("2+3+4. detail modal payment editing, completion guard, invoice/receipt button", async ({
    page,
  }) => {
    expect(bookingId, "booking id from test 1 must be set").toBeTruthy();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/bookings?detail=${bookingId}`);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    const eventTab = dialog.getByRole("tab", { name: "Event & Location" });
    await eventTab.click();

    // Payments section: one payment (price/status) rendered.
    const editPayment1Btn = dialog.getByRole("button", { name: "Edit Payment 1" });
    await expect(editPayment1Btn).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText("Unpaid")).toBeVisible();

    // Breakpoint screenshots of the detail-modal Payments section.
    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOT_DIR, `${bp.name}-detail-payments.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    // Add a second payment (price 0, status -> paid) so paid-sum == total.
    await dialog.getByRole("button", { name: "Add payment" }).click();
    await dialog.locator("#payment-status-0").click();
    await page.getByRole("option", { name: "Paid", exact: true }).click();

    // Edit the FIRST existing payment: unpaid -> paid (the bug this verifies).
    await editPayment1Btn.click();
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

    // Reload the detail view and confirm both payments persisted correctly
    // (not swapped/corrupted), and that the completion guard fired: both
    // payments are now "paid" and price sum (500 + 0) + deposit (0) == total
    // (500), so the PATCH should have auto-flipped status to "completed".
    await page.reload();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole("tab", { name: "Event & Location" }).click();
    await expect(dialog.getByRole("button", { name: "Edit Payment 1" })).toBeVisible({
      timeout: 15_000,
    });
    const paidBadges = dialog.getByText("Paid", { exact: true });
    await expect(paidBadges).toHaveCount(2);
    await expect(dialog.getByText("Unpaid")).toHaveCount(0);

    // Activity timeline reflects the status change to completed.
    await dialog.getByRole("tab", { name: "Notes & activity" }).click();
    await expect(dialog.getByText(/completed/i).first()).toBeVisible({ timeout: 10_000 });

    await dialog.getByRole("tab", { name: "Event & Location" }).click();

    // Invoice/receipt footer button — booking is now completed, so this
    // renders as "Download receipt". Confirm it opens a new tab to the PDF
    // route without a 4xx/5xx — byte contents are NOT inspected.
    const downloadBtn = dialog.getByRole("button", { name: /download (invoice|receipt)/i });
    await expect(downloadBtn).toBeVisible();
    // Attach both waiters before clicking — the popup can finish its
    // navigation before we'd otherwise get a handle to it, so waiting on
    // popup.waitForResponse() after the fact risks missing/timing out on an
    // already-completed response. The context-level "response" event catches
    // it regardless of which page/tab it belongs to.
    const popupPromise = page.waitForEvent("popup");
    const pdfRespPromise = page.context().waitForEvent("response", (r) =>
      /\/api\/bookings\/.+\/(invoice|receipt)/.test(r.url()),
    );
    await downloadBtn.click();
    const [popup, pdfResp] = await Promise.all([popupPromise, pdfRespPromise]);
    expect(pdfResp.status()).toBeLessThan(400);
    await popup.close();
  });

  test(
    "5. invoice theme picker: presets + custom",
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

  test("7. RTL sanity: Arabic locale detail modal", async ({ page }) => {
    expect(bookingId, "booking id from test 1 must be set").toBeTruthy();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/ar/bookings?detail=${bookingId}`);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl", { timeout: 30_000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    // Position-based tab click (index 1 = "Event & Location" equivalent) so
    // this doesn't depend on the Arabic translation string.
    await dialog.getByRole("tab").nth(1).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOT_DIR, "rtl-ar-detail-payments.png") });
  });
});
