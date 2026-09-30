import "server-only";
import type { Types } from "mongoose";
import type { CalendarEvent } from "../_components/booking-calendar";
import { buildBookingCalendarEvents } from "@/lib/bookings/build-booking-events";
import { calendarWindow } from "@/lib/bookings/calendar-window";
import { listBookings, type BookingListFilters } from "./bookings-queries";

/** Parses a `?date=` param; falls back to `fallback` on absent/invalid input. */
export function parseCalendarDate(value: string | null | undefined, fallback = new Date()): Date {
  if (!value) return fallback;
  const d = new Date(value);
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
