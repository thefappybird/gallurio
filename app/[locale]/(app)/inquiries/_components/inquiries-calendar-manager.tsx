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

type Props = {
  events: CalendarEvent[];
  locale: string;
  teams?: BookingTeamOption[];
  isOwner?: boolean;
};

/**
 * Returns true if an event should be visible given the three independent filter
 * chips.
 * - New chip: inquiry candles (kind === "inquiry"). All calendar inquiry candles
 *   are unbooked/new inquiries — the page never adds booked/archived inquiry candles.
 * - Booked chip: booking candles (kind !== "inquiry").
 * - Conflicted: a narrowing chip over New. When enabled, conflicted inquiry
 *   candles are shown even if New is off; when New is on, all inquiry candles
 *   (conflicted or not) are shown.
 */
export function calendarEventMatchesFilters(
  ev: CalendarEvent,
  showNew: boolean,
  showBooked: boolean,
  showConflicted: boolean,
): boolean {
  if (ev.kind !== "inquiry") return showBooked;
  // All calendar inquiry candles are "new" inquiries; conflicted is a sub-filter.
  if (ev.hasConflict) return showNew || showConflicted;
  return showNew;
}

/**
 * Merges server-authoritative conflict state with the client-detected conflict
 * set. An event is conflicted if the server already flagged it (stable) OR if
 * the client detector flags it (booking-vs-booking visual overlap).
 */
export function mergeConflict(ev: CalendarEvent, conflictIds: Set<string>): CalendarEvent {
  const hasConflict = ev.hasConflict || conflictIds.has(ev.id);
  return hasConflict === ev.hasConflict ? ev : { ...ev, hasConflict };
}

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

  // Three independent filter chips; all default ON
  const [showNew, setShowNew] = useState(true);
  const [showBooked, setShowBooked] = useState(true);
  const [showConflicted, setShowConflicted] = useState(true);

  const filteredEvents = useMemo(() => {
    let evs = events;
    if (selectedTeams.length > 0) {
      evs = evs.filter(
        (ev) => ev.kind === "inquiry" || (ev.teamId !== null && selectedTeams.includes(ev.teamId))
      );
    }
    evs = evs.filter((ev) => calendarEventMatchesFilters(ev, showNew, showBooked, showConflicted));
    return evs;
  }, [events, selectedTeams, showNew, showBooked, showConflicted]);

  const eventsWithConflicts = useMemo(() => {
    const conflictIds = detectConflictIds(filteredEvents);
    if (conflictIds.size === 0) return filteredEvents;
    return filteredEvents.map((e) => mergeConflict(e, conflictIds));
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

  const chipClass = (active: boolean) =>
    cn(
      "inline-flex min-h-9 items-center gap-1.5 border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      active
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-card text-muted-foreground opacity-50"
    );

  const toolbarTrailing = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setShowNew((v) => !v)}
        aria-pressed={showNew}
        className={chipClass(showNew)}
      >
        <span
          aria-hidden
          className="size-2.5 shrink-0"
          style={{ background: showNew ? "currentColor" : "var(--event-inquiry)" }}
        />
        {t("filters.new")}
      </button>
      <button
        type="button"
        onClick={() => setShowBooked((v) => !v)}
        aria-pressed={showBooked}
        className={chipClass(showBooked)}
      >
        <span
          aria-hidden
          className="size-2.5 shrink-0"
          style={{ background: showBooked ? "currentColor" : "var(--event-booked)" }}
        />
        {t("filters.booked")}
      </button>
      <button
        type="button"
        onClick={() => setShowConflicted((v) => !v)}
        aria-pressed={showConflicted}
        className={chipClass(showConflicted)}
      >
        <span
          aria-hidden
          className="size-2.5 shrink-0"
          style={{ background: showConflicted ? "currentColor" : "var(--danger)" }}
        />
        {t("filters.conflicted")}
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
