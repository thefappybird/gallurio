import path from "node:path";
import { test, expect, type Page, type Request } from "@playwright/test";

// Batched verification for the calendars / round-trip / react-query wave.
// Two runs, one login (shared storageState), minimal side effects on the
// shared seeded dev DB: the only mutation is a booking title rename that is
// restored in the same test.

const SHOT_DIR = path.resolve(
  process.env.PLAYWRIGHT_SCREENSHOT_DIR ?? "test-results/calendars-query-cache",
);

async function installClsObserver(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<
          PerformanceEntry & { value: number; hadRecentInput: boolean }
        >) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // layout-shift unsupported; __cls stays 0
    }
  });
}

const readCls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cls: number }).__cls ?? 0);

function recordRequests(page: Page) {
  const reqs: Request[] = [];
  page.on("request", (r) => reqs.push(r));
  return {
    all: reqs,
    since(mark: number) {
      return reqs.slice(mark);
    },
    mark() {
      return reqs.length;
    },
  };
}

const isRsc = (r: Request) => r.headers()["rsc"] === "1";
const isAction = (r: Request) => r.method() === "POST" && Boolean(r.headers()["next-action"]);
const pathOf = (r: Request) => new URL(r.url()).pathname;

async function noHorizontalOverflow(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  expect(sw, "page must not scroll horizontally").toBeLessThanOrEqual(iw + 1);
}

async function settle(page: Page, ms = 1_500) {
  await page.waitForTimeout(ms);
}

