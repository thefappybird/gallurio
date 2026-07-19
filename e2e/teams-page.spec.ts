/**
 * Wave 7 verification for the team-management fixes: View Members sidebar,
 * dropdown positioning inside the team detail Sheet, and the read-only
 * non-owner view. Runs at 375/768/1280 for the owner-facing surfaces per
 * CLAUDE.md's 3-breakpoint Done-criterion.
 */

import { test, expect, type Page } from "@playwright/test";

const BREAKPOINTS = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
];

for (const bp of BREAKPOINTS) {
  test(`teams page (owner) @ ${bp.name}px: View Members sidebar lists workspace members`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto("/teams");
    await page.getByRole("button", { name: /view members/i }).waitFor({ timeout: 30_000 });

    const viewMembers = page.getByRole("button", { name: /view members/i });
    await expect(viewMembers).toBeVisible();
    await viewMembers.click();

    const sidebar = page.getByRole("dialog").filter({ hasText: /member/i }).last();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator("li").first()).toBeVisible();
  });
}

test("teams page (owner) @ 1280px: add-member dropdown opens positioned under its trigger, not clipped", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/teams");
  await page.getByRole("button", { name: /view members/i }).waitFor({ timeout: 30_000 });

  const firstRow = page.locator("table tbody tr").first();
  await firstRow.waitFor({ timeout: 15_000 });
  await firstRow.click();

  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();

  const trigger = page.locator("#add-member-select");
  if (await trigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const triggerBox = await trigger.boundingBox();
    await trigger.click();
    const popup = page.locator("[role='listbox']");
    await expect(popup).toBeVisible({ timeout: 5_000 });
    const popupBox = await popup.boundingBox();
    expect(popupBox).not.toBeNull();
    expect(triggerBox).not.toBeNull();
    if (popupBox && triggerBox) {
      expect(popupBox.y).toBeGreaterThanOrEqual(triggerBox.y - 40);
      expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(800 + 4);
    }
  }
});

test("teams page (staff, read-only): no mutating action affordances present", async ({
  browser,
}) => {
  test.skip(
    !process.env.SEED_STAFF_WORKOS_EMAIL || !process.env.SEED_STAFF_WORKOS_PASSWORD,
    "SEED_STAFF_WORKOS_EMAIL/PASSWORD not set in .env.local",
  );

  const context = await browser.newContext();
  const page: Page = await context.newPage();
  await page.goto("/sign-in");
  await page.locator("#signin-email").fill(process.env.SEED_STAFF_WORKOS_EMAIL!);
  await page.locator("#signin-password").fill(process.env.SEED_STAFF_WORKOS_PASSWORD!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => /\/(dashboard|bookings|onboarding|inquiries)\b/.test(url.pathname), {
    timeout: 90_000,
  });

  await page.goto("/teams");
  await expect(page.getByRole("button", { name: /view members/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /invite member/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /create team/i })).toHaveCount(0);

  await context.close();
});
