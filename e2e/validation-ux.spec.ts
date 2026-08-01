import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Browser verification for the validation-ux branch: bookings filter defaults,
// location-picker error placement, and the client-match dialog.
//
// Read-mostly by design — the seeded dev DB is shared, so these assert on
// rendered state and URL transitions rather than submitting mutations.

async function gotoBookings(page: Page, query = "") {
  await page.goto(`/bookings${query}`);
  await page.getByRole("heading", { name: /bookings/i }).first().waitFor({ timeout: 90_000 });
}

test.describe("Task 1 — bookings filters default ON", () => {
  test("both toggles are ON with no URL params", async ({ page }) => {
    await gotoBookings(page);

    const cancelled = page.getByRole("switch", { name: /cancelled/i });
    const past = page.getByRole("switch", { name: /past/i });
    await expect(cancelled).toBeVisible();
    await expect(cancelled).toBeChecked();
    await expect(past).toBeChecked();
  });

  test("turning a toggle off adds =0 and turning it back on clears the param", async ({ page }) => {
    await gotoBookings(page);

    await page.getByRole("switch", { name: /cancelled/i }).click();
    await expect(page).toHaveURL(/includeCancelled=0/);

    await page.getByRole("switch", { name: /cancelled/i }).click();
    await expect(page).not.toHaveURL(/includeCancelled=0/);
  });

  test("Clear filters restores both toggles to ON", async ({ page }) => {
    await gotoBookings(page, "?includeCancelled=0&showPast=0");

    await expect(page.getByRole("switch", { name: /cancelled/i })).not.toBeChecked();
    await page.getByRole("button", { name: /clear filters/i }).click();

    await expect(page.getByRole("switch", { name: /cancelled/i })).toBeChecked();
    await expect(page.getByRole("switch", { name: /past/i })).toBeChecked();
  });
});

