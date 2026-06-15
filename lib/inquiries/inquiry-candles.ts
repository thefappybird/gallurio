import type { CalendarEvent } from "@/app/[locale]/(app)/bookings/_components/booking-calendar";
import { wallTimeInTzToUtc } from "@/lib/utils/timezone";

export type InquiryCalendarInput = {
  _id: string;
  eventName?: string | null;
  sessions: Array<{
    startDate: string; // "YYYY-MM-DD"
    startTime: string; // "HH:MM" wall-clock
    endTime: string;   // "HH:MM" wall-clock
  }>;
  clientName?: string | null;
};

export function buildInquiryCalendarEvents(
  inquiries: InquiryCalendarInput[],
  opts: { today: Date; tz: string }
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const inq of inquiries) {
    inq.sessions.forEach((session, idx) => {
      const startUtc = wallTimeInTzToUtc(session.startDate, session.startTime, opts.tz);
      const endUtc = wallTimeInTzToUtc(session.startDate, session.endTime, opts.tz);

      if (!startUtc || !endUtc) return;

      const start = new Date(startUtc);
      const end = new Date(endUtc);
      const rangeStart = new Date(start);

      events.push({
        id: `${inq._id}_s${idx}`,
        bookingId: inq._id,
        title: inq.eventName ?? "Inquiry",
        start,
        end,
        status: "booked",
        clientName: inq.clientName ?? "",
        clientEmail: null,
        rangeStart,
        rangeEnd: rangeStart,
        sessionIndex: idx,
        sessionStartAt: start,
        sessionEndAt: end,
        sessionDayCount: 1,
        sessionPastDayCount: start < opts.today ? 1 : 0,
        teamId: null,
        kind: "inquiry",
        inquiryId: inq._id,
        colorOverride: "var(--event-lead)",
      });
    });
  }

  return events;
}
