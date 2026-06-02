import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, Inquiry, Transaction, ActivityLog } from "@/lib/db/models";
import {
  getKpiSnapshot,
  getTodaysEvents,
  getUpcomingWeek,
  getRecentInquiries,
  getActivityFeed,
  getPipelineCounts,
  getRevenueTrend,
  getBookingsByDay,
  getEventTypeBreakdown,
  getTransactionsByMethod,
  getRevenueComparison,
  getBookingsByWeekday,
} from "./dashboard-metrics";

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
const clientId = new Types.ObjectId();

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
});

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function seedBooking(
  wid: mongoose.Types.ObjectId,
  overrides: Partial<{
    status: string;
    startAt: Date;
    total: number;
    deposit: number;
    teamId: mongoose.Types.ObjectId;
  }> = {}
) {
  const start = overrides.startAt ?? daysFromNow(1);
  return Booking.create({
    workspaceId: wid,
    teamId: overrides.teamId ?? new mongoose.Types.ObjectId(),
    clientId,
    clientName: "Demo Client",
    title: "Demo Booking",
    status: overrides.status ?? "booked",
    sessions: [{ startAt: start, endAt: start }],
    firstSessionStart: start,
    lastSessionEnd: start,
    amount: {
      total: overrides.total ?? 50_000,
      deposit: overrides.deposit ?? 10_000,
      currency: "PHP",
    },
  });
}

async function seedTransaction(
  wid: mongoose.Types.ObjectId,
  amount: number,
  paidAt: Date,
  type: "deposit" | "balance" | "refund" = "deposit",
  bookingId?: mongoose.Types.ObjectId
) {
  return Transaction.create({
    workspaceId: wid,
    bookingId: bookingId ?? null,
    clientId: null,
    amount,
    currency: "PHP",
    type,
    method: "paddle",
    paidAt,
  });
}

