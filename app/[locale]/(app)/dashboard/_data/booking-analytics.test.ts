import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, Transaction } from "@/lib/db/models";
import {
  getCollectionCoverage,
  getEventTypeValueTrend,
  getBookedHoursHeatmap,
  getScheduledVsCollectedSeries,
} from "./booking-analytics";

const wid = new Types.ObjectId();
const other = new Types.ObjectId();
const clientId = new Types.ObjectId();
const tz = "Asia/Manila"; // UTC+8, no DST

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

function seedBooking(overrides: {
  workspaceId?: Types.ObjectId;
  status?: string;
  eventType?: string;
  sessions: { startAt: Date; endAt: Date }[];
  total?: number;
}) {
  const sessions = overrides.sessions;
  const starts = sessions.map((s) => s.startAt.getTime());
  const ends = sessions.map((s) => s.endAt.getTime());
  return Booking.create({
    workspaceId: overrides.workspaceId ?? wid,
    clientId,
    clientName: "Demo Client",
    title: "Demo Booking",
    eventType: overrides.eventType ?? "other",
    status: overrides.status ?? "booked",
    sessions,
    firstSessionStart: new Date(Math.min(...starts)),
    lastSessionEnd: new Date(Math.max(...ends)),
    amount: { total: overrides.total ?? 0, deposit: 0, currency: "PHP" },
  });
}

// Monday 2026-06-01 00:00 Manila = 2026-05-31T16:00:00.000Z
const monWeek1_10am = new Date("2026-06-01T02:00:00.000Z"); // 10:00 Manila Mon Jun 1
// Week 2 Monday 2026-06-08, 10:00 Manila.
const monWeek2_10am = new Date("2026-06-08T02:00:00.000Z");

describe("getCollectionCoverage", () => {
  it("computes confirmedValue/collected/remaining/coveragePct, netting a refund", async () => {
    const range = { from: new Date("2026-05-25T00:00:00.000Z"), to: new Date("2026-06-08T00:00:00.000Z") };

    const booking = await seedBooking({
      sessions: [{ startAt: monWeek1_10am, endAt: new Date(monWeek1_10am.getTime() + 2 * 3_600_000) }],
      total: 10_000,
    });

    await Transaction.create([
      { workspaceId: wid, bookingId: booking._id, amount: 5_000, type: "deposit", paidAt: null },
      { workspaceId: wid, bookingId: booking._id, amount: -1_000, type: "refund", paidAt: null },
    ]);

    const coverage = await getCollectionCoverage(wid, range);
    expect(coverage.confirmedValue).toBe(10_000);
    expect(coverage.collected).toBe(4_000);
    expect(coverage.remaining).toBe(6_000);
    expect(coverage.coveragePct).toBeCloseTo(40, 5);
  });

  it("excludes draft/cancelled bookings and other workspaces; empty range yields zeros", async () => {
    const range = { from: new Date("2026-05-25T00:00:00.000Z"), to: new Date("2026-06-08T00:00:00.000Z") };
    const sessions = [{ startAt: monWeek1_10am, endAt: new Date(monWeek1_10am.getTime() + 3_600_000) }];

    await seedBooking({ status: "draft", sessions, total: 99_999 });
    await seedBooking({ status: "cancelled", sessions, total: 88_888 });
    await seedBooking({ workspaceId: other, sessions, total: 77_777 });

    const coverage = await getCollectionCoverage(wid, range);
    expect(coverage).toEqual({ confirmedValue: 0, collected: 0, remaining: 0, coveragePct: 0 });

    // Empty range (no overlap at all) on the other workspace's data too.
    const emptyRange = { from: new Date("2020-01-01T00:00:00.000Z"), to: new Date("2020-01-02T00:00:00.000Z") };
    const emptyCoverage = await getCollectionCoverage(other, emptyRange);
    expect(emptyCoverage).toEqual({ confirmedValue: 0, collected: 0, remaining: 0, coveragePct: 0 });
  });
});

describe("getEventTypeValueTrend", () => {
  it("buckets by week-start Monday, stacks by eventType, orders eventTypes by total value desc, excludes draft/cancelled/other-workspace", async () => {
    const range = { from: new Date("2026-05-25T00:00:00.000Z"), to: new Date("2026-06-15T00:00:00.000Z") };
    const sessA = [{ startAt: monWeek1_10am, endAt: new Date(monWeek1_10am.getTime() + 3_600_000) }];
    const sessB = [{ startAt: monWeek2_10am, endAt: new Date(monWeek2_10am.getTime() + 3_600_000) }];

    await seedBooking({ eventType: "wedding", sessions: sessA, total: 10_000 });
    await seedBooking({ eventType: "birthday", sessions: sessA, total: 2_000 });
    await seedBooking({ eventType: "birthday", sessions: sessB, total: 20_000 });
    // Excluded: draft, cancelled, other workspace.
    await seedBooking({ status: "draft", eventType: "wedding", sessions: sessB, total: 999_999 });
    await seedBooking({ status: "cancelled", eventType: "wedding", sessions: sessB, total: 999_999 });
    await seedBooking({ workspaceId: other, eventType: "wedding", sessions: sessB, total: 999_999 });

    const trend = await getEventTypeValueTrend(wid, range, tz);
    expect(trend.eventTypes).toEqual(["birthday", "wedding"]); // 22000 desc 10000
    expect(trend.points).toEqual([
      { bucket: "2026-06-01", values: { wedding: 10_000, birthday: 2_000 } },
      { bucket: "2026-06-08", values: { birthday: 20_000 } },
    ]);
  });

  it("returns empty eventTypes/points for an empty range", async () => {
    const sess = [{ startAt: monWeek1_10am, endAt: new Date(monWeek1_10am.getTime() + 3_600_000) }];
    await seedBooking({ eventType: "wedding", sessions: sess, total: 10_000 });

    const emptyRange = { from: new Date("2020-01-01T00:00:00.000Z"), to: new Date("2020-01-02T00:00:00.000Z") };
    const trend = await getEventTypeValueTrend(wid, emptyRange, tz);
    expect(trend).toEqual({ eventTypes: [], points: [] });
  });
});

