import { test, expect, type Page } from "@playwright/test";

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
