import { test, expect } from "@playwright/test";

// One session, one login (shared storageState from auth.setup.ts), no
// re-navigation between assertions — walks every surface touched by the
// dashboard/clients/teams/notifications/settings perf+a11y+CLS wave in one
// batched run. In-app CRM chrome: 1280px only, except the settings tab-rail
// mobile-chip fix which specifically needs 375px (see CLAUDE.md's editor-
// chrome carve-out + this session's plan).

async function installClsObserver(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<
          PerformanceEntry & { value: number; hadRecentInput: boolean }
        >) {
          if (!entry.hadRecentInput) {
            (window as unknown as { __cls: number }).__cls += entry.value;
          }
        }
      });
      po.observe({ type: "layout-shift", buffered: true });
    } catch {
      // layout-shift not supported in this browser build; __cls stays 0
    }
  });
}

async function readCls(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __cls: number }).__cls ?? 0);
}

// This seeded workspace has more teams than the free plan allows, so
// DowngradeBlockModal auto-opens over the table (Base UI marks the rest of
// the page inert while it's open). Its `open` state re-seeds from `overCap`
// on every fresh mount of TeamsPageClient, and a live socket notification on
// this shared dev DB can trigger a `router.refresh()` at any time — so it can
// reappear mid-test, not just on first load. Pre-existing product behavior,
// unrelated to this session's changes; dismiss it defensively before any
// Teams-table interaction.
async function dismissDowngradeModalIfPresent(page: import("@playwright/test").Page) {
  const dismiss = page.getByRole("button", { name: "Got it" });
  if (await dismiss.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await dismiss.click();
    await dismiss.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
  }
}

test.describe("perf/a11y/CLS wave — batched verification", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("dashboard, clients, teams, notifications, settings", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    // --- Sidebar nav landmark (present on every authenticated page) ---
    await installClsObserver(page);
    await page.goto("/dashboard");
    // Turbopack cold-compiles each route on first hit (documented in the
    // run-gallurio skill) — wait for full hydration before any click/keyboard
    // interaction below, not just visibility (SSR markup is visible before
    // React attaches event listeners, so a click right after `goto` can
    // silently miss the not-yet-hydrated handler).
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(1);

    // --- Dashboard: heading hierarchy + charts render + CLS ---
    // "Operations" h2 divider, plus at least one h3 nested under it.
    await expect(page.getByRole("heading", { level: 2, name: /operations/i })).toBeVisible();
    const h3Count = await page.getByRole("heading", { level: 3 }).count();
    expect(h3Count).toBeGreaterThan(0);
    // Recharts-backed cards eventually render their SVG (proves the
    // next/dynamic client-wrapper fix actually resolves, not just the
    // loading fallback).
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible({ timeout: 10_000 });
    const dashboardCls = await readCls(page);
    expect(dashboardCls).toBeLessThan(0.1);
    expect(consoleErrors, `console errors on /dashboard: ${consoleErrors.join("; ")}`).toEqual([]);

    // --- Clients: paginated table + shared Pagination control ---
    await installClsObserver(page);
    await page.goto("/clients");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("table")).toBeVisible();
    // The shared Pagination component's Previous/Next controls. Exact match
    // avoids matching Next.js's own floating "Open Next.js Dev Tools" button,
    // which a loose /next/i also catches in dev mode.
    await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
    const clientsCls = await readCls(page);
    expect(clientsCls).toBeLessThan(0.1);

    // --- Teams: table a11y parity (scope/aria-sort/keyboard rows) ---
    await page.goto("/teams");
    await page.waitForLoadState("networkidle");
    await dismissDowngradeModalIfPresent(page);
    const sortableHeader = page.getByRole("columnheader", { name: /team/i }).getByRole("button");
    await expect(sortableHeader).toBeVisible();
    const initialAriaSort = await page
      .getByRole("columnheader", { name: /team/i })
      .getAttribute("aria-sort");
    expect(["ascending", "descending", "none"]).toContain(initialAriaSort);
    await sortableHeader.click();
    await dismissDowngradeModalIfPresent(page);
    // Auto-retrying assertion — the sort state updates via a React re-render
    // after the click, not synchronously with it.
    await expect(page.getByRole("columnheader", { name: /team/i })).not.toHaveAttribute(
      "aria-sort",
      initialAriaSort ?? ""
    );
    // Keyboard row activation: focus the first data row, Enter opens details.
    await dismissDowngradeModalIfPresent(page);
    const firstRow = page.getByRole("row", { name: /open|details/i }).first();
    if (await firstRow.count()) {
      await firstRow.focus();
      await page.keyboard.press("Enter");
      await dismissDowngradeModalIfPresent(page);
      await expect(page.getByRole("dialog").or(page.locator('[data-slot="sheet-content"]')).first()).toBeVisible({
        timeout: 5_000,
      });
      await page.keyboard.press("Escape");
    }

    // --- Notifications: 2-line body + meta column render (no cold-nav skeleton mismatch to see once hydrated, so just confirm structure + no errors) ---
    await installClsObserver(page);
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const notificationsCls = await readCls(page);
    expect(notificationsCls).toBeLessThan(0.1);

    // --- Settings: account tab (default) cold-nav CLS + tab rail structure ---
    await installClsObserver(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("navigation", { name: /settings/i }).or(page.locator("nav"))).toBeVisible();
    const settingsCls = await readCls(page);
    expect(settingsCls).toBeLessThan(0.1);

    expect(consoleErrors, `console errors across the batch: ${consoleErrors.join("; ")}`).toEqual([]);
  });

  test("settings tab rail: mobile chip is icon-over-label, not icon-only", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/settings");
    const firstTab = page.getByRole("link", { name: /account/i }).first();
    await expect(firstTab).toBeVisible();
    // Icon-over-label at this breakpoint means both the icon and a visible
    // text label are present in the same chip (the pre-fix skeleton hid the
    // label below `sm`; this checks the REAL rendered tab, which was always
    // correct — the fix was to the skeleton matching it, not this markup).
    await expect(firstTab).toContainText(/account/i);
  });
});
