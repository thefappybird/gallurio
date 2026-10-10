import path from "node:path";
import { test, expect, type Page, type BrowserContext, type Locator } from "@playwright/test";
import mongoose from "mongoose";
import { connectDb, disconnectDb, findStaffScenario, listenAs, type Probe } from "./fixtures/realtime-probe";

// Data-integrity run: a booking edited by a teammate (tab B, separate browser
// context = separate socket) must show up on every surface of tab A without a
// manual reload, a stale save from A must never overwrite B's write, and the
// realtime audience must follow team visibility. Every write is reverted in
// `finally` (seeded dev DB is shared).

const SHOT_DIR = path.resolve(process.env.PLAYWRIGHT_SCREENSHOT_DIR ?? "test-results/data-integrity");
const LIVE = { timeout: 15_000 };

type BookingJson = { _id: string; title: string; updatedAt: string; clientId?: string; clientName?: string; sessions?: Array<{ startAt: string }> };

async function getBooking(page: Page, id: string): Promise<BookingJson> {
  return page.evaluate(async (bid) => {
    const r = await fetch(`/api/bookings/${bid}`);
    const j = await r.json();
    return (j.booking ?? j) as BookingJson;
  }, id);
}

async function patchBooking(page: Page, id: string, body: Record<string, unknown>) {
  return page.evaluate(
    async ([bid, b]) => {
      const r = await fetch(`/api/bookings/${bid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    [id, body] as const,
  );
}

const settle = (page: Page, ms = 1_500) => page.waitForTimeout(ms);

/** UTC instant of wall time `hhmm` on `date` (YYYY-MM-DD) in `tz`. */
function wallToUtc(date: string, hhmm: string, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(guess));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asIfUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"));
  return new Date(guess - (asIfUtc - guess));
}

/** Drag a month-view candle to later day cells until `persisted()` confirms one drop (conflicting days are rejected). */
async function dragToAnotherDay(page: Page, candle: Locator, persisted: () => Promise<boolean>): Promise<boolean> {
  await candle.waitFor({ timeout: 30_000 });
  const start = (await candle.boundingBox())!;
  const targets = [];
  for (const c of await page.locator(".rbc-month-view .rbc-day-bg").all()) {
    const b = await c.boundingBox();
    const sameRowLater = b && b.y <= start.y && b.y + b.height >= start.y && b.x > start.x + start.width / 2;
    const laterRow = b && b.y > start.y + start.height;
    if (b && (sameRowLater || laterRow)) targets.push(b);
  }
  for (const target of targets.slice(0, 4)) {
    const cur = (await candle.boundingBox())!;
    const done = persisted();
    await page.mouse.move(cur.x + cur.width / 2, cur.y + cur.height / 2);
    await page.mouse.down();
    await page.mouse.move(cur.x + cur.width / 2 + 10, cur.y + cur.height / 2, { steps: 5 });
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
    await page.mouse.up();
    if (await done) return true;
    await settle(page, 1_500);
  }
  return false;
}
const tableText = (page: Page, text: string) => page.getByRole("table").getByText(text, { exact: false }).first();

test.describe("data integrity: no surface serves stale data", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  let probes: Probe[] = [];
  test.afterAll(async () => {
    for (const p of probes) p.close();
    await disconnectDb();
  });

  test("booking edits propagate to every surface; stale saves are refused; audience follows team scope", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(420_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await connectDb();
    const scenario = await findStaffScenario(process.env.SEED_OWNER_WORKOS_USER_ID!);
    expect(scenario, "seed needs a team booking with a non-owner member and a staff member outside that team").not.toBeNull();
    const { bookingId, workspaceId, insider, outsider } = scenario!;

    const [insiderProbe, outsiderProbe] = await Promise.all([
      listenAs(baseURL!, insider, workspaceId),
      listenAs(baseURL!, outsider, workspaceId),
    ]);
    probes = [insiderProbe, outsiderProbe];

    // Tab B = a teammate: separate context, separate socket.
    const ctxB: BrowserContext = await browser.newContext({ storageState: "e2e/.auth/owner.json" });
    const tabB = await ctxB.newPage();
    await tabB.goto("/settings");
    await tabB.waitForLoadState("domcontentloaded");

    const original = await getBooking(tabB, bookingId);
    const base = original.title;
    const clientId = String(original.clientId ?? "");
    const clientDoc = clientId
      ? await mongoose.connection.db!.collection("clients").findOne({ _id: new mongoose.Types.ObjectId(clientId) })
      : null;
    const originalClientName = (clientDoc?.name as string | undefined) ?? null;
    const sessionDate = original.sessions?.[0]?.startAt?.slice(0, 10) ?? null;
    const titled = (n: number) => `${base} · e2e ${n}`;
    const tableUrl = `/bookings?view=table&q=${encodeURIComponent(base)}`;
    let dashboardBooking: { id: string; title: string } | null = null;

    try {
      // ── 1. Open detail modal stays live (clean modal re-seeds) + realtime audience ──
      await page.goto(`${tableUrl}&detail=${bookingId}`);
      const dialog = page.getByRole("dialog").first();
      await expect(dialog).toBeVisible({ timeout: 60_000 });
      await expect(dialog.getByText(base).first()).toBeVisible({ timeout: 30_000 });
      await settle(page, 2_000); // socket connect

      expect((await patchBooking(tabB, bookingId, { title: titled(1) })).status).toBe(200);
      await expect(dialog.getByText(titled(1)).first(), "open, clean detail modal shows the teammate's edit").toBeVisible(LIVE);

      await expect
        .poll(() => insiderProbe.events.some((e) => e.event.type === "booking.updated" && e.event.bookingId === bookingId), LIVE)
        .toBe(true);
      await expect
        .poll(() => outsiderProbe.events.some((e) => e.event.type === "client.statsChanged"), LIVE)
        .toBe(true);
      expect.soft(
        outsiderProbe.events.filter((e) => e.event.type === "booking.updated" && e.event.bookingId === bookingId),
        "staff outside the booking's team never receive the booking event",
      ).toHaveLength(0);
      test.info().annotations.push({
        type: "audience",
        description: `insider=${insiderProbe.events.map((e) => e.event.type).join(",")} outsider=${outsiderProbe.events.map((e) => e.event.type).join(",")}`,
      });

      // ── 2. Lost-update protection: A edits on an old copy, B saves first ──
      await dialog.getByRole("button", { name: "Edit title" }).click();
      const titleInput = dialog.getByRole("textbox", { name: /title/i }).first();
      await titleInput.fill(`${base} · A stale edit`);
      await titleInput.press("Enter");
      expect((await patchBooking(tabB, bookingId, { title: titled(2) })).status).toBe(200);
      await expect.soft(dialog.getByText(/updated by someone else/i).first(), "dirty modal warns instead of clobbering").toBeVisible(LIVE);
      await dialog.getByRole("button", { name: /save changes/i }).click();
      await expect(page.getByText(/changed by someone else/i).first(), "stale save is refused with a message").toBeVisible(LIVE);
      expect((await getBooking(tabB, bookingId)).title, "B's write survives A's stale save").toBe(titled(2));
      await expect(dialog.getByText(titled(2)).first(), "modal rebased on the server copy").toBeVisible(LIVE);
      await page.screenshot({ path: path.join(SHOT_DIR, "stale-save-refused.png") });

      // API-level guard too: an explicitly old token is a 409 stale.
      const staleApi = await patchBooking(tabB, bookingId, { title: "never", expectedUpdatedAt: original.updatedAt });
      expect(staleApi.status).toBe(409);
      expect(staleApi.body?.error).toBe("stale");

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });
      await expect(tableText(page, titled(2)), "bookings table row").toBeVisible(LIVE);

      // ── 3. Calendar candle + Back after a teammate edit made while A was elsewhere ──
      await page.goto(`/bookings?view=calendar${sessionDate ? `&date=${sessionDate}` : ""}`);
      await page.locator(".rbc-calendar").waitFor({ timeout: 60_000 });
      await expect(page.locator(".rbc-event").filter({ hasText: titled(2) }).first(), "calendar candle").toBeVisible(LIVE);
      await page.getByRole("link", { name: /settings/i }).first().click();
      await page.waitForURL(/\/settings/, { timeout: 60_000 });
      await settle(page, 1_500);
      expect((await patchBooking(tabB, bookingId, { title: titled(3) })).status).toBe(200);
      await settle(page, 2_000);
      const backAt = Date.now();
      await page.goBack();
      await page.locator(".rbc-calendar").waitFor({ timeout: 60_000 });
      await expect(
        page.locator(".rbc-event").filter({ hasText: titled(3) }).first(),
        "Back restores a fresh calendar, not the pre-edit payload",
      ).toBeVisible({ timeout: 30_000 });
      test.info().annotations.push({ type: "back -> fresh calendar (ms, dev server)", description: String(Date.now() - backAt) });

      // Own drag-free edit path: Back after the actor's own PATCH with refresh:false is covered by
      // the calendar-view unit tests; here we check Forward/Back once more across /clients.
      await page.goto(tableUrl);
      await page.getByRole("table").waitFor({ timeout: 60_000 });

      // ── 4. Client detail modal (bookings tab) follows booking edits ──
      if (clientId) {
        await page.goto(`/clients?client=${clientId}`);
        const clientDialog = page.getByRole("dialog").first();
        await expect(clientDialog).toBeVisible({ timeout: 60_000 });
        await clientDialog.getByRole("tab", { name: /bookings/i }).click();
        await expect(clientDialog.getByText(titled(3)).first()).toBeVisible(LIVE);
        expect((await patchBooking(tabB, bookingId, { title: titled(4) })).status).toBe(200);
        await expect(clientDialog.getByText(titled(4)).first(), "client modal bookings tab").toBeVisible(LIVE);
        await page.keyboard.press("Escape");
      }

      // ── 5. Dashboard (today / upcoming-week lists) follows a teammate's edit ──
      const now = new Date();
      const soon = await mongoose.connection.db!.collection("bookings").findOne(
        {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          status: "booked",
          firstSessionStart: { $gte: now, $lte: new Date(now.getTime() + 6 * 86_400_000) },
        },
        { sort: { firstSessionStart: 1 } },
      );
      expect(soon, "seed needs a booking in the next 6 days for the dashboard lists").not.toBeNull();
      const soonId = String(soon!._id);
      dashboardBooking = { id: soonId, title: String(soon!.title) };
      await page.goto("/dashboard");
      await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 60_000 });
      await expect(page.getByText(String(soon!.title)).first(), "dashboard lists the upcoming booking").toBeVisible({ timeout: 30_000 });
      await settle(page, 2_000);
      expect((await patchBooking(tabB, soonId, { title: `${soon!.title} · e2e dash` })).status).toBe(200);
      await expect(page.getByText(`${soon!.title} · e2e dash`).first(), "dashboard shows the teammate's edit live").toBeVisible(LIVE);
      expect((await patchBooking(tabB, bookingId, { title: titled(5) })).status).toBe(200);

      // ── 6. Client rename reaches the denormalized booking rows (live AND after reload) ──
      if (clientId && originalClientName) {
        await page.goto(tableUrl);
        await page.getByRole("table").waitFor({ timeout: 60_000 });
        await settle(page, 2_000);
        const renamedClient = `${originalClientName} e2e`;
        await tabB.goto(`/clients?client=${clientId}`);
        const bDialog = tabB.getByRole("dialog").first();
        await expect(bDialog).toBeVisible({ timeout: 60_000 });
        await bDialog.getByRole("button", { name: /^edit$/i }).click();
        const nameInput = tabB.getByRole("dialog").getByLabel(/^name/i).first();
        await nameInput.fill(renamedClient);
        await tabB.getByRole("dialog").getByRole("button", { name: /^save$/i }).click();
        await expect(tabB.getByText(/client updated/i).first()).toBeVisible(LIVE);
        await expect(tableText(page, renamedClient), "bookings table shows the renamed client live").toBeVisible(LIVE);
        await page.reload();
        await expect(tableText(page, renamedClient), "…and after a reload (DB denormalization fixed)").toBeVisible(LIVE);
      }

      // ── 7. Missed events while offline are caught up on reconnect ──
      await page.goto(tableUrl);
      await page.getByRole("table").waitFor({ timeout: 60_000 });
      await settle(page, 2_000);
      await page.context().setOffline(true);
      await settle(page, 2_000);
      expect((await patchBooking(tabB, bookingId, { title: titled(6) })).status).toBe(200);
      await settle(page, 2_000);
      await page.context().setOffline(false);
      await expect(tableText(page, titled(6)), "reconnect catches up on the missed edit").toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, "reconnect-caught-up.png") });
    } finally {
      await page.context().setOffline(false);
      await patchBooking(tabB, bookingId, { title: base });
      if (dashboardBooking) await patchBooking(tabB, dashboardBooking.id, { title: dashboardBooking.title });
      if (clientId && originalClientName) {
        await mongoose.connection.db!
          .collection("clients")
          .updateOne({ _id: new mongoose.Types.ObjectId(clientId) }, { $set: { name: originalClientName } });
        await mongoose.connection.db!
          .collection("bookings")
          .updateMany({ clientId: new mongoose.Types.ObjectId(clientId) }, { $set: { clientName: originalClientName } });
      }
      await ctxB.close();
    }

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("inquiry draft card stays live and never writes stale fields; drags keep derived data in step", async ({
    page,
    browser,
  }) => {
    test.setTimeout(420_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await connectDb();
    const db = mongoose.connection.db!;
    const owner = await db.collection("workspaces").findOne({ ownerUserId: process.env.SEED_OWNER_WORKOS_USER_ID });
    const workspaceId = owner!._id;

    // An open inquiry with a draft booking.
    const inquiries = await db.collection("inquiries").find({ workspaceId, draftBookingId: { $ne: null } }).toArray();
    let inquiry: (typeof inquiries)[number] | null = null;
    let draft: mongoose.mongo.WithId<mongoose.mongo.Document> | null = null;
    const today = new Date().toISOString().slice(0, 10);
    // Prefer an upcoming, single-session inquiry so its candle is draggable.
    inquiries.sort((a, b) => Number(String(b.sessions?.[0]?.startDate) >= today) - Number(String(a.sessions?.[0]?.startDate) >= today));
    for (const inq of inquiries) {
      const b = await db.collection("bookings").findOne({ _id: inq.draftBookingId, status: "draft" });
      if (b && (inq.sessions ?? []).length > 0 && inq.eventTitle) {
        inquiry = inq;
        draft = b;
        break;
      }
    }
    expect(inquiry, "seed needs an inquiry with a draft booking").not.toBeNull();
    const inquiryId = String(inquiry!._id);
    const draftId = draft!._id;
    const origInquiry = { sessions: inquiry!.sessions, eventDate: inquiry!.eventDate };
    const origDraft = {
      amount: draft!.amount,
      notes: draft!.notes ?? "",
      sessions: draft!.sessions,
      firstSessionStart: draft!.firstSessionStart,
      lastSessionEnd: draft!.lastSessionEnd,
    };
    const baseTotal = Number(draft!.amount?.total ?? 0);

    const ctxB = await browser.newContext({ storageState: "e2e/.auth/owner.json" });
    const tabB = await ctxB.newPage();
    let draggedBooking: { id: string; title: string; original: Record<string, unknown> } | null = null;
    let dragOriginal: { id: mongoose.Types.ObjectId; sessions: unknown; eventDate: unknown; eventTitle: unknown; draftBookingId: unknown } | null = null;
    let dragDraftOriginal: Record<string, unknown> | null = null;

    try {
      // ── 1. Teammate saves the draft: A's clean card adopts it ──
      await Promise.all([page.goto(`/inquiries/${inquiryId}`), tabB.goto(`/inquiries/${inquiryId}`)]);
      const totalA = page.locator("#draft-total");
      const totalB = tabB.locator("#draft-total");
      await expect(totalA).toBeVisible({ timeout: 60_000 });
      await expect(totalB).toBeVisible({ timeout: 60_000 });
      await settle(page, 2_000);
      await totalB.fill(String(baseTotal + 1234));
      await tabB.getByRole("button", { name: /save edits/i }).click();
      await expect(tabB.getByText(/draft saved/i).first()).toBeVisible(LIVE);
      await expect(totalA, "clean draft card shows the teammate's total").toHaveValue(String(baseTotal + 1234), LIVE);

      // ── 2. Dirty card: keeps A's edit, adopts untouched fields, writes only what A changed ──
      await page.locator("#draft-notes").fill("e2e note from A");
      await totalB.fill(String(baseTotal + 2000));
      await tabB.getByRole("button", { name: /save edits/i }).click();
      await expect(tabB.getByText(/draft saved/i).first()).toBeVisible(LIVE);
      await expect(page.getByText(/changed by someone else/i).first(), "dirty card warns").toBeVisible(LIVE);
      await expect(totalA, "untouched field adopts the server value").toHaveValue(String(baseTotal + 2000), LIVE);
      await expect(page.locator("#draft-notes")).toHaveValue("e2e note from A");
      await page.getByRole("button", { name: /save edits/i }).click();
      await expect(page.getByText(/draft saved/i).first()).toBeVisible(LIVE);
      const afterA = await db.collection("bookings").findOne({ _id: draftId });
      expect(afterA?.amount?.total, "A's save did not write back a stale total").toBe(baseTotal + 2000);
      expect(afterA?.notes).toBe("e2e note from A");
      await page.screenshot({ path: path.join(SHOT_DIR, "draft-card-live.png") });

      // ── 3. Inquiry calendar drag keeps Inquiry.eventDate in step (date in the workspace tz) ──
      const tz = String(owner!.timezone ?? "Asia/Manila");
      const dragInquiry = (await db.collection("inquiries").find({ workspaceId, status: "inquiry" }).toArray()).find(
        (q) => q.eventTitle && (q.sessions ?? []).length === 1 && String(q.sessions[0].startDate) > today && String(q._id) !== inquiryId,
      );
      expect(dragInquiry, "seed needs an upcoming single-session open inquiry").toBeTruthy();
      dragOriginal = { id: dragInquiry!._id, sessions: dragInquiry!.sessions, eventDate: dragInquiry!.eventDate, eventTitle: dragInquiry!.eventTitle, draftBookingId: dragInquiry!.draftBookingId ?? null };
      if (dragInquiry!.draftBookingId) {
        const d = await db.collection("bookings").findOne({ _id: dragInquiry!.draftBookingId });
        dragDraftOriginal = d ? { sessions: d.sessions, firstSessionStart: d.firstSessionStart, lastSessionEnd: d.lastSessionEnd } : null;
      }
      // Seed titles repeat and every seeded day is busy: a unique title pins the candle and a
      // 00:05-00:35 slot (no seeded shift starts before 01:00) makes any drop conflict-free.
      // Both are restored in finally.
      const dragTitle = `${dragInquiry!.eventTitle} e2e-drag`;
      await db.collection("inquiries").updateOne(
        { _id: dragInquiry!._id },
        { $set: { eventTitle: dragTitle, "sessions.0.startTime": "00:05", "sessions.0.endTime": "00:35" } },
      );
      const firstDate = String(dragInquiry!.sessions[0].startDate);
      await page.goto(`/inquiries?view=calendar&date=${firstDate}`);
      await page.locator(".rbc-calendar").waitFor({ timeout: 60_000 });
      await settle(page, 2_500);
      const inquiryMoved = await dragToAnotherDay(page, page.locator(".rbc-month-view .rbc-event").filter({ hasText: dragTitle }).first(), () =>
        expect
          .poll(async () => String((await db.collection("inquiries").findOne({ _id: dragInquiry!._id }))?.sessions?.[0]?.startDate) !== firstDate, { timeout: 8_000 })
          .toBe(true)
          .then(() => true, () => false),
      );
      expect(inquiryMoved, "an inquiry candle drag persists").toBe(true);
      const movedInq = await db.collection("inquiries").findOne({ _id: dragInquiry!._id });
      const eventDay = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(movedInq!.eventDate));
      expect(eventDay, "eventDate follows the moved session (workspace tz)").toBe(String(movedInq!.sessions[0].startDate));

      // ── 4. Own booking drag (local refresh:false), leave, Back: never the pre-drag payload ──
      const upcoming = await db.collection("bookings").findOne(
        { workspaceId, status: "booked", "sessions.1": { $exists: false }, firstSessionStart: { $gte: new Date(Date.now() + 2 * 86_400_000) } },
        { sort: { firstSessionStart: 1 } },
      );
      expect(upcoming, "seed needs an upcoming single-session booking").not.toBeNull();
      const dragBookingId = String(upcoming!._id);
      draggedBooking = {
        id: dragBookingId,
        title: String(upcoming!.title),
        original: { sessions: upcoming!.sessions, firstSessionStart: upcoming!.firstSessionStart, lastSessionEnd: upcoming!.lastSessionEnd },
      };
      const dragBookingTitle = `${upcoming!.title} · e2e drag`;
      const bookingDay = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(upcoming!.firstSessionStart));
      const earlyStart = wallToUtc(bookingDay, "00:05", tz);
      const earlyEnd = new Date(earlyStart.getTime() + 30 * 60_000);
      await db.collection("bookings").updateOne(
        { _id: upcoming!._id },
        {
          $set: {
            title: dragBookingTitle,
            sessions: [{ startAt: earlyStart, endAt: earlyEnd }],
            firstSessionStart: earlyStart,
            lastSessionEnd: earlyEnd,
            updatedAt: new Date(),
          },
        },
      );
      await page.goto(`/bookings?view=calendar&date=${bookingDay}`);
      await page.locator(".rbc-calendar").waitFor({ timeout: 60_000 });
      await settle(page, 2_500);
      const bCandle = page.locator(".rbc-month-view .rbc-event").filter({ hasText: dragBookingTitle }).first();
      const statuses: number[] = [];
      const bookingMoved = await dragToAnotherDay(page, bCandle, async () => {
        const resp = await page
          .waitForResponse((r) => r.request().method() === "PATCH" && r.url().endsWith(dragBookingId), { timeout: 20_000 })
          .catch(() => null);
        statuses.push(resp?.status() ?? 0);
        return resp?.status() === 200;
      });
      test.info().annotations.push({ type: "own drag statuses", description: statuses.join(",") });
      expect(bookingMoved, "an own booking drag persists").toBe(true);
      await settle(page, 1_500);
      const movedBox = (await bCandle.boundingBox())!;
      await page.getByRole("link", { name: /settings/i }).first().click();
      await page.waitForURL(/\/settings/, { timeout: 60_000 });
      await settle(page, 1_500);
      await page.goBack();
      await page.locator(".rbc-calendar").waitFor({ timeout: 60_000 });
      await settle(page, 2_500);
      const backBox = (await bCandle.boundingBox())!;
      expect(
        Math.abs(backBox.x - movedBox.x) < 8 && Math.abs(backBox.y - movedBox.y) < 8,
        "Back shows the candle on its new day, not the pre-drag payload",
      ).toBe(true);
    } finally {
      await db.collection("inquiries").updateOne({ _id: inquiry!._id }, { $set: origInquiry });
      await db.collection("bookings").updateOne({ _id: draftId }, { $set: origDraft });
      if (dragOriginal) {
        await db.collection("inquiries").updateOne(
          { _id: dragOriginal.id },
          { $set: { sessions: dragOriginal.sessions, eventDate: dragOriginal.eventDate, eventTitle: dragOriginal.eventTitle } },
        );
        if (dragDraftOriginal && dragOriginal.draftBookingId) {
          await db.collection("bookings").updateOne({ _id: dragOriginal.draftBookingId as mongoose.Types.ObjectId }, { $set: dragDraftOriginal });
        }
      }
      if (draggedBooking) {
        await db.collection("bookings").updateOne(
          { _id: new mongoose.Types.ObjectId(draggedBooking.id) },
          { $set: { ...draggedBooking.original, title: draggedBooking.title } },
        );
      }
      await ctxB.close();
    }

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
