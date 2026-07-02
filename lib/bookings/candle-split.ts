import { dayBoundInTz } from "@/lib/utils/timezone";

export type SessionInput = { startAt: Date; endAt: Date };

export type Candle = {
  start: Date;
  end: Date;
  dayKey: string; // YYYY-MM-DD of the shift-day (the evening side for overnight), in the workspace timezone
};

export type CandleSplitResult = {
  candles: Candle[];
  totalShiftDays: number;
  pastShiftDays: number;
  rangeStart: Date; // first calendar day touched
  rangeEnd: Date;   // last calendar day touched
};

/** Wall-clock date ("YYYY-MM-DD") and hour/minute of a UTC Date, as seen in `timeZone`. */
function wallClockParts(
  d: Date,
  timeZone: string
): { date: string; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  // Some ICU/V8 builds emit "24" for midnight with hour12:false; normalise to "00".
  const rawHour = get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: rawHour === "24" ? 0 : Number(rawHour),
    minute: Number(get("minute")),
  };
}

/** Add `n` days to a "YYYY-MM-DD" string via pure calendar arithmetic (no timezone). */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** Midnight of `dateStr` in `timeZone`, as a real UTC instant. */
function startOfDayInTz(dateStr: string, timeZone: string): Date {
  return dayBoundInTz(dateStr, timeZone, 0, 0, 0, 0);
}

/**
 * Splits a session into one candle per calendar day it spans, using
 * wall-clock day/hour boundaries in `timeZone` (the workspace's configured
 * IANA timezone) rather than the server process's local timezone — so the
 * split lands on the correct day regardless of where the code runs.
 */
export function splitSessionIntoCandles(
  session: SessionInput,
  today: Date,
  timeZone: string
): CandleSplitResult {
  const sessionStart = new Date(session.startAt);
  const sessionEnd = new Date(session.endAt);

  const startParts = wallClockParts(sessionStart, timeZone);
  const endParts = wallClockParts(sessionEnd, timeZone);

  const isOvernight =
    endParts.hour < startParts.hour ||
    (endParts.hour === startParts.hour && endParts.minute < startParts.minute);

  const firstDay = startParts.date;
  // For overnight sessions the trailing morning belongs to the previous
  // evening's shift, so the last shift-day starts one calendar day before
  // sessionEnd's date.
  const lastShiftDay = isOvernight ? addDays(endParts.date, -1) : endParts.date;

  const rangeStart = startOfDayInTz(firstDay, timeZone);
  // rangeEnd is the last calendar day touched: for overnight that is
  // lastShiftDay + 1 (the morning side); for daytime it is lastShiftDay.
  const rangeEnd = startOfDayInTz(
    isOvernight ? addDays(lastShiftDay, 1) : lastShiftDay,
    timeZone
  );

  const candles: Candle[] = [];
  let pastShiftDays = 0;
  let cursor = firstDay;

  while (cursor <= lastShiftDay) {
    const candleStart = dayBoundInTz(cursor, timeZone, startParts.hour, startParts.minute, 0, 0);
    const candleEnd = isOvernight
      ? dayBoundInTz(addDays(cursor, 1), timeZone, endParts.hour, endParts.minute, 0, 0)
      : dayBoundInTz(cursor, timeZone, endParts.hour, endParts.minute, 0, 0);

    if (startOfDayInTz(cursor, timeZone) < today) {
      pastShiftDays++;
    }

    candles.push({
      start: candleStart,
      end: candleEnd,
      dayKey: cursor,
    });

    cursor = addDays(cursor, 1);
  }

  return {
    candles,
    totalShiftDays: candles.length,
    pastShiftDays,
    rangeStart,
    rangeEnd,
  };
}