describe("getKpiSnapshot", () => {
  it("sums this month's revenue across deposit/balance, subtracts refunds", async () => {
    const now = new Date();
    await seedTransaction(workspaceId, 10_000, now, "deposit");
    await seedTransaction(workspaceId, 5_000, now, "balance");
    await seedTransaction(workspaceId, -2_000, now, "refund");

    const snap = await getKpiSnapshot(workspaceId);
    expect(snap.revenueThisMonth).toBe(13_000);
  });

  it("ignores transactions outside the current month", async () => {
    const lastMonth = new Date();
    // Anchor to mid-month before shifting: on a 31st, setMonth(-1) would
    // overflow a shorter previous month back into the current month (e.g.
    // May 31 → "Apr 31" → May 1), making this assertion flaky at month-end.
    lastMonth.setDate(15);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await seedTransaction(workspaceId, 99_000, lastMonth, "deposit");

    const snap = await getKpiSnapshot(workspaceId);
    expect(snap.revenueThisMonth).toBe(0);
  });

  it("ignores subscription-type transactions in revenue", async () => {
    const now = new Date();
    await Transaction.create({
      workspaceId,
      amount: 99_000,
      currency: "PHP",
      type: "subscription",
      method: "paddle",
      paidAt: now,
    });
    const snap = await getKpiSnapshot(workspaceId);
    expect(snap.revenueThisMonth).toBe(0);
  });

  it("counts active bookings only when in current month and booked/quoted", async () => {
    const inMonth = new Date();
    inMonth.setDate(15);
    const nextMonth = new Date(inMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    await seedBooking(workspaceId, { status: "booked", startAt: inMonth });
    await seedBooking(workspaceId, { status: "quoted", startAt: inMonth });
    await seedBooking(workspaceId, { status: "inquiry", startAt: inMonth });
    await seedBooking(workspaceId, { status: "booked", startAt: nextMonth });

    const snap = await getKpiSnapshot(workspaceId);
    expect(snap.activeBookingsThisMonth).toBe(2);
  });

  it("counts new inquiries only with status='new'", async () => {
    await Inquiry.create({ workspaceId, name: "A", email: "a@ex.com", status: "new" });
    await Inquiry.create({ workspaceId, name: "B", email: "b@ex.com", status: "contacted" });
    const snap = await getKpiSnapshot(workspaceId);
    expect(snap.newInquiries).toBe(1);
  });

  it("computes outstanding balance as total minus paid for booked bookings only", async () => {
    const booked = await seedBooking(workspaceId, {
      status: "booked",
      total: 100_000,
      deposit: 30_000,
    });
    await seedTransaction(workspaceId, 30_000, daysFromNow(-1), "deposit", booked._id);

    await seedBooking(workspaceId, { status: "completed", total: 50_000 });

    const snap = await getKpiSnapshot(workspaceId);
    expect(snap.outstandingBalance).toBe(70_000);
  });

  it("never returns negative outstanding balance (overpaid bookings clamp to 0)", async () => {
    const booked = await seedBooking(workspaceId, {
      status: "booked",
      total: 10_000,
    });
    await seedTransaction(workspaceId, 25_000, daysFromNow(-1), "balance", booked._id);
    const snap = await getKpiSnapshot(workspaceId);
    expect(snap.outstandingBalance).toBe(0);
  });
});

describe("tenant isolation", () => {
  it("getKpiSnapshot never reads another workspace's data", async () => {
    await seedTransaction(otherWorkspaceId, 99_000, new Date(), "deposit");
    await seedBooking(otherWorkspaceId, { status: "booked" });
    await Inquiry.create({
      workspaceId: otherWorkspaceId,
      name: "X",
      email: "x@x.com",
      status: "new",
    });

    const snap = await getKpiSnapshot(workspaceId);
    expect(snap).toEqual({
      revenueThisMonth: 0,
      activeBookingsThisMonth: 0,
      newInquiries: 0,
      outstandingBalance: 0,
    });
  });

  it("list queries never leak across workspaces", async () => {
    await seedBooking(otherWorkspaceId, { startAt: new Date() });
    await Inquiry.create({
      workspaceId: otherWorkspaceId,
      name: "Leak",
      email: "leak@x.com",
      status: "new",
    });
    await ActivityLog.create({
      workspaceId: otherWorkspaceId,
      actorUserId: "user_x",
      entity: "booking",
      action: "created",
    });

    expect(await getTodaysEvents(workspaceId)).toHaveLength(0);
    expect(await getRecentInquiries(workspaceId)).toHaveLength(0);
    expect(await getActivityFeed(workspaceId)).toHaveLength(0);
    expect(await getUpcomingWeek(workspaceId)).toHaveLength(0);
  });
});

describe("getTodaysEvents", () => {
  it("returns only bookings whose startAt falls within today", async () => {
    const todayMorning = new Date();
    todayMorning.setHours(9, 0, 0, 0);
    const yesterday = daysFromNow(-1);
    const tomorrow = daysFromNow(1);

    await seedBooking(workspaceId, { startAt: todayMorning });
    await seedBooking(workspaceId, { startAt: yesterday });
    await seedBooking(workspaceId, { startAt: tomorrow });

    const events = await getTodaysEvents(workspaceId);
    expect(events).toHaveLength(1);
  });
});

describe("getUpcomingWeek", () => {
  it("excludes today and anything past 7 days", async () => {
    const today = new Date();
    await seedBooking(workspaceId, { startAt: today });
    await seedBooking(workspaceId, { startAt: daysFromNow(3) });
    await seedBooking(workspaceId, { startAt: daysFromNow(10) });

    const upcoming = await getUpcomingWeek(workspaceId);
    expect(upcoming).toHaveLength(1);
  });

  it("excludes completed/cancelled bookings", async () => {
    await seedBooking(workspaceId, { startAt: daysFromNow(2), status: "completed" });
    await seedBooking(workspaceId, { startAt: daysFromNow(2), status: "cancelled" });
    await seedBooking(workspaceId, { startAt: daysFromNow(2), status: "booked" });

    const upcoming = await getUpcomingWeek(workspaceId);
    expect(upcoming).toHaveLength(1);
  });
});

describe("getPipelineCounts", () => {
  it("groups new+contacted inquiries, quoted bookings, and booked bookings separately", async () => {
    await Inquiry.create({ workspaceId, name: "N", email: "n@x.com", status: "new" });
    await Inquiry.create({ workspaceId, name: "C", email: "c@x.com", status: "contacted" });
    await Inquiry.create({ workspaceId, name: "X", email: "x@x.com", status: "archived" });
    await seedBooking(workspaceId, { status: "quoted" });
    await seedBooking(workspaceId, { status: "quoted" });
    await seedBooking(workspaceId, { status: "booked" });

    const counts = await getPipelineCounts(workspaceId);
    expect(counts).toEqual({ inquiries: 2, quoted: 2, booked: 1 });
  });
});

describe("getRevenueTrend", () => {
  it("returns exactly `days` daily buckets, including empty days", async () => {
    const trend = await getRevenueTrend(workspaceId, 30);
    expect(trend).toHaveLength(30);
    expect(trend.every((p) => p.amount === 0)).toBe(true);
  });

  it("places transactions in the correct daily bucket", async () => {
    // Use UTC throughout — getRevenueTrend buckets by UTC date, so the seeded
    // paidAt + expected bucket key must both live in UTC to avoid a timezone
    // flake when local time has rolled into a different UTC day.
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    await seedTransaction(workspaceId, 7_000, today, "deposit");

    const trend = await getRevenueTrend(workspaceId, 30);
    const todayKey = today.toISOString().slice(0, 10);
    const todayPoint = trend.find((p) => p.date === todayKey);
    expect(todayPoint?.amount).toBe(7_000);
  });
});

describe("getBookingsByDay", () => {
  it("returns counts keyed by YYYY-MM-DD within the month", async () => {
    const day1 = new Date();
    day1.setDate(5);
    day1.setHours(10, 0, 0, 0);
    await seedBooking(workspaceId, { startAt: day1 });
    await seedBooking(workspaceId, { startAt: day1 });

    const days = await getBookingsByDay(workspaceId, day1);
    const key = day1.toISOString().slice(0, 10);
    const entry = days.find((d) => d.date === key);
    expect(entry?.count).toBe(2);
  });

  it("scopes to the given teamIds (string ids cast to ObjectId in the aggregation)", async () => {
    const teamA = new mongoose.Types.ObjectId();
    const teamB = new mongoose.Types.ObjectId();
    const day = new Date();
    day.setDate(12);
    day.setHours(10, 0, 0, 0);
    await seedBooking(workspaceId, { startAt: day, teamId: teamA });
    await seedBooking(workspaceId, { startAt: day, teamId: teamB });

    const key = day.toISOString().slice(0, 10);
    const days = await getBookingsByDay(workspaceId, day, [String(teamA)]);
    expect(days.find((d) => d.date === key)?.count).toBe(1);
  });

  it("returns nothing for an empty teamIds array (member with no teams — fail closed)", async () => {
    const day = new Date();
    day.setDate(13);
    day.setHours(10, 0, 0, 0);
    await seedBooking(workspaceId, { startAt: day });

    const days = await getBookingsByDay(workspaceId, day, []);
    expect(days).toHaveLength(0);
  });

  it("never counts another workspace's bookings", async () => {
    const day = new Date();
    day.setDate(14);
    day.setHours(10, 0, 0, 0);
    await seedBooking(otherWorkspaceId, { startAt: day });

    const days = await getBookingsByDay(workspaceId, day);
    expect(days.find((d) => d.date === day.toISOString().slice(0, 10))).toBeUndefined();
  });
});

describe("getEventTypeBreakdown", () => {
  it("groups bookings by eventType, sorted by count descending", async () => {
    await seedBooking(workspaceId, { startAt: new Date() });
    await Booking.updateMany({ workspaceId }, { eventType: "wedding" });

    const now = new Date();
    await Booking.create({
      workspaceId,
      teamId: new mongoose.Types.ObjectId(),
      clientId,
      clientName: "C",
      title: "T",
      eventType: "corporate",
      status: "booked",
      sessions: [{ startAt: now, endAt: now }],
      firstSessionStart: now,
      lastSessionEnd: now,
      amount: { total: 0, deposit: 0, currency: "PHP" },
    });
    await Booking.create({
      workspaceId,
      teamId: new mongoose.Types.ObjectId(),
      clientId,
      clientName: "C",
      title: "T",
      eventType: "wedding",
      status: "booked",
      sessions: [{ startAt: now, endAt: now }],
      firstSessionStart: now,
      lastSessionEnd: now,
      amount: { total: 0, deposit: 0, currency: "PHP" },
    });

    const rows = await getEventTypeBreakdown(workspaceId);
    expect(rows[0].eventType).toBe("wedding");
    expect(rows[0].count).toBe(2);
    expect(rows.find((r) => r.eventType === "corporate")?.count).toBe(1);
  });

  it("does not leak across workspaces", async () => {
    await seedBooking(otherWorkspaceId, { startAt: new Date() });
    const rows = await getEventTypeBreakdown(workspaceId);
    expect(rows).toHaveLength(0);
  });
});

describe("getTransactionsByMethod", () => {
  it("sums by method for transactions within the window", async () => {
    await seedTransaction(workspaceId, 10_000, daysFromNow(-5), "deposit");
    await Transaction.updateMany({ workspaceId }, { method: "paddle" });
    await seedTransaction(workspaceId, 5_000, daysFromNow(-10), "balance");
    await seedTransaction(workspaceId, 2_000, daysFromNow(-95), "deposit");
    await Transaction.updateMany({ method: { $exists: false } }, { method: "cash" });

    const rows = await getTransactionsByMethod(workspaceId, 90);
    const total = rows.reduce((s, r) => s + r.total, 0);
    expect(total).toBeLessThanOrEqual(15_000);
    expect(total).toBeGreaterThan(0);
  });

  it("excludes refunds and subscription rows", async () => {
    await seedTransaction(workspaceId, -2_000, daysFromNow(-3), "refund");
    await Transaction.create({
      workspaceId,
      amount: 9_999,
      currency: "PHP",
      type: "subscription",
      method: "paddle",
      paidAt: daysFromNow(-3),
    });

    const rows = await getTransactionsByMethod(workspaceId, 90);
    const total = rows.reduce((s, r) => s + r.total, 0);
    expect(total).toBe(0);
  });
});

describe("getRevenueComparison", () => {
  it("computes a positive delta when this month exceeds last month", async () => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    await seedTransaction(workspaceId, 10_000, now, "deposit");
    await seedTransaction(workspaceId, 5_000, lastMonth, "deposit");

    const cmp = await getRevenueComparison(workspaceId);
    expect(cmp.thisMonth).toBe(10_000);
    expect(cmp.lastMonth).toBe(5_000);
    expect(cmp.deltaPct).toBe(100);
  });

  it("returns 0 delta when last month had no revenue", async () => {
    await seedTransaction(workspaceId, 10_000, new Date(), "deposit");
    const cmp = await getRevenueComparison(workspaceId);
    expect(cmp.deltaPct).toBe(0);
  });
});

describe("getBookingsByWeekday", () => {
  it("returns exactly 7 days starting from Sunday", async () => {
    const rows = await getBookingsByWeekday(workspaceId);
    expect(rows).toHaveLength(7);
    expect(rows[0].day).toBe("Sun");
    expect(rows[6].day).toBe("Sat");
  });

  it("counts bookings in the correct weekday bucket", async () => {
    // Pick a known Wednesday (2026-05-20 is a Wednesday — UTC noon avoids timezone edge cases)
    const wed = new Date(Date.UTC(2026, 4, 20, 12, 0, 0));
    await seedBooking(workspaceId, { startAt: wed });
    await seedBooking(workspaceId, { startAt: wed });

    const rows = await getBookingsByWeekday(workspaceId);
    expect(rows.find((r) => r.day === "Wed")?.count).toBe(2);
    expect(rows.find((r) => r.day === "Tue")?.count).toBe(0);
  });
});
