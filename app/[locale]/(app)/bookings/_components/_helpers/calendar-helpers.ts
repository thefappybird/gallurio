import type { CalendarEvent } from "../booking-calendar";
import type { Session } from "@/lib/bookings/session-edits";
import type { ShiftHit } from "../booking-wizard-steps/types";
import { dayBoundInTz } from "@/lib/utils/timezone";
export type { ShiftHit } from "../booking-wizard-steps/types";

/**
 * Convert "HH:MM" string to minutes since midnight.
 * Returns null on bad input (empty, non-numeric, out of range).
 */
export function toMinutes(hhmm: string): number | null {
  if (!hhmm) return null;
  const parts = hhmm.split(":");
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Return the subset of `shifts` whose time window overlaps [aStart, aEnd)
 * (both in minutes since midnight). Adjacent-exact boundaries do NOT overlap.
 */
export function overlappingShifts(
  shifts: ShiftHit[],
  aStart: number,
  aEnd: number
): ShiftHit[] {
  return shifts.filter((s) => {
    const bStart = toMinutes(s.shiftStart);
    const bEnd = toMinutes(s.shiftEnd);
    return bStart !== null && bEnd !== null && aStart < bEnd && bStart < aEnd;
  });
}

/**
 * Format a Date as a local YYYY-MM-DD string (local time, not UTC).
 * Used so drag-drop date strings match what the workspace timezone would show.
 */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Format a UTC Date as YYYY-MM-DD in the given IANA timezone.
 * This is the timezone-correct replacement for `isoDate()` when the workspace
 * timezone is known. The server's shifts-on-date route uses this same TZ to
 * resolve day boundaries, so the client must send the same date string.
 */
export function isoDateInTz(d: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // en-CA produces YYYY-MM-DD natively
}

/**
 * Return minutes-since-midnight for a UTC Date as seen in `timeZone`.
 * Used so the client-side overlap comparison uses the same TZ reference as the
 * server's shiftStart/shiftEnd HH:MM strings.
 */
export function dateToTzMinutes(d: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/**
 * Return the wall-clock date (YYYY-MM-DD) and time (HH:MM) for a UTC Date as
 * seen in `timeZone`. Used to convert a DnD-dropped Date back to the inputs
 * expected by `rescheduleInquirySessionAction`.
 */
export function dateToTzWallClock(
  d: Date,
  timeZone: string
): { date: string; time: string } {
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
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  // Some ICU/V8 builds emit "24" for midnight with hour12:false; normalise to "00".
  const rawHour = get("hour");
  const hour = rawHour === "24" ? "00" : rawHour;
  const time = `${hour}:${get("minute")}`;
  return { date, time };
}

/**
 * Construct a "grid display" Date whose native LOCAL getters (getFullYear,
 * getMonth, getDate, getHours, getMinutes) reproduce the wall-clock instant
 * `d` represents in `timeZone` — regardless of the runtime's actual local
 * timezone.
 *
 * react-big-calendar's dateFnsLocalizer positions events on the month/week/day
 * grid by reading a Date's native LOCAL getters. Fed a real UTC `Date`
 * directly, a viewer whose browser/runtime timezone differs from the
 * workspace's configured timezone sees candles placed in the wrong day/hour
 * cell — even though the formatted time label (rendered separately via
 * `workspaceTz`) is correct. Feeding `startAccessor`/`endAccessor` through
 * this function instead places the candle in the grid cell matching the
 * workspace wall clock for every viewer, regardless of their own timezone.
 *
 * Pair with `fromCalendarGridDate` to invert — e.g. converting a drag/resize
 * drop position (computed by react-big-calendar in this same "grid display"
 * domain) back to a real UTC instant.
 */
export function toCalendarGridDate(d: Date, timeZone: string): Date {
  const { date, time } = dateToTzWallClock(d, timeZone);
  const [y, m, day] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, day, h, min, 0, 0);
}

/**
 * Inverse of `toCalendarGridDate`. Given a "grid display" Date (whose native
 * LOCAL getters encode a workspace-timezone wall clock — either produced by
 * `toCalendarGridDate` or by react-big-calendar's drag/resize grid math
 * operating on such display dates) reconstruct the true UTC instant.
 */
export function fromCalendarGridDate(displayDate: Date, timeZone: string): Date {
  return dayBoundInTz(
    isoDate(displayDate),
    timeZone,
    displayDate.getHours(),
    displayDate.getMinutes(),
    0,
    0
  );
}

/**
 * Return the set of CalendarEvent ids that have a time-window overlap with at
 * least one other event from a different booking. Used to render a conflict
 * indicator (&#9888;) on calendar candles.
 *
 * Overlap test: standard half-open interval — adjacent-exact boundaries do NOT
 * conflict, which matches `overlappingShifts()`.
 */
export function detectConflictIds(events: CalendarEvent[]): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (a.bookingId === b.bookingId) continue;
      // Two inquiry candles overlapping each other are not a conflict;
      // only an inquiry vs. a real booking (or booking vs. booking) counts.
      if (a.kind === "inquiry" && b.kind === "inquiry") continue;
      if (a.start < b.end && b.start < a.end) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}

/**
 * Reconstruct the full ordered sessions array for a given booking from the
 * current optimistic events state.
 *
 * Candles share `sessionIndex`, `sessionStartAt`, `sessionEndAt` within each
 * session group — we deduplicate by `sessionIndex` and sort ascending.
 */
export function reconstructSessions(
  optimisticEvents: CalendarEvent[],
  bookingId: string
): Session[] {
  const byIndex = new Map<number, Session>();
  for (const e of optimisticEvents) {
    if (e.bookingId !== bookingId) continue;
    if (!byIndex.has(e.sessionIndex)) {
      byIndex.set(e.sessionIndex, {
        startAt: e.sessionStartAt,
        endAt: e.sessionEndAt,
      });
    }
  }
  return Array.from(byIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([, s]) => s);
}
