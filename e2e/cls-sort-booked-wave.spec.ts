/**
 * Batched verification for the CLS / booked-date / sort / edit-indicator /
 * end-time wave (docs/tables/cls-sort-booked-date-plan.md). In-app chrome:
 * 1280px, plus one 375px check of the mobile sort control.
 *
 * Side-effect policy: creates exactly ONE booking via the wizard (unique
 * RUN_TAG title). The detail-modal edit is cancelled, never saved.
 */
import { test, expect, type Page } from "@playwright/test";

// WAVE_TAG reuses a booking a previous run already created (no second submit).
const RUN_TAG = process.env.WAVE_TAG ?? `PWT-${Date.now()}`;
const REUSE = Boolean(process.env.WAVE_TAG);
const CLIENT_NAME = `Wave Client ${RUN_TAG}`;
const BOOKING_TITLE = `Wave Booked Sort ${RUN_TAG}`;

function futureDateStr(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

async function installClsObserver(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __clsSources: string[] };
    w.__cls = 0;
    w.__clsSources = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as Array<
          PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] }
        >) {
          if (e.hadRecentInput) continue;
          w.__cls += e.value;
          for (const s of e.sources ?? []) {
            const n = s.node as Element | undefined;
            w.__clsSources.push(
              n && n.tagName ? `${n.tagName.toLowerCase()}[${String(n.className).slice(0, 60)}] ${e.value.toFixed(4)}` : String(n)
            );
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
  });
}

