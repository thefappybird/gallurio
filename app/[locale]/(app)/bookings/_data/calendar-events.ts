import "server-only";
import type { Types } from "mongoose";
import type { CalendarEvent } from "../_components/booking-calendar";
import { buildBookingCalendarEvents } from "@/lib/bookings/build-booking-events";
import { calendarWindow } from "@/lib/bookings/calendar-window";
import { dayBoundInTz } from "@/lib/utils/timezone";
import { listBookings, type BookingListFilters } from "./bookings-queries";

/**
 * Parses a `?date=` param; falls back to `fallback` on absent/invalid input.
 * `YYYY-MM-DD` is a WALL date in the workspace `tz`, returned as that day's
 * noon instant (safe against DST/offset shifts) so the month window never
 * centres on the neighbouring month in west-of-UTC zones.
 */
export function parseCalendarDate(
  value: string | null | undefined,
  tz: string,
  fallback = new Date()
): Date {
  if (!value) return fallback;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? dayBoundInTz(value, tz, 12, 0, 0, 0) : new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/**
 * Bookings calendar candles for the month window around `date` (+/- padding).
 * ONE Booking query (overlap filter, index { workspaceId, lastSessionEnd,
 * firstSessionStart }). No client-email lookup — the field is never rendered.
 */
export async function loadBookingsCalendarEvents(args: {
  workspaceId: Types.ObjectId;
  tz: string;
  date?: Date;
  filters: BookingListFilters;
}): Promise<CalendarEvent[]> {
  const { workspaceId, tz, filters } = args;
  const window = calendarWindow(args.date ?? new Date(), tz);
  const { rows } = await listBookings(
    workspaceId,
    { ...filters, workspaceTimezone: tz, range: { start: window.start, end: window.end } },
    undefined
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return buildBookingCalendarEvents(rows, { today, tz });
}