test.describe("calendars + query cache wave", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("bookings: window nav, one-request modals, lazy picker, table a11y, breakpoints", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const net = recordRequests(page);

    // --- Calendar cold load: CLS + calendar renders from the lazy chunk ---
    await installClsObserver(page);
    await page.goto("/bookings?view=calendar");
    await page.locator(".rbc-calendar").waitFor({ timeout: 90_000 });
    await settle(page, 2_000);
    const calCls = await readCls(page);
    test.info().annotations.push({ type: "cls:/bookings calendar", description: calCls.toFixed(4) });
    expect(calCls).toBeLessThan(0.1);
    await page.screenshot({ path: path.join(SHOT_DIR, "bookings-calendar-1280.png") });

    // --- Window nav: one "next" stays inside the padded window (no RSC fetch) ---
    const nextBtn = page.getByRole("button", { name: /^next$/i }).first();
    let m = net.mark();
    await nextBtn.click();
    await settle(page);
    expect(net.since(m).filter(isRsc), "1 month forward must stay inside the window").toHaveLength(0);

    // --- ...and leaving the window triggers exactly one RSC fetch with ?date= ---
    // Month +1 is inside the padded window; +2 leaves it (one re-centred fetch);
    // +3 is inside the re-centred window. Wait for each fetch to land before
    // the next click so a click during a pending transition can't double-fetch.
    m = net.mark();
    for (let i = 0; i < 2; i++) {
      await nextBtn.click();
      await settle(page, 3_000);
    }
    await expect.poll(() => new URL(page.url()).searchParams.get("date")).not.toBeNull();
    await settle(page, 2_000);
    const navRsc = net.since(m).filter(isRsc);
    test.info().annotations.push({ type: "rsc fetches for +3 months", description: String(navRsc.length) });
    expect(navRsc, "leaving the window costs exactly one RSC fetch").toHaveLength(1);
    await expect(page.locator(".rbc-calendar")).toBeVisible();
    await page.getByRole("button", { name: /^today$/i }).first().click();
    await settle(page, 2_500);

    // --- Detail modal: ONE booking request (include=activity), no names call, <=1 shifts ---
    const candle = page.locator(".rbc-event").first();
    await candle.waitFor({ timeout: 30_000 });
    m = net.mark();
    await candle.click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await settle(page, 2_500);
    const opened = net.since(m);
    const bookingGets = opened.filter(
      (r) => r.method() === "GET" && /^\/api\/bookings\/[a-f0-9]{24}$/.test(pathOf(r)),
    );
    test.info().annotations.push({
      type: "detail modal requests",
      description: opened.filter((r) => pathOf(r).startsWith("/api/")).map((r) => pathOf(r)).join(", "),
    });
    expect(bookingGets).toHaveLength(1);
    expect(bookingGets[0]!.url()).toContain("include=activity");
    expect(opened.filter((r) => pathOf(r) === "/api/users/names")).toHaveLength(0);
    expect(opened.filter((r) => pathOf(r) === "/api/bookings/shifts-on-date").length).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(SHOT_DIR, "bookings-detail-1280.png") });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // --- Detail modal error state: forced 500 -> error + Retry recovers ---
    const detailRoute = /\/api\/bookings\/[a-f0-9]{24}\?include=activity/;
    let failDetail = true;
    await page.route(detailRoute, (route) =>
      failDetail
        ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
        : route.continue(),
    );
    // A fresh key is needed so the cached booking isn't served: use a different candle.
    const otherCandle = page.locator(".rbc-event").nth(1);
    if (await otherCandle.count()) {
      await otherCandle.click();
      const retry = page.getByRole("button", { name: /retry/i }).first();
      await expect(retry).toBeVisible({ timeout: 30_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, "bookings-detail-error-1280.png") });
      failDetail = false;
      await retry.click();
      await expect(retry).toBeHidden({ timeout: 30_000 });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });
    }
    await page.unroute(detailRoute);

    // --- Drag reschedule: ONE PATCH (forced 409), no pre-flight, no RSC, rollback ---
    await page.route(/\/api\/bookings\/[a-f0-9]{24}$/, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              error: "conflict",
              conflicts: [
                { id: "e2e", bookingId: "e2e", sessionIndex: 0, title: "E2E Conflict", shiftStart: "10:00", shiftEnd: "11:00" },
              ],
            }),
          })
        : route.continue(),
    );
    const dragCandle = page.locator(".rbc-month-view .rbc-event").first();
    await dragCandle.waitFor({ timeout: 30_000 });
    const before = await dragCandle.boundingBox();
    const cell = before ? await page.locator(".rbc-month-view .rbc-day-bg").all() : [];
    // Target: the day cell one column to the right of the candle, same row.
    const target = before
      ? await (async () => {
          for (const c of cell) {
            const b = await c.boundingBox();
            if (b && b.y <= before.y && b.y + b.height >= before.y && b.x > before.x + before.width / 2) return b;
          }
          return null;
        })()
      : null;
    if (before && target) {
      m = net.mark();
      await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
      await page.mouse.down();
      await page.mouse.move(before.x + before.width / 2 + 10, before.y + before.height / 2, { steps: 5 });
      await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
      await page.mouse.up();
      await settle(page, 3_000);
      const dragReqs = net.since(m);
      const patches = dragReqs.filter((r) => r.method() === "PATCH" && /\/api\/bookings\//.test(pathOf(r)));
      test.info().annotations.push({
        type: "drag requests",
        description: dragReqs.filter((r) => pathOf(r).startsWith("/api/") || isRsc(r)).map((r) => `${r.method()} ${pathOf(r)}${isRsc(r) ? " [rsc]" : ""}`).join(", "),
      });
      expect(patches, "drag = exactly one PATCH").toHaveLength(1);
      expect(patches[0]!.postDataJSON()).toMatchObject({ rejectOnConflict: true });
      expect(dragReqs.filter((r) => pathOf(r) === "/api/bookings/shifts-on-date")).toHaveLength(0);
      expect(dragReqs.filter(isRsc), "no page refresh after a rejected drag").toHaveLength(0);
      await expect(page.getByText(/E2E Conflict/).first()).toBeVisible({ timeout: 10_000 });
      const after = await dragCandle.boundingBox();
      expect(Math.abs((after?.x ?? 0) - before.x), "candle rolled back").toBeLessThan(4);
    } else {
      test.info().annotations.push({ type: "drag", description: "skipped: no candle with a right-hand neighbour cell" });
    }
    await page.unroute(/\/api\/bookings\/[a-f0-9]{24}$/);

    // --- Wizard: client list fetched lazily once, served from cache on reopen ---
    const newBooking = page.getByRole("button", { name: /new booking/i }).first();
    m = net.mark();
    await newBooking.click();
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 30_000 });
    await settle(page, 2_000);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });
    await newBooking.click();
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 30_000 });
    await settle(page, 1_500);
    const clientCalls = net.since(m).filter((r) => pathOf(r) === "/api/clients");
    expect(clientCalls, "picker loads once, reopen is cached").toHaveLength(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });

    // --- Table view: aria-sort + measured row height vs skeleton constant ---
    await installClsObserver(page);
    await page.goto("/bookings?view=table");
    await page.getByRole("table").waitFor({ timeout: 60_000 });
    await settle(page, 1_500);
    const tableCls = await readCls(page);
    test.info().annotations.push({ type: "cls:/bookings table", description: tableCls.toFixed(4) });
    expect(tableCls).toBeLessThan(0.1);
    const sortable = page.locator("th[aria-sort]");
    expect(await sortable.count()).toBeGreaterThan(0);
    await expect(page.locator("th[scope=col]").first()).toBeVisible();
    const rowH = await page.locator("tbody tr").first().evaluate((el) => el.getBoundingClientRect().height);
    test.info().annotations.push({ type: "bookings row height (skeleton=49)", description: rowH.toFixed(1) });

    // --- Breakpoints: calendar + table at 768 and 375, no horizontal overflow ---
    for (const [w, h] of [
      [768, 1024],
      [375, 812],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await settle(page, 800);
      await noHorizontalOverflow(page);
      await page.screenshot({ path: path.join(SHOT_DIR, `bookings-table-${w}.png`) });
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/bookings?view=calendar");
    await page.locator(".rbc-calendar").waitFor({ timeout: 60_000 });
    await settle(page, 1_500);
    await noHorizontalOverflow(page);
    await page.screenshot({ path: path.join(SHOT_DIR, "bookings-calendar-375.png") });

    // --- Arabic (RTL) + dark at 1280: rendered strings, no raw keys, no overflow ---
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/ar/bookings?view=calendar");
    await page.locator(".rbc-calendar").waitFor({ timeout: 60_000 });
    await settle(page, 1_500);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bapp\.(bookings|inquiries)\.[a-zA-Z.]+/);
    await noHorizontalOverflow(page);
    await page.screenshot({ path: path.join(SHOT_DIR, "bookings-calendar-ar-dark-1280.png") });
    await page.emulateMedia({ colorScheme: "light" });

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("inquiries + dashboard cache + cross-tab socket invalidation", async ({ page, context }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const net = recordRequests(page);

    // --- Inquiries calendar: candles + conflict label reachable, CLS ---
    await installClsObserver(page);
    await page.goto("/inquiries?view=calendar");
    await page.locator(".rbc-calendar").waitFor({ timeout: 90_000 });
    await settle(page, 2_000);
    const inqCls = await readCls(page);
    test.info().annotations.push({ type: "cls:/inquiries calendar", description: inqCls.toFixed(4) });
    expect(inqCls).toBeLessThan(0.1);
    test.info().annotations.push({
      type: "conflict-labelled candles",
      description: String(await page.locator('[aria-label*="Conflict"]').count()),
    });
    await page.screenshot({ path: path.join(SHOT_DIR, "inquiries-calendar-1280.png") });

    // --- Inquiries table: opening the same inquiry twice = one server-action read ---
    await page.goto("/inquiries?view=table");
    await page.getByRole("table").waitFor({ timeout: 60_000 });
    await settle(page, 1_500);
    const firstRow = page.locator("tbody tr").first();
    const rowH = await firstRow.evaluate((el) => el.getBoundingClientRect().height);
    test.info().annotations.push({ type: "inquiries row height (skeleton=56)", description: rowH.toFixed(1) });
    let m = net.mark();
    await firstRow.click();
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 30_000 });
    await settle(page, 1_500);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });
    await firstRow.click();
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 30_000 });
    await settle(page, 1_500);
    const actionReads = net.since(m).filter(isAction);
    test.info().annotations.push({ type: "inquiry opens -> action calls", description: String(actionReads.length) });
    expect(actionReads.length).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");

    // --- /inquiries/[id]: loading -> page with no layout shift ---
    const href = await page.locator('a[href*="/inquiries/"]').first().getAttribute("href").catch(() => null);
    if (href) {
      await installClsObserver(page);
      await page.goto(href);
      await page.waitForLoadState("domcontentloaded");
      await settle(page, 3_000);
      const idCls = await readCls(page);
      test.info().annotations.push({ type: "cls:/inquiries/[id]", description: idCls.toFixed(4) });
      expect(idCls).toBeLessThan(0.1);
    }

    // --- Dashboard mini-calendar: revisiting a month is served from cache ---
    await page.goto("/dashboard");
    await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 60_000 });
    await settle(page, 2_000);
    const miniNext = page.getByRole("button", { name: /next month/i }).first();
    const miniPrev = page.getByRole("button", { name: /previous month/i }).first();
    if (await miniNext.isVisible().catch(() => false)) {
      await miniNext.click();
      await settle(page, 2_000);
      await miniPrev.click();
      await settle(page, 1_000);
      m = net.mark();
      await miniNext.click();
      await settle(page, 1_500);
      const byDay = net.since(m).filter((r) => pathOf(r) === "/api/bookings/by-day");
      expect(byDay, "revisited month served from cache").toHaveLength(0);
    }

    // --- Cross-tab: a mutation in tab A refreshes tab B's table via the socket ---
    const tabB = await context.newPage();
    await tabB.goto("/bookings?view=table");
    await tabB.getByRole("table").waitFor({ timeout: 60_000 });
    await settle(tabB, 3_000); // socket connect + join
    await tabB.locator("tbody tr").first().click();
    await expect.poll(() => new URL(tabB.url()).searchParams.get("detail"), { timeout: 30_000 }).not.toBeNull();
    const bookingId = new URL(tabB.url()).searchParams.get("detail")!;
    await tabB.keyboard.press("Escape");
    await expect(tabB.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });
    await settle(tabB, 1_000);

    const original = await page.evaluate(async (id) => {
      const r = await fetch(`/api/bookings/${id}`);
      return ((await r.json()) as { title: string }).title;
    }, bookingId);
    const renamed = `${original} (e2e sync)`;
    try {
      const status = await page.evaluate(
        async ([id, title]) =>
          (
            await fetch(`/api/bookings/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title }),
            })
          ).status,
        [bookingId, renamed] as const,
      );
      expect(status).toBe(200);
      await expect(tabB.getByText(renamed, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      await page.evaluate(
        async ([id, title]) => {
          await fetch(`/api/bookings/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          });
        },
        [bookingId, original] as const,
      );
    }
    await expect(tabB.getByText(original, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await tabB.close();

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