test.describe.serial("CLS / booked date / sort wave", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("wizard end-time sync, booked-desc default, sort, page fit, edit indicator", async ({
    page,
    context,
  }) => {
    // ── 1. Wizard: end time follows start time; create one booking ──
    if (!REUSE) {
    await page.goto("/bookings?add=1");
    const wizard = page.getByRole("dialog");
    await expect(wizard).toBeVisible({ timeout: 30_000 });
    await wizard.getByRole("button", { name: "Create new" }).click();
    await wizard.locator("#client-new-name").fill(CLIENT_NAME);
    await wizard.getByRole("button", { name: "Next" }).click();

    await wizard.locator("#wiz-title").fill(BOOKING_TITLE);
    const loc = wizard.locator("#wiz-location");
    await loc.fill("Rizal Park, Manila");
    await loc.blur();
    const accept = wizard.getByRole("button", { name: "Accept location" });
    await expect(accept).toBeEnabled({ timeout: 10_000 });
    await accept.click();
    await wizard.getByRole("button", { name: "Next" }).click();
    // Payments step: nothing required.
    await wizard.getByRole("button", { name: "Next" }).click();

    // Sessions step.
    await wizard.locator("#wiz-startDate-0").fill(futureDateStr(90 + (Date.now() % 200)));
    const start = wizard.locator("#wiz-startTime-0");
    const end = wizard.locator("#wiz-endTime-0");
    await start.fill("18:00");
    await expect(end).toHaveValue("19:00");
    // Start earlier than end again: end left alone.
    await start.fill("09:00");
    await expect(end).toHaveValue("19:00");
    // End typed below start snaps on blur.
    await start.fill("15:00");
    await end.fill("12:00");
    await end.blur();
    await expect(end).toHaveValue("16:00");

    const next = wizard.getByRole("button", { name: "Next" });
    await expect(next).toBeEnabled({ timeout: 15_000 });
    await next.click();
    await expect(wizard.getByText(BOOKING_TITLE)).toBeVisible();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/bookings") && r.request().method() === "POST"),
      wizard.getByRole("button", { name: "Create booking" }).click(),
    ]);
    expect(resp.ok()).toBeTruthy();
    await expect(wizard).toBeHidden({ timeout: 15_000 });
    }

    // ── 2. Table: Booked column, default booked desc, new booking first ──
    await page.goto("/bookings?view=table");
    const bookedHeader = page.locator("table thead th").nth(3);
    await expect(bookedHeader).toContainText("Booked on", { timeout: 30_000 });
    await expect(bookedHeader).toHaveAttribute("aria-sort", "descending");
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toContainText(BOOKING_TITLE);

    // ── 3. Server sort: title ("Booking") header ──
    const titleSort = page.locator("table thead").getByRole("button", { name: "Booking", exact: true });
    await titleSort.click();
    await page.waitForURL(/sort=title/, { timeout: 15_000 });
    const u = new URL(page.url());
    expect(u.searchParams.get("dir")).toBe("asc");
    expect(u.searchParams.get("page") ?? "1").toBe("1");
    await expect(page.locator("table thead th").first()).toHaveAttribute("aria-sort", "ascending");
    // Second click flips to desc (sort is always on, never cleared).
    await titleSort.click();
    await page.waitForURL(/dir=desc/, { timeout: 15_000 });
    await expect(page.locator("table thead th").first()).toHaveAttribute("aria-sort", "descending");

    // ── 4. Page fit cookie → page size + no skeleton→table shift ──
    await context.addCookies([
      { name: "gw_table_fit_bookings", value: "14", url: "http://localhost:3000" },
    ]);
    await installClsObserver(page);
    await page.goto("/bookings?view=table");
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    const rowCount = await page.locator("table tbody tr").count();
    const sizeTrigger = page.getByRole("combobox").filter({ hasText: /^14$/ });
    await expect(sizeTrigger).toBeVisible();
    await sizeTrigger.click();
    const optionTexts = await page.getByRole("option").allInnerTexts();
    await page.keyboard.press("Escape");
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    const clsSources = await page.evaluate(
      () => (window as unknown as { __clsSources: string[] }).__clsSources
    );
    console.log(`rows=${rowCount} options=${JSON.stringify(optionTexts)} cls=${cls.toFixed(4)}`);
    console.log(`cls sources: ${JSON.stringify(clsSources)}`);
    expect(optionTexts.map((t) => t.trim())).toEqual(["14", "20", "30", "50"]);
    expect(rowCount).toBeLessThanOrEqual(14);
    expect(cls).toBeLessThan(0.01);

    // ── 5. Detail modal: dirty editor → green confirm + footer status ──
    await page.goto(`/bookings?view=table&q=${encodeURIComponent(RUN_TAG)}`);
    const row = page.getByRole("button", { name: new RegExp(BOOKING_TITLE) });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 30_000 });
    await modal.getByRole("tab", { name: "Notes & activity" }).click();
    await modal.getByRole("button", { name: "Edit Notes" }).click();
    await modal.locator("textarea").first().fill("unconfirmed note");
    const confirm = modal.getByRole("button", { name: "Confirm", exact: true });
    await expect(confirm).toBeEnabled();
    await expect(confirm).toHaveClass(/success-bg/);
    const status = modal.getByRole("status").filter({ hasText: /isn't confirmed yet/ });
    await expect(status).toBeVisible();
    await expect(status).toContainText("1 change");
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(status).toBeHidden();
    await page.keyboard.press("Escape");

    // ── 6. Mobile sort control (375) ──
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/bookings?view=table");
    await expect(page.getByText("Sort by").first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: "test-results/cls-wave/375-bookings-sort.png" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/bookings?view=table");
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: "test-results/cls-wave/1280-bookings-table.png" });

    // ── 7. Both tables fit 1280 with the sidebar open (no clipped columns) ──
    const tableOverflow = () =>
      page.evaluate(() => {
        const wrap = document.querySelector("table")?.parentElement as HTMLElement | null;
        return wrap ? wrap.scrollWidth - wrap.clientWidth : -1;
      });
    expect(await tableOverflow(), "bookings table overflow at 1280").toBeLessThanOrEqual(1);
    await page.goto("/inquiries?view=table");
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("table thead th").filter({ hasText: "Booked on" })).toHaveCount(1);
    expect(await tableOverflow(), "inquiries table overflow at 1280").toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/cls-wave/1280-inquiries-table.png" });
  });
});
