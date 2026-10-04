import "server-only";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Inquiry } from "@/lib/db/models";
import type { CalendarEvent } from "../../bookings/_components/booking-calendar";
import { buildBookingCalendarEvents } from "@/lib/bookings/build-booking-events";
import { calendarWindow } from "@/lib/bookings/calendar-window";
import { buildInquiryCalendarEvents } from "@/lib/inquiries/inquiry-candles";
import { computeInquiryConflictsFromBookings } from "@/lib/db/queries/inquiry-conflicts";

/**
 * Inquiries calendar candles for the month window around `date` (+/- padding).
 * Exactly two reads:
 *  1. Inquiry: { workspaceId, status:"inquiry", sessions.$elemMatch(startDate in window) }
 *     (index { workspaceId, status, createdAt } prefix; open-inquiry set is small).
 *  2. Booking (workspace-wide): { workspaceId, status in booked|completed,
 *     firstSessionStart < end, lastSessionEnd >= start }
 *     (index { workspaceId, lastSessionEnd, firstSessionStart }).
 * Conflicts use ALL window bookings; booking candles are limited to
 * `allowedTeamIds` when defined (staff) so other teams' bookings never leave
 * the server.
 */
export async function loadInquiriesCalendarData(args: {
  workspaceId: Types.ObjectId;
  tz: string;
  date?: Date;
  allowedTeamIds?: readonly string[];
}): Promise<CalendarEvent[]> {
  const { workspaceId, tz, allowedTeamIds } = args;
  const window = calendarWindow(args.date ?? new Date(), tz);
  await connectDB();

  const [inquiries, bookings] = await Promise.all([
    Inquiry.find({
      workspaceId,
      status: "inquiry",
      sessions: { $elemMatch: { startDate: { $gte: window.startDate, $lte: window.endDate } } },
    })
      .select({ status: 1, eventTitle: 1, name: 1, sessions: 1 })
      .lean(),
    Booking.find({
      workspaceId,
      status: { $in: ["booked", "completed"] },
      firstSessionStart: { $lt: window.end },
      lastSessionEnd: { $gte: window.start },
    })
      .select({ title: 1, clientName: 1, clientId: 1, teamId: 1, status: 1, sessions: 1, updatedAt: 1 })
      .lean(),
  ]);

  const inquiryInputs = inquiries.map((q) => ({
    _id: q._id.toString(),
    status: q.status,
    eventName: q.eventTitle ?? null,
    clientName: q.name ?? null,
    sessions: (q.sessions ?? []).map((s) => ({
      startDate: s.startDate,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  }));
  const conflicts = computeInquiryConflictsFromBookings(inquiryInputs, bookings, tz);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const inquiryEvents = buildInquiryCalendarEvents(
    inquiryInputs.map((q) => ({ ...q, hasConflict: conflicts.has(q._id) })),
    { today, tz }
  );

  const allowed = allowedTeamIds ? new Set(allowedTeamIds) : null;
  const visibleBookings = allowed
    ? bookings.filter((b) => b.teamId != null && allowed.has(String(b.teamId)))
    : bookings;
  const bookingEvents = buildBookingCalendarEvents(visibleBookings, { today, tz });

  return [...inquiryEvents, ...bookingEvents];
}
