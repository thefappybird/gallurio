import { splitSessionIntoCandles } from "@/lib/bookings/candle-split";
import type { CalendarEvent } from "@/app/[locale]/(app)/bookings/_components/booking-calendar";
import type { BookingStatus } from "@/lib/validators/booking";

/**
 * Shape expected from a lean BookingDoc for calendar-event building.
 * Mirrors the fields the page's flatMap uses — intentionally minimal so the
 * function stays testable without pulling in the full BookingDoc type.
 */
export type BookingEventInput = {
  _id: { toString(): string };
  title: string;
  clientName: string;
  clientId: { toString(): string } | null | undefined;
  teamId?: { toString(): string } | null;
  status: string;
  sessions: { startAt: Date; endAt: Date }[];
};

type BuildOptions = {
  /** Midnight of "today" in UTC — used by candle-split to mark past days. */
  today: Date;
  /** Maps client._id.toString() → email (nullable). */
  emailByClientId: Map<string, string | null>;
};

/**
 * Converts an array of booking docs into per-day CalendarEvent candles.
 *
 * Each session of each booking is split into one candle per calendar day it
 * spans. Candle ids encode `<bookingId>_s<sessionIdx>_<YYYY-MM-DD>` and are
 * stable across renders.
 *
 * Only used by the calendar view. Pass an empty array for the table view to
 * avoid the split work entirely.
 */
export function buildBookingCalendarEvents(
  bookings: BookingEventInput[],
  opts: BuildOptions
): CalendarEvent[] {
  const { today, emailByClientId } = opts;

  return bookings.flatMap((b) => {
    const bookingId = b._id.toString();
    const sessions = b.sessions as { startAt: Date; endAt: Date }[];

    return sessions.flatMap((session, sessionIdx) => {
      const sessionStart = new Date(session.startAt);
      const sessionEnd = new Date(session.endAt);

      const result = splitSessionIntoCandles(
        { startAt: sessionStart, endAt: sessionEnd },
        today
      );

      return result.candles.map((candle) => ({
        id: `${bookingId}_s${sessionIdx}_${candle.dayKey}`,
        bookingId,
        teamId: b.teamId ? String(b.teamId) : null,
        title: b.title,
        start: candle.start,
        end: candle.end,
        status: b.status as BookingStatus,
        clientName: b.clientName,
        clientEmail: b.clientId
          ? (emailByClientId.get(b.clientId.toString()) ?? null)
          : null,
        rangeStart: result.rangeStart,
        rangeEnd: result.rangeEnd,
        sessionIndex: sessionIdx,
        sessionStartAt: sessionStart,
        sessionEndAt: sessionEnd,
        sessionDayCount: result.totalShiftDays,
        sessionPastDayCount: result.pastShiftDays,
      }));
    });
  });
}
