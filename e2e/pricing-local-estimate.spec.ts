import { test, expect } from "@playwright/test";

// Public pricing page — anonymous, same reason as marketing-landing.spec.ts.
test.use({ storageState: { cookies: [], origins: [] } });

// Locally there is no CF-IPCountry header, so the estimate falls back to USD.
// The note is absent entirely when no FX rate is available (no API key,
// network failure) — that fail-closed path is covered by unit tests.
const ESTIMATE = /≈\s*\$[\d,.]+ · billed in PHP/;

for (const width of [375, 768, 1280]) {
  test(`pricing page shows the local-currency estimate at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/pricing");

    await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();

    // Two estimates: one under the monthly price, one beside the yearly note.
    const notes = page.getByText(ESTIMATE);
    await expect(notes).toHaveCount(2);
    await expect(notes.first()).toBeVisible();
    await expect(notes.last()).toBeVisible();

    // The billed price stays the primary figure.
    await expect(page.getByText(/₱\s?\d/).first()).toBeVisible();

    // No horizontal overflow introduced by the extra line.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });
}
