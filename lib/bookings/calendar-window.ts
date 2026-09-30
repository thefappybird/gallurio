import { dayBoundInTz } from "@/lib/utils/timezone";
import { isoDateInTz } from "@/app/[locale]/(app)/bookings/_components/_helpers/calendar-helpers";

/** Days added beyond the visible month grid on each side (>= 15 so a prev/next
 *  click never needs a refetch even with a 2-week week-start mismatch). */
export const CALENDAR_WINDOW_PAD_DAYS = 31;

export type CalendarWindow = {
  start: Date;
  end: Date;
  /** YYYY-MM-DD in the workspace tz (inclusive). */
  startDate: string;
  endDate: string;
};

const DAY_MS = 86_400_000;

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Month grid containing `date` (as seen in `tz`), padded to full weeks, then
 * extended by CALENDAR_WINDOW_PAD_DAYS each side. react-big-calendar's
 * date-fns localizer uses the default week start (Sunday).
 */
export function calendarWindow(date: Date, tz: string): CalendarWindow {
  const [y, m] = isoDateInTz(date, tz).split("-").map(Number);
  const firstOfMonth = Date.UTC(y, m - 1, 1);
  const lastOfMonth = Date.UTC(y, m, 0);
  const leading = new Date(firstOfMonth).getUTCDay();
  const trailing = 6 - new Date(lastOfMonth).getUTCDay();
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const startDate = addDays(iso(firstOfMonth), -(leading + CALENDAR_WINDOW_PAD_DAYS));
  const endDate = addDays(iso(lastOfMonth), trailing + CALENDAR_WINDOW_PAD_DAYS);
  return {
    startDate,
    endDate,
    start: dayBoundInTz(startDate, tz, 0, 0, 0, 0),
    end: dayBoundInTz(endDate, tz, 23, 59, 59, 999),
  };
}

/** True when [range.start, range.end] lies fully inside the window. */
export function isRangeInsideWindow(
  range: { start: Date; end: Date },
  window: Pick<CalendarWindow, "start" | "end">
): boolean {
  return range.start.getTime() >= window.start.getTime() && range.end.getTime() <= window.end.getTime();
}

export type CalendarGridView = "month" | "week" | "day" | "agenda" | (string & {});

/**
 * Day range react-big-calendar shows for `date` (its local Y/M/D) in `view`:
 * month = Sunday-aligned grid incl. spill-over days, week = Sun..Sat, day = the
 * day. Bounds are workspace-tz day bounds, matching how candles are placed.
 */
export function visibleGridRange(
  date: Date,
  view: CalendarGridView,
  tz: string
): { start: Date; end: Date } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  let first = Date.UTC(y, m, d);
  let last = first;
  if (view === "month") {
    first = Date.UTC(y, m, 1);
    last = Date.UTC(y, m + 1, 0);
  }
  if (view === "month" || view === "week") {
    first -= new Date(first).getUTCDay() * DAY_MS;
    last += (6 - new Date(last).getUTCDay()) * DAY_MS;
  }
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return {
    start: dayBoundInTz(iso(first), tz, 0, 0, 0, 0),
    end: dayBoundInTz(iso(last), tz, 23, 59, 59, 999),
  };
}
