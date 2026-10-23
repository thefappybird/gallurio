"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setUrlParams } from "@/lib/utils/url-params";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  CalendarEvent,
  AnyCalendarEvent,
} from "../../bookings/_components/booking-calendar";
import { InquiriesCalendarLazy } from "../../bookings/_components/booking-calendar-dynamic";
import { TeamFilterControl } from "../../bookings/_components/team-filter-control";
import type { BookingTeamOption } from "../../bookings/_data/team-options";
import {
  detectConflictIds,
  dateToTzWallClock,
  wallDateAsLocal,
} from "../../bookings/_components/_helpers/calendar-helpers";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { FALLBACK_TZ, dayBoundInTz } from "@/lib/utils/timezone";
import { INQUIRIES_CALENDAR_FALLBACK } from "@/components/app/calendar-skeleton";
import { useInvalidateFor } from "@/hooks/use-data-events";
import { useCalendarWindowNav } from "../../bookings/_components/_helpers/use-calendar-window-nav";

type Props = {
  events: CalendarEvent[];
  locale: string;
  teams?: BookingTeamOption[];
  isOwner?: boolean;
  /** IANA workspace timezone -- used to convert dropped Date back to wall-clock parts. */
  workspaceTz?: string;
  /** ISO bounds of the candle window the server loaded around `?date`. */
  window?: { start: string; end: string };
  /** Calendar's initial date (the `?date` the server windowed around). */
  defaultDate?: Date;
  /** Opens an inquiry candle through the page client (pushState + cached detail read). */
  onOpenInquiry?: (inquiryId: string) => void;
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
 * Returns true if the given calendar event should be draggable.
 * Only future, non-booked inquiry candles (those with a colorOverride) are draggable.
 */
export function isInquiryCandleDraggable(ev: CalendarEvent): boolean {
  return (
    ev.kind === "inquiry" &&
    ev.colorOverride !== undefined &&
    ev.end >= new Date()
  );
}

// A stale-copy override is held at most this long after the drop, so a refresh that
// never carries the new position cannot pin the candle forever.
const OVERRIDE_MAX_HOLD_MS = 15_000;

// Stable default so the memoized toolbar isn't rebuilt every render.
const NO_TEAMS: BookingTeamOption[] = [];

function isDraggableEvent(ev: AnyCalendarEvent): boolean {
  return "kind" in ev && isInquiryCandleDraggable(ev as CalendarEvent);
}

/**
 * Calendar view for the inquiries page. New inquiry candles are draggable;
 * booking candles are not. On drop, persists via rescheduleInquirySessionAction
 * with optimistic update and revert on conflict/error.
 */
export function InquiriesCalendarManager({
  events,
  locale: _locale,
  teams = NO_TEAMS,
  isOwner = false,
  workspaceTz,
  window,
  defaultDate,
  onOpenInquiry,
}: Props) {
  const invalidateFor = useInvalidateFor();
  const tCal = useTranslations("app.calendar");
  const t = useTranslations("app.inquiries.calendar");

  const { onVisibleChange, isPending: windowPending } = useCalendarWindowNav({
    window,
    tz: workspaceTz ?? FALLBACK_TZ,
  });

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
  // The latest request owns each session's optimistic position. Re-dropping
  // aborts the previous fetch and replaces its controller.
  const inFlightRef = useRef<Map<string, AbortController>>(new Map());
  const toastIdsRef = useRef<Map<string, string | number>>(new Map());
  const externalDragRef = useRef<CalendarEvent | null>(null);

  // Where each dropped candle started, to tell a stale server copy (still the old
  // position) from an authoritative one when events refresh.
  const originRef = useRef<Map<string, { start: number; end: number; at: number }>>(new Map());

  // When fresh server events arrive, drop an override only once the incoming copy
  // is authoritative: it shows the override's position, shows some other position
  // than the pre-drop one (a teammate moved it), or the candle is gone. An
  // unrelated refresh that still carries the pre-drop position is stale, so the
  // override stays (bounded) instead of snapping the candle back.
  const prevEventsRef = useRef(events);
  useEffect(() => {
    if (events !== prevEventsRef.current) {
      prevEventsRef.current = events;
      setOptimisticOverrides((prev) => {
        if (!prev.size) return prev;
        const incoming = new Map(events.map((e) => [e.id, e]));
        const now = Date.now();
        const kept = new Map(
          [...prev].filter(([id, ov]) => {
            if (inFlightRef.current.has(id)) return true; // mid-request
            const inc = incoming.get(id);
            if (!inc) return false;
            if (inc.start.getTime() === ov.start.getTime() && inc.end.getTime() === ov.end.getTime()) {
              return false; // server caught up
            }
            const origin = originRef.current.get(id);
            return (
              !!origin &&
              now - origin.at < OVERRIDE_MAX_HOLD_MS &&
              inc.start.getTime() === origin.start &&
              inc.end.getTime() === origin.end
            );
          })
        );
        return kept.size === prev.size ? prev : kept;
      });
    }
  }, [events]);

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

  const handleSelectEvent = useCallback((ev: CalendarEvent) => {
    if (ev.kind === "inquiry" && ev.inquiryId) {
      // Client path (pushState + react-query detail read), same as the table.
      onOpenInquiry?.(ev.inquiryId);
      return;
    }
    // Booking candle: BookingUrlModals mounts on ?detail, no RSC round-trip.
    setUrlParams((p) => {
      p.set("view", "calendar");
      p.set("detail", ev.bookingId);
      p.delete("inquiryId");
    });
  }, [onOpenInquiry]);

  /**
   * Shared handler for onEventDrop and onEventResize on New inquiry candles.
   * Optimistically moves the candle, sends an abortable request, reverts on error.
   */
  const handleInquiryDrop = useCallback(
    async ({ event: anyEvent, start, end, isAllDay }: EventInteractionArgs<AnyCalendarEvent>) => {
      // Overflow sentinel events are never draggable but guard defensively.
      if ("type" in anyEvent && (anyEvent as { type: string }).type === "overflow") return;
      const ev = anyEvent as CalendarEvent;
      if (ev.kind !== "inquiry" || !ev.inquiryId) return;

      const sessionKey = ev.id;
        const tz = workspaceTz ?? FALLBACK_TZ;
        const newStart = new Date(start);
        const newEnd = new Date(end);

        // Month-view drags: rbc sets start to midnight of the target day.
        // Preserve the session shift times and shift date only.
        const isDateOnlyDrag = isAllDay ?? false;

        let candleStart: Date;
        let candleEnd: Date;

        if (isDateOnlyDrag) {
          const targetDay = dateToTzWallClock(newStart, tz).date;
          const [startHour, startMinute] = dateToTzWallClock(ev.start, tz).time.split(":").map(Number);
          const [endHour, endMinute] = dateToTzWallClock(ev.end, tz).time.split(":").map(Number);
          candleStart = dayBoundInTz(targetDay, tz, startHour, startMinute, 0, 0);
          candleEnd = dayBoundInTz(targetDay, tz, endHour, endMinute, 0, 0);
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
        const optimisticEvent: CalendarEvent = {
          ...ev,
          start: candleStart,
          end: candleEnd,
          sessionStartAt: candleStart,
          sessionEndAt: candleEnd,
        };
        if (!originRef.current.has(ev.id) || !inFlightRef.current.has(ev.id)) {
          originRef.current.set(ev.id, { start: ev.start.getTime(), end: ev.end.getTime(), at: Date.now() });
        }
        setOptimisticOverrides((prev) => new Map(prev).set(ev.id, optimisticEvent));
        inFlightRef.current.get(sessionKey)?.abort();
        const previousToastId = toastIdsRef.current.get(sessionKey);
        if (previousToastId !== undefined) toast.dismiss(previousToastId);
        const controller = new AbortController();
        inFlightRef.current.set(sessionKey, controller);
        const toastId = toast.loading(t("updating"));
        toastIdsRef.current.set(sessionKey, toastId);
        try {
          let expectedUpdatedAt = ev.updatedAt;
          for (let attempt = 0; attempt < 3; attempt++) {
            const response = await fetch("/api/app/inquiries/reschedule", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ inquiryId: ev.inquiryId, sessionIndex: ev.sessionIndex, startDate, startTime, endTime, expectedUpdatedAt }),
              signal: controller.signal,
            });
            const result = await response.json() as { draftBookingId?: string | null; error?: string; updatedAt?: string };
            if (controller.signal.aborted) return;
            if (result.error === "stale" && result.updatedAt && attempt < 2) {
              expectedUpdatedAt = result.updatedAt;
              continue;
            }
            if (!response.ok || result.error) throw result.error ?? "reschedule_failed";
            invalidateFor({ type: "inquiry.updated", inquiryId: ev.inquiryId, bookingId: result.draftBookingId ?? null });
            toast.success(t("updated"), { id: toastId });
            return;
          }
        } catch (err) {
          if (controller.signal.aborted) {
            toast.dismiss(toastId);
            return;
          }
          // The server copy is the safe rollback target. It may have changed
          // while the request was pending, so never restore a stale drag event.
          setOptimisticOverrides((prev) => {
            const next = new Map(prev);
            next.delete(ev.id);
            return next;
          });
          toast.error(err === "conflict" ? t("rescheduleConflict") : t("rescheduleFailed"), { id: toastId });
        } finally {
          if (inFlightRef.current.get(sessionKey) === controller) {
            inFlightRef.current.delete(sessionKey);
            toastIdsRef.current.delete(sessionKey);
          }
        }
    },
    [workspaceTz, t, invalidateFor]
  );

  const handleExternalDragStart = useCallback((ev: CalendarEvent) => {
    externalDragRef.current = isInquiryCandleDraggable(ev) ? ev : null;
  }, []);
  const handleExternalDragEnd = useCallback(() => {
    externalDragRef.current = null;
  }, []);
  const dragFromOutsideItem = useCallback(() => externalDragRef.current, []);
  const handleDropFromOutside = useCallback(async ({ start }: { start: string | Date }) => {
    const ev = externalDragRef.current;
    externalDragRef.current = null;
    if (!ev) return;
    const tz = workspaceTz ?? FALLBACK_TZ;
    const targetDay = dateToTzWallClock(new Date(start), tz).date;
    const targetMidnight = dayBoundInTz(targetDay, tz, 0, 0, 0, 0);
    await handleInquiryDrop({ event: ev, start: targetMidnight, end: targetMidnight, isAllDay: true } as EventInteractionArgs<AnyCalendarEvent>);
  }, [handleInquiryDrop, workspaceTz]);

  const chipClass = (active: boolean) =>
    cn(
      "inline-flex min-h-9 items-center gap-1.5 border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      active
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-card text-muted-foreground opacity-50"
    );

  const toolbarTrailing = useMemo(() => (
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
          style={{ background: "var(--event-inquiry)" }}
        />
        {t("filters.inquiry")}
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
          style={{ background: "var(--event-booked)" }}
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
          style={{ background: "var(--danger)" }}
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
  ), [showNew, showBooked, showConflicted, showTeamFilter, teams, selectedTeams, isOwner, t]);

  const calendarMessages = useMemo(
    () => ({
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
    }),
    [tCal]
  );

  return (
    // Keep the old candles up (dimmed) while a window refetch is in flight.
    <div
      aria-busy={windowPending}
      className={cn("transition-opacity", windowPending && "pointer-events-none opacity-60")}
    >
    <InquiriesCalendarLazy
      fallbackClassName={INQUIRIES_CALENDAR_FALLBACK}
      events={eventsWithConflicts}
      defaultDate={defaultDate ? wallDateAsLocal(defaultDate, workspaceTz ?? FALLBACK_TZ) : undefined}
      onVisibleChange={onVisibleChange}
      workspaceTimezone={workspaceTz}
      emptyMessage={windowPending ? undefined : t("emptyPeriod")}
      onSelectEvent={handleSelectEvent}
      onEventDrop={handleInquiryDrop}
      onEventResize={handleInquiryDrop}
      onExternalDragStart={handleExternalDragStart}
      onExternalDragEnd={handleExternalDragEnd}
      dragFromOutsideItem={dragFromOutsideItem}
      onDropFromOutside={handleDropFromOutside}
      showPast={true}
      draggableAccessor={isDraggableEvent}
      toolbarTrailing={toolbarTrailing}
      messages={calendarMessages}
    />
    </div>
  );
}
