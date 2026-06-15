"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookingCalendar, type CalendarEvent } from "../../bookings/_components/booking-calendar";
import { TeamLegend } from "../../bookings/_components/team-legend";
import type { BookingTeamOption } from "../../bookings/_data/team-options";
import { detectConflictIds } from "../../bookings/_components/_helpers/calendar-helpers";

type Props = {
  events: CalendarEvent[];
  locale: string;
  teams?: BookingTeamOption[];
  isOwner?: boolean;
};

/**
 * Read-only calendar view for the inquiries page. Wraps BookingCalendar
 * without DnD and routes clicks to either the inquiry detail modal (?inquiryId=)
 * or booking detail modal (?detail=), preserving ?view=calendar in both cases.
 */
export function InquiriesCalendarManager({
  events,
  locale: _locale,
  teams = [],
  isOwner = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tCal = useTranslations("app.calendar");
  const t = useTranslations("app.inquiries.calendar");

  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const showTeamFilter = teams.length > 1;

  const filteredEvents = useMemo(() => {
    if (selectedTeams.length === 0) return events;
    return events.filter(
      (ev) => ev.kind === "inquiry" || (ev.teamId !== null && selectedTeams.includes(ev.teamId))
    );
  }, [events, selectedTeams]);

  const eventsWithConflicts = useMemo(() => {
    const conflictIds = detectConflictIds(filteredEvents);
    if (conflictIds.size === 0) return filteredEvents;
    return filteredEvents.map((e) => conflictIds.has(e.id) ? { ...e, hasConflict: true } : e);
  }, [filteredEvents]);

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
        events={eventsWithConflicts}
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        {showTeamFilter && (
          <TeamLegend
            teams={teams}
            selected={selectedTeams}
            isOwner={isOwner}
            onChange={setSelectedTeams}
          />
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="inline-flex min-h-8 items-center gap-1.5 border border-border px-2 py-1 text-xs font-medium text-muted-foreground">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: "var(--event-inquiry)" }} />
            {t("legendInquiry")}
          </span>
          <span className="inline-flex min-h-8 items-center gap-1.5 border border-border px-2 py-1 text-xs font-medium text-muted-foreground">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-primary" />
            {t("legendBooking")}
          </span>
        </div>
      </div>
    </div>
  );
}