test.describe("Task 3 — location error renders above the map", () => {
  test("booking wizard marks the input invalid and puts the message before the map", async ({ page }) => {
    await gotoBookings(page);
    await page.getByRole("button", { name: /new booking|add booking/i }).first().click();

    // Step 1 is gated on picking a client — satisfy it before moving on.
    const dialog = page.getByRole("dialog");
    await dialog.getByText(/@/).first().click();

    // Walk to the event/pricing step, which holds the location picker.
    const input = page.locator("#wiz-location");
    for (let i = 0; i < 4 && !(await input.isVisible().catch(() => false)); i++) {
      await page.getByRole("button", { name: /^(next|continue)$/i }).first().click();
      await page.waitForTimeout(500);
    }
    await expect(input).toBeVisible({ timeout: 30_000 });

    // Advance with no location chosen — requiredness is enforced in the UI.
    await page.getByRole("button", { name: /^(next|continue|create|save)$/i }).first().click();

    await expect(input).toHaveAttribute("aria-invalid", "true", { timeout: 15_000 });

    const err = page.locator("[role='alert']").filter({ hasText: /location/i }).first();
    await expect(err).toBeVisible();

    // The whole point of the fix: the message must precede the map in DOM order.
    const map = page.locator(".leaflet-container").first();
    if (await map.count()) {
      const errBefore = await err.evaluate(
        (e, m) => !!(e.compareDocumentPosition(m as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
        await map.elementHandle(),
      );
      expect(errBefore, "error must precede the map").toBe(true);
    }
  });

  for (const bp of [
    { name: "375", width: 375, height: 812 },
    { name: "768", width: 768, height: 1024 },
    { name: "1280", width: 1280, height: 900 },
  ]) {
    test(`error stays visible next to the input @${bp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await gotoBookings(page);
      await page.getByRole("button", { name: /new booking|add booking/i }).first().click();
      await page.getByRole("dialog").getByText(/@/).first().click();

      const input = page.locator("#wiz-location");
      for (let i = 0; i < 4 && !(await input.isVisible().catch(() => false)); i++) {
        await page.getByRole("button", { name: /^(next|continue)$/i }).first().click();
        await page.waitForTimeout(500);
      }
      await expect(input).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: /^(next|continue|create|save)$/i }).first().click();

      const err = page.locator("[role='alert']").filter({ hasText: /location/i }).first();
      await expect(err).toBeInViewport();

      // The message must sit within a screenful of its input, not a map away.
      const inputBox = await input.boundingBox();
      const errBox = await err.boundingBox();
      expect(errBox!.y - inputBox!.y).toBeLessThan(120);

      await page.screenshot({ path: `e2e/__screenshots__/loc-error-${bp.name}.png` });
    });
  }
});

test.describe("Task 2 — CSV/XLSX import preview", () => {
  // Preview only. The dialog is two-step — file, then an explicit
  // "Import N booking(s)" — so everything up to that button is a dry run and
  // the shared seeded DB is never written to. Files are built in memory.
  const HEADERS =
    "clientName,clientEmail,startAt,endAt,title,eventType,status,amountTotal,amountDeposit,currency,locationAddress,notes";
  /** Tags anything this spec writes to the shared dev DB so it can be removed. */
  const E2E_MARKER = "ZZE2E";

  async function openImport(page: Page) {
    await gotoBookings(page);
    await page.getByRole("button", { name: /^import$/i }).first().click();
    return page.getByRole("dialog");
  }

  test("the column guide collapses, and documents the round-trip columns", async ({ page }) => {
    // booking_id and session_index are what make an export re-importable and
    // multi-session, and the guide listed neither.
    const dialog = await openImport(page);
    const guide = dialog.getByText(/table structure/i);
    await expect(guide).toBeVisible({ timeout: 20_000 });
    // Reference material, folded away by default.
    await expect(dialog.getByText("booking_id", { exact: true })).toBeHidden();

    await guide.click();
    await expect(dialog.getByText("booking_id", { exact: true })).toBeVisible();
    await expect(dialog.getByText("session_index", { exact: true })).toBeVisible();
    await expect(dialog.getByText("clientPhone", { exact: true })).toBeVisible();
    await expect(dialog.getByText("locationLat", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/update that booking instead of creating a copy/i)).toBeVisible();
  });

  test("offers a CSV and an XLSX template, both served by the route", async ({ page }) => {
    const dialog = await openImport(page);
    await expect(
      dialog.getByRole("link", { name: /download csv template/i })
    ).toHaveAttribute("href", "/api/bookings/import?format=csv", { timeout: 20_000 });
    await expect(
      dialog.getByRole("link", { name: /download xlsx template/i })
    ).toHaveAttribute("href", "/api/bookings/import?format=xlsx");
    await page.screenshot({ path: "e2e/__screenshots__/import-dialog-idle.png" });
  });

  test("the downloaded template imports cleanly through the preview", async ({ page }) => {
    // A template is only useful if it is itself a valid file. Fetched through
    // the browser session so it comes from the real route.
    await gotoBookings(page);
    const csv = await page.evaluate(async () => {
      const res = await fetch("/api/bookings/import?format=csv");
      return res.text();
    });
    expect(csv).toContain("payments");

    const dialog = await openImport(page);
    await dialog
      .locator('input[type="file"]')
      .setInputFiles({ name: "template.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

    // Two rows sharing one booking_id: one booking, two sessions.
    await expect(dialog.getByText(/2 row\(s\) found/i)).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText(/2 valid/i)).toBeVisible();
    await expect(dialog.getByText(/with errors/i)).toBeHidden();
    await dialog.getByRole("button", { name: /^cancel$/i }).click();
  });

  test("a wall-time midnight crossing fails in the preview, not on submit", async ({ page }) => {
    // 09:00Z-17:00Z is one UTC day but 17:00-01:00 in Manila. This used to
    // preview as valid and only fail once the row had been sent.
    const csv = [
      HEADERS,
      "Marisol Reyes,,2026-09-12T09:00:00.000Z,2026-09-12T17:00:00.000Z,Overnight Wedding,wedding,booked,185000,55000,PHP,Tagaytay,",
    ].join("\n");

    const dialog = await openImport(page);
    await dialog
      .locator('input[type="file"]')
      .setInputFiles({ name: "midnight.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

    await expect(dialog.getByText(/1 with errors/i)).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole("button", { name: /import 1 booking/i })).toBeHidden();

    // The message is longer than the cell, so the cell opens the full dialog.
    await dialog.getByRole("button", { name: /same day in your workspace timezone/i }).click();
    const errors = page.getByRole("dialog").filter({ hasText: /import errors/i });
    // Headed by the booking it belongs to, not just a line number.
    await expect(errors.getByText("Overnight Wedding")).toBeVisible();
    await expect(errors.getByText(/nothing has been imported yet/i)).toBeVisible();
    await page.screenshot({ path: "e2e/__screenshots__/import-preview-errors.png" });

    await page.keyboard.press("Escape");
  });

  test("offers a team picker when the workspace runs more than one team", async ({ page }) => {
    const dialog = await openImport(page);
    const picker = dialog.getByLabel(/assign to team/i);
    await expect(picker).toBeVisible({ timeout: 20_000 });
    // Default is the workspace's main team, matching the route's fallback.
    await expect(picker).toHaveValue("");
  });

  test("warns before re-importing a file, naming the team it already landed on", async ({ page }) => {
    // Writes once, then re-imports the same file to trigger the warning. The
    // second attempt is cancelled, so exactly one booking is created.
    // Unique per run: a leftover booking from a previous run would make the
    // FIRST upload warn, and the test would be asserting the wrong thing.
    const title = `${E2E_MARKER} Repeat ${Date.now()}`;
    const csv = [
      HEADERS,
      `${E2E_MARKER} Repeat Client,,2027-05-06T01:00:00.000Z,2027-05-06T09:00:00.000Z,${title},portrait,booked,1000,0,PHP,Studio,,`,
    ].join("\n");
    const upload = async () => {
      const dialog = await openImport(page);
      await dialog
        .locator('input[type="file"]')
        .setInputFiles({ name: "repeat.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
      await expect(dialog.getByText(/1 row\(s\) found/i)).toBeVisible({ timeout: 20_000 });
      await dialog.getByRole("button", { name: /import 1 booking/i }).click();
      return dialog;
    };

    const first = await upload();
    await expect(first.getByText(/imported 1 booking/i)).toBeVisible({ timeout: 30_000 });
    // Escape rather than a Close locator: the header X and the footer button
    // share that accessible name.
    await page.keyboard.press("Escape");
    await expect(first).toBeHidden();

    await upload();
    const warning = page.getByRole("dialog").filter({ hasText: /already imported/i });
    await expect(warning).toBeVisible({ timeout: 30_000 });
    await expect(warning.getByText(title)).toBeVisible();
    await expect(warning.getByText(/on team/i)).toBeVisible();
    await expect(warning.getByRole("button", { name: /import anyway/i })).toBeVisible();

    await warning.getByRole("button", { name: /^cancel$/i }).click();
    await expect(warning).toBeHidden();
  });

  test("a valid CSV previews its rows and offers to import them", async ({ page }) => {
    const csv = [
      HEADERS,
      // Explicit UTC instants: a naive "09:00" is read as browser-local time,
      // so the same row can be same-day here and midnight-crossing elsewhere.
      // These are 09:00-18:00 in Asia/Manila.
      "Marisol Reyes,marisol@example.com,2026-09-12T01:00:00.000Z,2026-09-12T10:00:00.000Z,Reyes Wedding,wedding,booked,185000,55000,PHP,Tagaytay,Golden hour",
    ].join("\n");

    const dialog = await openImport(page);
    await dialog
      .locator('input[type="file"]')
      .setInputFiles({ name: "rows.csv", mimeType: "text/csv", buffer: Buffer.from("﻿" + csv) });

    await expect(dialog.getByText(/1 row\(s\) found/i)).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText(/1 valid/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /import 1 booking/i })).toBeEnabled();

    // Leave without importing.
    await dialog.getByRole("button", { name: /^cancel$/i }).click();
  });

  test("an XLSX previews identically, via the server", async ({ page }) => {
    // XLSX is the path that actually leaves the browser: it is uploaded as
    // multipart and parsed server-side, then rendered by the same code as CSV.
    const xlsx = readFileSync(path.resolve(__dirname, "fixtures/bookings-valid.xlsx"));

    const dialog = await openImport(page);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "bookings-valid.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: xlsx,
    });

    await expect(dialog.getByText(/6 row\(s\) found/i)).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText(/6 valid/i)).toBeVisible();
    await dialog.getByRole("button", { name: /^cancel$/i }).click();
  });

  test("a row with blank optional cells counts as valid", async ({ page }) => {
    // The bug the sample files exposed: "" is not undefined, so a blank email
    // or event type used to fail the row. Both rows below are legal.
    const csv = [
      HEADERS,
      ",,bad-date,,,,,,,,,",
      "Valid Person,,2026-09-12T09:00,,Good Row,,,,,,,",
    ].join("\n");

    const dialog = await openImport(page);
    await dialog
      .locator('input[type="file"]')
      .setInputFiles({ name: "mixed.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

    await expect(dialog.getByText(/2 row\(s\) found/i)).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText(/1 valid/i)).toBeVisible();
    await expect(dialog.getByText(/1 with errors/i)).toBeVisible();
    await dialog.getByRole("button", { name: /^cancel$/i }).click();
  });

  test("committing an import reports what it wrote and shows it in the table", async ({ page }) => {
    // The only case here that actually WRITES. Everything it creates carries
    // E2E_MARKER so it can be found and removed afterwards.
    // Unique per run: a fixed title would hit the already-imported warning on
    // the second run instead of importing.
    const title = `${E2E_MARKER} Booking ${Date.now()}`;
    const csv = [
      HEADERS,
      `${E2E_MARKER} Client,,2027-03-04T01:00:00.000Z,2027-03-04T09:00:00.000Z,${title},portrait,booked,12345,0,PHP,Studio,,`,
    ].join("\n");

    const dialog = await openImport(page);
    await dialog
      .locator('input[type="file"]')
      .setInputFiles({ name: "commit.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

    await expect(dialog.getByText(/1 row\(s\) found/i)).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole("button", { name: /import 1 booking/i }).click();

    // The route answers created:1, and the dialog must say so rather than
    // "Imported 0" — the bug the review found on the updated-only path.
    // The count appears in both the dialog footer and a toast, so scope it.
    await expect(dialog.getByText(/imported 1 booking/i)).toBeVisible({ timeout: 30_000 });
    // The written row is echoed back in the preview table.
    await expect(dialog.getByText(title)).toBeVisible();
  });

  test("the formula guard is stripped before the user sees the row", async ({ page }) => {
    const csv = [HEADERS, "Kenji Watanabe,,2026-12-05T01:00,,'=SUM(1+1) Retreat,,,,,,,"].join("\n");

    const dialog = await openImport(page);
    await dialog
      .locator('input[type="file"]')
      .setInputFiles({ name: "guard.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

    // Previewing "'=SUM(1+1)" while storing "=SUM(1+1)" shows the user a value
    // they never get.
    await expect(dialog.getByText("=SUM(1+1) Retreat")).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole("button", { name: /^cancel$/i }).click();
  });
});

test.describe("Task 5c — inquiry duplicate-client indicator", () => {
  test("warns on an inquiry whose client collides, and opens the dialog in link mode", async ({
    page,
  }) => {
    // Needs an inquiry whose linked client collides with a DIFFERENT client.
    // Seeded inquiries each own a unique client, so this only fires once a
    // colliding client exists in the workspace.
    // Seed-dependent by nature: the indicator only fires when a colliding
    // client exists, which the seed never produces on its own. Skips rather
    // than fails if the fixture is absent.
    const inquiryId = process.env.E2E_MATCHED_INQUIRY_ID;
    test.skip(!inquiryId, "E2E_MATCHED_INQUIRY_ID not set — needs a colliding client in the seed");

    await page.goto(`/inquiries/${inquiryId}`);

    const resolve = page.getByRole("button", { name: /resolve client/i });
    await expect(resolve).toBeVisible({ timeout: 30_000 });
    // The glyph is never the only signal.
    await expect(page.getByText(/may belong to an existing client/i)).toBeVisible();

    await resolve.click();
    const match = page.getByRole("dialog").filter({ hasText: /is the client one of these/i });
    await expect(match).toBeVisible({ timeout: 20_000 });
    // Link mode changes only the copy on the two primary actions.
    await expect(match.getByRole("button", { name: /link client/i })).toBeVisible();

    await match.getByRole("button", { name: /^cancel$/i }).click();
    await expect(match).toBeHidden();
  });
});

test.describe("Task 5 — client match dialog", () => {
  test("a colliding name opens the match dialog instead of silently duplicating", async ({ page }) => {
    await page.goto("/clients");
    // Reuse an existing client's name so the collision is guaranteed. The name
    // cell also holds a bookings subtitle — take only its first line, or the
    // "name" is a string that matches nothing and a junk client gets created.
    const nameCell = await page
      .locator("table tbody tr td")
      .first()
      .innerText({ timeout: 60_000 });
    const existingName = nameCell.split("\n")[0].trim();
    expect(existingName.length, "seeded client name").toBeGreaterThan(0);

    await page.getByRole("button", { name: /new client|add client/i }).first().click();
    const form = page.getByRole("dialog");
    await form.getByLabel(/^name/i).first().fill(existingName);
    await form.getByRole("button", { name: /^(save|create)/i }).first().click();

    const match = page.getByRole("dialog").filter({ hasText: /is the client one of these/i });
    await expect(match).toBeVisible({ timeout: 20_000 });

    // Cancel writes nothing — this spec must not mutate the shared seed DB.
    await match.getByRole("button", { name: /^cancel$/i }).click();
    await expect(match).toBeHidden();
  });

  for (const bp of [
    { name: "375", width: 375, height: 812 },
    { name: "768", width: 768, height: 1024 },
    { name: "1280", width: 1280, height: 900 },
  ]) {
    test(`the reconcile step defaults to the stored value @${bp.name}px`, async ({ page }) => {
      // A conflict needs BOTH sides filled and different: the seeded client has
      // an email, so typing a different one forces step 2 — the step that
      // decides whether stored client data survives.
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/clients");
      const row = page.locator("table tbody tr").first();
      const existingName = (await row.locator("td").first().innerText({ timeout: 60_000 }))
        .split("\n")[0]
        .trim();
      const contact = await row.locator("td").nth(1).innerText();
      const existingEmail = contact.split("\n")[0].trim();
      expect(existingEmail, "seeded client needs an email to conflict with").toContain("@");

      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.getByRole("button", { name: /new client|add client/i }).first().click();
      const form = page.getByRole("dialog");
      await form.getByLabel(/^name/i).first().fill(existingName);
      await form.getByLabel(/^email/i).first().fill("different.address@example.com");
      await form.getByRole("button", { name: /^(save|create)/i }).first().click();

      const match = page.getByRole("dialog").filter({ hasText: /is the client one of these/i });
      await expect(match).toBeVisible({ timeout: 20_000 });
      await match.getByRole("radio", { name: existingName }).first().click();
      await match.getByRole("button", { name: /^save client$/i }).click();

      // Step 2. The default must be the STORED value — a default that discards
      // stored data is worse than one that keeps something stale.
      // Singular when exactly one field conflicts, which is this case.
      const reconcile = page.getByRole("dialog").filter({ hasText: /field differs/i });
      await expect(reconcile).toBeVisible({ timeout: 15_000 });
      await expect(reconcile.getByText(/^1 field differs/)).toBeVisible();
      await expect(reconcile.getByRole("radio", { name: existingEmail })).toBeChecked();
      await expect(
        reconcile.getByRole("radio", { name: "different.address@example.com" })
      ).not.toBeChecked();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow, "page must not scroll horizontally").toBe(false);

      await page.screenshot({ path: `e2e/__screenshots__/reconcile-${bp.name}.png` });
      // Cancel discards the whole reconciliation — nothing is written.
      await reconcile.getByRole("button", { name: /^cancel$/i }).click();
    });
  }

  for (const bp of [
    { name: "375", width: 375, height: 812 },
    { name: "768", width: 768, height: 1024 },
    { name: "1280", width: 1280, height: 900 },
  ]) {
    test(`match dialog is readable @${bp.name}px`, async ({ page }) => {
      // The list is a table at desktop width but cards at 375px — read the
      // name while the table exists, then resize to the breakpoint under test.
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/clients");
      const nameCell = await page
        .locator("table tbody tr td")
        .first()
        .innerText({ timeout: 60_000 });
      const existingName = nameCell.split("\n")[0].trim();

      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.getByRole("button", { name: /new client|add client/i }).first().click();
      const form = page.getByRole("dialog");
      await form.getByLabel(/^name/i).first().fill(existingName);
      await form.getByRole("button", { name: /^(save|create)/i }).first().click();

      const match = page.getByRole("dialog").filter({ hasText: /is the client one of these/i });
      await expect(match).toBeVisible({ timeout: 20_000 });

      // No horizontal overflow at any width.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow, "page must not scroll horizontally").toBe(false);

      await page.screenshot({ path: `e2e/__screenshots__/match-dialog-${bp.name}.png` });
      await match.getByRole("button", { name: /^cancel$/i }).click();
    });
  }
});
