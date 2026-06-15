"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { BookingCalendar, type CalendarEvent } from "../../bookings/_components/booking-calendar";
import { TeamFilterControl } from "../../bookings/_components/team-filter-control";
import type { BookingTeamOption } from "../../bookings/_data/team-options";
import { detectConflictIds } from "../../bookings/_components/_helpers/calendar-helpers";
import { isBookedInquiryStatus } from "@/lib/inquiries/status";

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

  // Status legend: clickable filters for inquiry vs booked event types
  const [showUnbooked, setShowUnbooked] = useState(true);
  const [showBookedInquiries, setShowBookedInquiries] = useState(true);

  const filteredEvents = useMemo(() => {
    let evs = events;
    if (selectedTeams.length > 0) {
      evs = evs.filter(
        (ev) => ev.kind === "inquiry" || (ev.teamId !== null && selectedTeams.includes(ev.teamId))
      );
    }
    if (!showUnbooked || !showBookedInquiries) {
      evs = evs.filter((ev) => {
        if (ev.kind !== "inquiry") return true;
        const booked = isBookedInquiryStatus(ev.status as string);
        if (booked) return showBookedInquiries;
        return showUnbooked;
      });
    }
    return evs;
  }, [events, selectedTeams, showUnbooked, showBookedInquiries]);

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

  const toolbarTrailing = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setShowUnbooked((v) => !v)}
        aria-pressed={showUnbooked}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          showUnbooked
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card text-muted-foreground opacity-50"
        )}
      >
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: showUnbooked ? "currentColor" : "var(--event-inquiry)" }} />
        {t("legendInquiry")}
      </button>
      <button
        type="button"
        onClick={() => setShowBookedInquiries((v) => !v)}
        aria-pressed={showBookedInquiries}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          showBookedInquiries
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card text-muted-foreground opacity-50"
        )}
      >
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: showBookedInquiries ? "currentColor" : "var(--primary)" }} />
        {t("legendBooking")}
      </button>
      {showTeamFilter && (
        <TeamFilterControl
          teams={teams}
          selected={selectedTeams}
          isOwner={isOwner}
          onChange={setSelectedTeams}
        />
      )}
    </div>
  );

  return (
    <BookingCalendar
      events={eventsWithConflicts}
      onSelectEvent={handleSelectEvent}
      toolbarTrailing={toolbarTrailing}
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
  );
}
