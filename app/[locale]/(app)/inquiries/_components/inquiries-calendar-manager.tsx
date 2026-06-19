"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BookingCalendar,
  type CalendarEvent,
  type AnyCalendarEvent,
} from "../../bookings/_components/booking-calendar";
import { TeamFilterControl } from "../../bookings/_components/team-filter-control";
import type { BookingTeamOption } from "../../bookings/_data/team-options";
import {
  detectConflictIds,
  dateToTzWallClock,
} from "../../bookings/_components/_helpers/calendar-helpers";
import { rescheduleInquirySessionAction } from "../_actions";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { FALLBACK_TZ } from "@/lib/utils/timezone";

type Props = {
  events: CalendarEvent[];
  locale: string;
  teams?: BookingTeamOption[];
  isOwner?: boolean;
  /** IANA workspace timezone -- used to convert dropped Date back to wall-clock parts. */
  workspaceTz?: string;
};

/**
 * Returns true if an event should be visible given the three independent filter
 * chips.
 * - New chip: inquiry candles (kind === "inquiry"). All calendar inquiry candles
 *   are unbooked/new inquiries -- the page never adds booked/archived inquiry candles.
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
 * Calendar view for the inquiries page. New inquiry candles are draggable;
 * booking candles are not. On drop, persists via rescheduleInquirySessionAction
 * with optimistic update and revert on conflict/error.
 */
export function InquiriesCalendarManager({
  events,
  locale: _locale,
  teams = [],
  isOwner = false,
  workspaceTz,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tCal = useTranslations("app.calendar");
  const t = useTranslations("app.inquiries.calendar");

  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const showTeamFilter = teams.length > 1;

  const [showNew, setShowNew] = useState(true);
  const [showBooked, setShowBooked] = useState(true);
  const [showConflicted, setShowConflicted] = useState(true);

  // Optimistic position overrides keyed by event id. A dropped candle is moved
  // here immediately; reverted if the server action returns an error.
  const [optimisticOverrides, setOptimisticOverrides] = useState<Map<string, CalendarEvent>>(
    () => new Map()
  );
  // Prevents concurrent drops on the same inquiry session.
  const inFlightRef = useRef<Set<string>>(new Set());

  // Merge server events with any pending optimistic overrides.
  const mergedEvents = useMemo(() => {
    if (optimisticOverrides.size === 0) return events;
    return events.map((ev) => optimisticOverrides.get(ev.id) ?? ev);
  }, [events, optimisticOverrides]);

  const filteredEvents = useMemo(() => {
    let evs = mergedEvents;
    if (selectedTeams.length > 0) {
      evs = evs.filter(
        (ev) => ev.kind === "inquiry" || (ev.teamId !== null && selectedTeams.includes(ev.teamId))
      );
    }
    evs = evs.filter((ev) => calendarEventMatchesFilters(ev, showNew, showBooked, showConflicted));
    return evs;
  }, [mergedEvents, selectedTeams, showNew, showBooked, showConflicted]);

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
    router.push(pathname + "?" + params.toString());
  }

  /**
   * Shared handler for onEventDrop and onEventResize on New inquiry candles.
   * Optimistically moves the candle, calls the server action, reverts on error.
   */
  const handleInquiryDrop = useCallback(
    async ({ event: anyEvent, start, end }: EventInteractionArgs<AnyCalendarEvent>) => {
      // Overflow sentinel events are never draggable but guard defensively.
      if ("type" in anyEvent && (anyEvent as { type: string }).type === "overflow") return;
      const ev = anyEvent as CalendarEvent;
      if (ev.kind !== "inquiry" || !ev.inquiryId) return;

      // Prevent concurrent drops on the same session.
      const sessionKey = ev.id;
      if (inFlightRef.current.has(sessionKey)) return;
      inFlightRef.current.add(sessionKey);

      try {
        const tz = workspaceTz ?? FALLBACK_TZ;
        const newStart = new Date(start);
        const newEnd = new Date(end);

        // Month-view drags: rbc sets start to midnight of the target day.
        // Preserve the session shift times and shift date only.
        const newStartIsMidnight = newStart.getHours() === 0 && newStart.getMinutes() === 0;
        const eventHasTime = ev.start.getHours() !== 0 || ev.start.getMinutes() !== 0;
        const isDateOnlyDrag = newStartIsMidnight && eventHasTime;

        let candleStart: Date;
        let candleEnd: Date;

        if (isDateOnlyDrag) {
          const eventDayStart = new Date(ev.start);
          eventDayStart.setHours(0, 0, 0, 0);
          const newDayStart = new Date(newStart);
          newDayStart.setHours(0, 0, 0, 0);
          const dayDiff = Math.round(
            (newDayStart.getTime() - eventDayStart.getTime()) / 86_400_000
          );
          candleStart = new Date(ev.start);
          candleStart.setDate(candleStart.getDate() + dayDiff);
          candleEnd = new Date(ev.end);
          candleEnd.setDate(candleEnd.getDate() + dayDiff);
        } else {
          candleStart = newStart;
          candleEnd = newEnd;
        }

        // Same-position no-op.
        if (
          candleStart.getTime() === ev.start.getTime() &&
          candleEnd.getTime() === ev.end.getTime()
        ) {
          return;
        }

        // Derive wall-clock parts in workspace timezone for the server action.
        const { date: startDate, time: startTime } = dateToTzWallClock(candleStart, tz);
        const { time: endTime } = dateToTzWallClock(candleEnd, tz);

        // Optimistically move the candle.
        const prevEvent = ev;
        const optimisticEvent: CalendarEvent = {
          ...ev,
          start: candleStart,
          end: candleEnd,
          sessionStartAt: candleStart,
          sessionEndAt: candleEnd,
        };
        setOptimisticOverrides((prev) => new Map(prev).set(ev.id, optimisticEvent));

        const result = await rescheduleInquirySessionAction({
          inquiryId: ev.inquiryId,
          sessionIndex: ev.sessionIndex,
          startDate,
          startTime,
          endTime,
        });

        if ("error" in result) {
          // Revert optimistic move and toast the user.
          setOptimisticOverrides((prev) => {
            const next = new Map(prev);
            next.set(ev.id, prevEvent);
            return next;
          });
          if (result.error === "conflict") {
            toast.error(t("rescheduleConflict"));
          } else {
            toast.error(t("rescheduleFailed"));
          }
          return;
        }

        // Success -- clear the override and trigger a data refresh.
        setOptimisticOverrides((prev) => {
          const next = new Map(prev);
          next.delete(ev.id);
          return next;
        });
        router.refresh();
      } finally {
        inFlightRef.current.delete(sessionKey);
      }
    },
    [workspaceTz, t, router]
  );

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
      onEventDrop={handleInquiryDrop}
      onEventResize={handleInquiryDrop}
      draggableAccessor={(ev: AnyCalendarEvent) =>
        "kind" in ev &&
        (ev as CalendarEvent).kind === "inquiry" &&
        (ev as CalendarEvent).colorOverride !== undefined
      }
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
