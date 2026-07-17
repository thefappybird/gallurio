import "server-only";
import { Types } from "mongoose";
import { Booking, Transaction } from "@/lib/db/models";
import { splitSessionIntoCandles } from "@/lib/bookings/candle-split";
import { type DateRange } from "./dashboard-metrics";

type WorkspaceId = Types.ObjectId;

const ACTIVE_STATUSES = ["booked", "completed"] as const;
const NET_TX_TYPES = ["deposit", "balance", "refund"] as const;

/** `firstSessionStart` range filter, or undefined when the range is unbounded. */
function firstSessionStartMatch(range: DateRange): Record<string, Date> | undefined {
  if (!range.from && !range.to) return undefined;
  const c: Record<string, Date> = {};
  if (range.from) c.$gte = range.from;
  if (range.to) c.$lte = range.to;
  return c;
}

/** Workspace-local "YYYY-MM-DD" of a UTC instant. */
function localDateKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Add `n` days to a "YYYY-MM-DD" string via pure calendar arithmetic (no timezone). */
function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** 0=Monday..6=Sunday for a "YYYY-MM-DD" calendar date. */
function weekdayMonday0(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  return (dow + 6) % 7;
}

// ponytail: weekly buckets; switch to monthly if ranges ever span years
function weekStartMonday(dateStr: string): string {
  return addDaysStr(dateStr, -weekdayMonday0(dateStr));
}

export type EventTypeValueTrend = {
  eventTypes: string[];
  points: { bucket: string; values: Record<string, number> }[];
};

export async function getEventTypeValueTrend(
  workspaceId: WorkspaceId,
  range: DateRange,
  timezone: string
): Promise<EventTypeValueTrend> {
  const match: Record<string, unknown> = { workspaceId, status: { $in: ACTIVE_STATUSES } };
  const fss = firstSessionStartMatch(range);
  if (fss) match.firstSessionStart = fss;

  const bookings = await Booking.find(match)
    .select({ eventType: 1, "amount.total": 1, firstSessionStart: 1 })
    .lean<{ eventType?: string; amount?: { total: number }; firstSessionStart: Date }[]>();

  const totalsByEventType = new Map<string, number>();
  const buckets = new Map<string, Map<string, number>>();

  for (const b of bookings) {
    const bucket = weekStartMonday(localDateKey(b.firstSessionStart, timezone));
    const eventType = b.eventType || "other";
    const value = b.amount?.total ?? 0;

    totalsByEventType.set(eventType, (totalsByEventType.get(eventType) ?? 0) + value);

    if (!buckets.has(bucket)) buckets.set(bucket, new Map());
    const bmap = buckets.get(bucket)!;
    bmap.set(eventType, (bmap.get(eventType) ?? 0) + value);
  }

  const eventTypes = [...totalsByEventType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  const points = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([bucket, m]) => ({ bucket, values: Object.fromEntries(m) }));

  return { eventTypes, points };
}

export type BookedHoursCell = { weekStart: string; weekday: number; hours: number };

export async function getBookedHoursHeatmap(
  workspaceId: WorkspaceId,
  range: DateRange,
  timezone: string
): Promise<BookedHoursCell[]> {
  // Overlap prefilter (indexed via {workspaceId, lastSessionEnd, firstSessionStart}):
  // a booking may start before the range but still have sessions landing inside it.
  const match: Record<string, unknown> = { workspaceId, status: { $in: ACTIVE_STATUSES } };
  if (range.to) match.firstSessionStart = { $lte: range.to };
  if (range.from) match.lastSessionEnd = { $gte: range.from };

  const bookings = await Booking.find(match)
    .select({ sessions: 1 })
    .lean<{ sessions: { startAt: Date; endAt: Date }[] }[]>();

  const fromKey = range.from ? localDateKey(range.from, timezone) : null;
  const toKey = range.to ? localDateKey(range.to, timezone) : null;

  const cellMap = new Map<string, number>(); // `${weekStart}|${weekday}` -> hours
  const referenceDate = new Date();

  for (const b of bookings) {
    for (const session of b.sessions) {
      const { candles } = splitSessionIntoCandles(session, referenceDate, timezone);
      for (const c of candles) {
        if (fromKey && c.dayKey < fromKey) continue;
        if (toKey && c.dayKey > toKey) continue;
        const hours = (c.end.getTime() - c.start.getTime()) / 3_600_000;
        const key = `${weekStartMonday(c.dayKey)}|${weekdayMonday0(c.dayKey)}`;
        cellMap.set(key, (cellMap.get(key) ?? 0) + hours);
      }
    }
  }

  return [...cellMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, hours]) => {
      const [weekStart, weekdayStr] = key.split("|");
      return { weekStart, weekday: Number(weekdayStr), hours };
    });
}