describe("getBookedHoursHeatmap", () => {
  it("splits an overnight session across two local days and sums a multi-session booking's daytime session separately", async () => {
    const range = { from: new Date("2026-05-25T00:00:00.000Z"), to: new Date("2026-06-15T00:00:00.000Z") };

    // Session A: Mon 2026-06-01 09:00-17:00 Manila (single day, 8h).
    const sessA = {
      startAt: new Date("2026-06-01T01:00:00.000Z"),
      endAt: new Date("2026-06-01T09:00:00.000Z"),
    };
    // Session B: Wed 2026-06-03 22:00 -> Fri 2026-06-05 06:00 Manila (2 overnight
    // shift-days: Wed and Thu, 8h each).
    const sessB = {
      startAt: new Date("2026-06-03T14:00:00.000Z"),
      endAt: new Date("2026-06-04T22:00:00.000Z"),
    };

    await seedBooking({ sessions: [sessA, sessB] });

    const cells = await getBookedHoursHeatmap(wid, range, tz);
    expect(cells).toEqual([
      { weekStart: "2026-06-01", weekday: 0, hours: 8 }, // Monday
      { weekStart: "2026-06-01", weekday: 2, hours: 8 }, // Wednesday
      { weekStart: "2026-06-01", weekday: 3, hours: 8 }, // Thursday
    ]);
  });

  it("excludes draft/cancelled/other-workspace sessions; empty range yields []", async () => {
    const range = { from: new Date("2026-05-25T00:00:00.000Z"), to: new Date("2026-06-15T00:00:00.000Z") };
    const sess = [{
      startAt: new Date("2026-06-01T01:00:00.000Z"),
      endAt: new Date("2026-06-01T09:00:00.000Z"),
    }];

    await seedBooking({ status: "draft", sessions: sess });
    await seedBooking({ status: "cancelled", sessions: sess });
    await seedBooking({ workspaceId: other, sessions: sess });

    expect(await getBookedHoursHeatmap(wid, range, tz)).toEqual([]);

    const emptyRange = { from: new Date("2020-01-01T00:00:00.000Z"), to: new Date("2020-01-02T00:00:00.000Z") };
    await seedBooking({ sessions: sess });
    expect(await getBookedHoursHeatmap(wid, emptyRange, tz)).toEqual([]);
  });
});

describe("getScheduledVsCollectedSeries", () => {
  it("sums scheduledValue per weekly cohort and nets a refund against collected, ascending", async () => {
    const range = { from: new Date("2026-05-25T00:00:00.000Z"), to: new Date("2026-06-15T00:00:00.000Z") };
    const sessA = [{ startAt: monWeek1_10am, endAt: new Date(monWeek1_10am.getTime() + 3_600_000) }];
    const sessB = [{ startAt: monWeek2_10am, endAt: new Date(monWeek2_10am.getTime() + 3_600_000) }];

    const bookingA = await seedBooking({ sessions: sessA, total: 10_000 });
    const bookingB = await seedBooking({ sessions: sessB, total: 20_000 });

    await Transaction.create([
      { workspaceId: wid, bookingId: bookingA._id, amount: 4_000, type: "deposit", paidAt: null },
      { workspaceId: wid, bookingId: bookingA._id, amount: -1_000, type: "refund", paidAt: null },
      { workspaceId: wid, bookingId: bookingB._id, amount: 15_000, type: "deposit", paidAt: null },
    ]);

    const series = await getScheduledVsCollectedSeries(wid, range, tz);
    expect(series).toEqual([
      { bucket: "2026-06-01", scheduledValue: 10_000, collected: 3_000 },
      { bucket: "2026-06-08", scheduledValue: 20_000, collected: 15_000 },
    ]);
  });

  it("excludes draft/cancelled/other-workspace bookings; empty range yields []", async () => {
    const sess = [{ startAt: monWeek1_10am, endAt: new Date(monWeek1_10am.getTime() + 3_600_000) }];

    await seedBooking({ status: "draft", sessions: sess, total: 99_999 });
    await seedBooking({ status: "cancelled", sessions: sess, total: 88_888 });
    const otherBooking = await seedBooking({ workspaceId: other, sessions: sess, total: 77_777 });
    await Transaction.create({ workspaceId: other, bookingId: otherBooking._id, amount: 77_777, type: "deposit", paidAt: null });

    const range = { from: new Date("2026-05-25T00:00:00.000Z"), to: new Date("2026-06-15T00:00:00.000Z") };
    expect(await getScheduledVsCollectedSeries(wid, range, tz)).toEqual([]);

    const emptyRange = { from: new Date("2020-01-01T00:00:00.000Z"), to: new Date("2020-01-02T00:00:00.000Z") };
    await seedBooking({ sessions: sess, total: 1_000 });
    expect(await getScheduledVsCollectedSeries(wid, emptyRange, tz)).toEqual([]);
  });
});
