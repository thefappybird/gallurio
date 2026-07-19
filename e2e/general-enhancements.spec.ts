import { test, expect } from "@playwright/test";

// Visual verification for the general-enhancements branch. One test, several
// steps: captures screenshots for manual review and asserts the key fixes.
test("general enhancements visual verification", async ({ page }) => {
  await test.step("collapsed sidebar keeps the bell visible + active states", async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/en/dashboard");

    const bell = page.getByRole("button", { name: /notification/i }).first();
    await expect(bell).toBeVisible();

    // Collapse the sidebar (shadcn keyboard shortcut Ctrl+B).
    await page.keyboard.press("Control+b");
    await page.waitForTimeout(400);

    // Task 1: the bell icon must remain visible when collapsed.
    await expect(bell.locator("svg").first()).toBeVisible();
    await page.screenshot({ path: "e2e/__screenshots__/ge-sidebar-collapsed.png" });

    // Re-expand.
    await page.keyboard.press("Control+b");
    await page.waitForTimeout(400);

    // Task 2: opening the bell popover marks the bell active. The sidebar
    // renders the active state as a present (empty-valued) data-active attribute.
    await bell.click();
    await page.waitForTimeout(250);
    await expect(bell).toHaveAttribute("data-active", "");
    await page.screenshot({ path: "e2e/__screenshots__/ge-bell-active.png" });
    await page.keyboard.press("Escape");
  });

  await test.step("theme popover highlights the active option", async () => {
    // Fresh load to clear the bell popover overlay from the previous step.
    await page.goto("/en/dashboard");
    const themeTrigger = page.getByRole("button", { name: /theme/i }).first();
    await themeTrigger.click();
    await page.waitForTimeout(250);
    const activeItem = page.locator('[role="menuitem"][data-active="true"]');
    await expect(activeItem).toHaveCount(1);
    await expect(activeItem).toBeVisible();
    await page.screenshot({ path: "e2e/__screenshots__/ge-theme-active.png" });
    await page.keyboard.press("Escape");
  });

  await test.step("mobile 375px renders the dashboard + sidebar sheet", async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/en/dashboard");
    await expect(page.locator("main")).toBeVisible();
    await page.screenshot({ path: "e2e/__screenshots__/ge-mobile-dashboard.png" });

    const trigger = page.getByRole("button", { name: /toggle sidebar/i }).first();
    if (await trigger.count()) {
      await trigger.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: "e2e/__screenshots__/ge-mobile-sidebar.png" });
    }
  });
});