export type ValueCollectedPoint = { bucket: string; scheduledValue: number; collected: number };

export async function getScheduledVsCollectedSeries(
  workspaceId: WorkspaceId,
  range: DateRange,
  timezone: string
): Promise<ValueCollectedPoint[]> {
  const match: Record<string, unknown> = { workspaceId, status: { $in: ACTIVE_STATUSES } };
  const fss = firstSessionStartMatch(range);
  if (fss) match.firstSessionStart = fss;

  const bookings = await Booking.find(match)
    .select({ "amount.total": 1, firstSessionStart: 1 })
    .lean<{ _id: Types.ObjectId; amount?: { total: number }; firstSessionStart: Date }[]>();

  if (bookings.length === 0) return [];

  const bucketByBookingId = new Map<string, string>();
  const scheduledByBucket = new Map<string, number>();
  for (const b of bookings) {
    const bucket = weekStartMonday(localDateKey(b.firstSessionStart, timezone));
    bucketByBookingId.set(String(b._id), bucket);
    scheduledByBucket.set(bucket, (scheduledByBucket.get(bucket) ?? 0) + (b.amount?.total ?? 0));
  }

  // Collected regardless of paidAt -- linked by bookingId to the cohort.
  const ids = bookings.map((b) => b._id);
  const txns = await Transaction.find({
    workspaceId,
    bookingId: { $in: ids },
    type: { $in: NET_TX_TYPES },
  })
    .select({ bookingId: 1, amount: 1 })
    .lean<{ bookingId: Types.ObjectId; amount: number }[]>();

  const collectedByBucket = new Map<string, number>();
  for (const t of txns) {
    const bucket = bucketByBookingId.get(String(t.bookingId));
    if (!bucket) continue;
    collectedByBucket.set(bucket, (collectedByBucket.get(bucket) ?? 0) + t.amount);
  }

  return [...scheduledByBucket.keys()].sort().map((bucket) => ({
    bucket,
    scheduledValue: scheduledByBucket.get(bucket) ?? 0,
    collected: collectedByBucket.get(bucket) ?? 0,
  }));
}

export type CollectionCoverage = {
  confirmedValue: number;
  collected: number;
  remaining: number;
  coveragePct: number;
};

export async function getCollectionCoverage(
  workspaceId: WorkspaceId,
  range: DateRange
): Promise<CollectionCoverage> {
  const match: Record<string, unknown> = { workspaceId, status: { $in: ACTIVE_STATUSES } };
  const fss = firstSessionStartMatch(range);
  if (fss) match.firstSessionStart = fss;

  const bookings = await Booking.find(match)
    .select({ "amount.total": 1 })
    .lean<{ _id: Types.ObjectId; amount?: { total: number } }[]>();

  const confirmedValue = bookings.reduce((sum, b) => sum + (b.amount?.total ?? 0), 0);

  if (bookings.length === 0) {
    return { confirmedValue: 0, collected: 0, remaining: 0, coveragePct: 0 };
  }

  const ids = bookings.map((b) => b._id);
  const agg = await Transaction.aggregate<{ _id: null; total: number }>([
    {
      $match: {
        workspaceId,
        bookingId: { $in: ids },
        type: { $in: NET_TX_TYPES },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const collected = agg[0]?.total ?? 0;
  const remaining = Math.max(confirmedValue - collected, 0);
  const coveragePct = confirmedValue > 0 ? collected / confirmedValue : 0;

  return { confirmedValue, collected, remaining, coveragePct };
}
