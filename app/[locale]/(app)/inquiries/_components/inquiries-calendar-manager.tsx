"use client";

import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookingCalendar, type CalendarEvent } from "../../bookings/_components/booking-calendar";

type Props = {
  events: CalendarEvent[];
  locale: string;
};

/**
 * Read-only calendar view for the inquiries page. Wraps BookingCalendar
 * without DnD (onEventDrop/onEventResize omitted) and routes clicks to either
 * the inquiry detail modal (?inquiryId=) or booking detail modal (?detail=),
 * preserving ?view=calendar in both cases.
 */
export function InquiriesCalendarManager({ events, locale: _locale }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tCal = useTranslations("app.calendar");
  const t = useTranslations("app.inquiries.calendar");

  function handleSelectEvent(ev: CalendarEvent) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "calendar");
    if (ev.kind === "inquiry" && ev.inquiryId) {
      params.set("inquiryId", ev.inquiryId);
      params.delete("detail");
    } else {
      params.set("detail", ev.bookingId);
      params.delete("inquiryId");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <BookingCalendar
        events={events}
        onSelectEvent={handleSelectEvent}
        messages={{
        today: tCal("today"),
        previous: tCal("previous"),
        next: tCal("next"),
        day: tCal("views.day"),
        week: tCal("views.week"),
        month: tCal("views.month"),
        date: tCal("date"),
        time: tCal("time"),
        event: tCal("event"),
        noEventsInRange: tCal("noEventsInRange"),
        goTo: tCal("goTo"),
        scrollToTime: tCal("scrollToTime"),
        go: tCal("go"),
      }}
      />
      <div className="flex gap-4 px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: "var(--event-lead)" }} />
          {t("legendInquiry")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" />
          {t("legendBooking")}
        </span>
      </div>
    </div>
  );
}
