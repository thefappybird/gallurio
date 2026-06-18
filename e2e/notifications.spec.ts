import { test, expect, type Page } from "@playwright/test";

// Selectors (no data-testids exist on these elements — see app-sidebar.tsx /
// NotificationPopover.tsx). Bell is a SidebarMenuButton with an aria-label that
// always contains "notifications"; the desktop popover is role=dialog aria-label
// "Notifications".
const bell = (page: Page) =>
  page.getByRole("button", { name: /notifications/i }).first();
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: /notifications/i });

// All desktop checks share ONE page load (per the "no unnecessary API calls"
// rule): badge format, icon parity, popover anchor expanded, then collapsed.
test("desktop: bell, badge, and popover anchor (expanded + collapsed)", async ({
  page,
}) => {
  await page.goto("/dashboard");

  const trigger = bell(page);
  await expect(trigger).toBeVisible();

  // --- Unread badge: present and correctly formatted (number or "99+"). ---
  const badge = trigger.locator('span[aria-hidden="true"]');
  if ((await badge.count()) > 0) {
    await expect(badge).toHaveText(/^(\d{1,2}|99\+)$/);
  }

  // --- Bell icon sizing matches the other sidebar nav icons (size-5). ---
  const menuIcons = page.locator('[data-sidebar="menu-button"] svg');
  const bellIconBox = await menuIcons.nth(0).boundingBox();
  const navIconBox = await menuIcons.nth(1).boundingBox();
  expect(bellIconBox).not.toBeNull();
  expect(navIconBox).not.toBeNull();
  expect(Math.round(bellIconBox!.height)).toBe(Math.round(navIconBox!.height));
  expect(Math.round(bellIconBox!.width)).toBe(Math.round(navIconBox!.width));

  // --- Popover anchors to top:0 and to the right edge of the EXPANDED sidebar. ---
  await trigger.click();
  const panel = dialog(page);
  await expect(panel).toBeVisible();
  let box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThanOrEqual(1); // top-0
  // Expanded sidebar = 16rem (256px); popover left = width + 1px.
  expect(Math.abs(box!.x - 257)).toBeLessThanOrEqual(3);

  // Close before toggling the sidebar. The popover has no Escape handler
  // (a11y finding, tracked separately) — dismiss via the desktop click-outside
  // backdrop (z-[9997], covers the sidebar so a top-left click hits it).
  await page
    .locator("div.fixed.inset-0.z-\\[9997\\]")
    .click({ position: { x: 5, y: 5 } });
  await expect(panel).toBeHidden();

  // --- Collapse the sidebar, reopen, and confirm the anchor follows it. ---
  await page.locator('button[data-sidebar="trigger"]').first().click();
  await expect(page.locator('[data-slot="sidebar"]').first()).toHaveAttribute(
    "data-state",
    "collapsed",
  );

  await bell(page).click();
  await expect(panel).toBeVisible();
  box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThanOrEqual(1); // still top-0
  // Collapsed (icon) sidebar = 4rem (64px); popover left = width + 1px.
  expect(Math.abs(box!.x - 65)).toBeLessThanOrEqual(3);
});

// Mobile needs a different viewport, so a second page load is justified.
test("mobile (375px): popover opens as a full-screen overlay", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");

  // NOTE: there is no visible SidebarTrigger outside the sidebar on mobile, so a
  // real user currently cannot open the sheet / reach the bell (app-shell bug,
  // reported separately). Open the off-canvas sheet via the Ctrl/Cmd+B shortcut
  // to verify the notification overlay's mobile branch renders correctly.
  await page.keyboard.press("ControlOrMeta+b");
  await bell(page).click();

  // The mobile branch renders a full-screen overlay (fixed inset-0 z-[9999]),
  // distinct from the desktop side panel (which is md:flex / hidden here).
  const overlay = page.locator("div.fixed.inset-0.z-\\[9999\\]");
  await expect(overlay).toBeVisible();
  const box = await overlay.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.width)).toBe(375);
  expect(box!.y).toBeLessThanOrEqual(1);

  // The desktop side panel must NOT be visible at this viewport.
  await expect(dialog(page)).toBeHidden();
});
