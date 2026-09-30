"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import type {
  BookingCalendar,
  CalendarEvent,
  AnyCalendarEvent,
} from "./booking-calendar";
import { BookingCalendarLazy } from "./booking-calendar-dynamic";
import { TeamFilterControl } from "./team-filter-control";
import type { BookingTeamOption } from "../_data/team-options";
import { BookingWizardLazy } from "./booking-wizard-dynamic";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import type { View } from "react-big-calendar";
import {
  type Session,
} from "@/lib/bookings/session-edits";
import {
  type ShiftHit,
  isoDate,
  isoDateInTz,
  reconstructSessions,
  detectConflictIds,
} from "./_helpers/calendar-helpers";
import { buildBookingCalendarEvents, type BookingEventInput } from "@/lib/bookings/build-booking-events";
import { useInvalidateFor } from "@/hooks/use-data-events";
import { FALLBACK_TZ, dayBoundInTz } from "@/lib/utils/timezone";
import { isRangeInsideWindow, visibleGridRange } from "@/lib/bookings/calendar-window";
import { useCalendarWindowNav } from "./_helpers/use-calendar-window-nav";
import type { SupportedCurrency } from "@/lib/validators/workspace";

type Props = {
  events: CalendarEvent[];
  defaultDate?: Date;
  messages: React.ComponentProps<typeof BookingCalendar>["messages"];
  defaultCurrency?: SupportedCurrency;
  locale?: string;
  workspaceTimezone?: string;
  /**
   * Incrementing nonce from a parent toolbar's "New Booking" button. When this
   * changes, CalendarView opens a fresh add modal — decoupled from URL so the
   * button always fires even when ?add=1 is already set.
   */
  externalAddNonce?: number;
  /** When false, slot clicks and toolbar nonce changes do NOT open the create
   *  wizard. Editing / viewing existing bookings is still available. */
  canCreate?: boolean;
  /** The Main team id to attach new bookings to. Passed through to the create
   *  wizard as teamId. */
  defaultTeamId?: string | null;
  /** "team" colors events by team; "status" (default) uses the status palette. */
  colorMode?: "status" | "team";
  /** Active-team id → hex color, passed through to BookingCalendar. */
  teamColorMap?: Record<string, string>;
  /** All teams visible to this user — used for the team legend. */
  teams?: BookingTeamOption[];
  /** Teams the user can write to — passed to the create wizard. */
  writableTeams?: BookingTeamOption[];
  /** Currently selected team ids. Empty = all teams. */
  selectedTeams?: string[];
  /** Whether the current user is a workspace owner. */
  isOwner?: boolean;
  /** ISO bounds of the candle window the server loaded around `?date`. */
  window: { start: string; end: string };
  /** Reports "window refetch in flight" so the shell can dim the grid. */
  onWindowPendingChange?: (pending: boolean) => void;
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

type PatchResult =
  | { kind: "ok"; booking: BookingEventInput & { clientId?: string | null; createdFromInquiryId?: string | null } }
  | { kind: "conflict"; conflicts: ShiftHit[] }
  | { kind: "error" };

/**
 * PATCH `/api/bookings/{id}` with the full sessions array in ONE request.
 * `rejectOnConflict` makes the server check overlaps and answer 409 (no write)
 * instead of the client pre-flighting shifts-on-date. A 409 is also used for
 * `completed_booking_read_only`, so branch on the `error` code.
 */
async function patchBookingSessions(bookingId: string, sessions: Session[]): Promise<PatchResult> {
  const body = sessions.map((s) => ({
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
  }));
  try {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessions: body, rejectOnConflict: true }),
    });
    if (res.ok) return { kind: "ok", booking: await res.json() };
    if (res.status === 409) {
      const data = (await res.json().catch(() => null)) as
        | { error?: string; conflicts?: ShiftHit[] }
        | null;
      if (data?.error === "conflict") {
        // The server may report the same shift more than once.
        const seen = new Set<string>();
        const conflicts = (data.conflicts ?? []).filter((c) => {
          const key = `${c.bookingId}:${c.sessionIndex}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return { kind: "conflict", conflicts };
      }
    }
  } catch (err) {
    console.error("[calendar-view] patchBookingSessions request failed", { bookingId, err });
  }
  return { kind: "error" };
}

// Stable default: a fresh `[]` per render would defeat the memoized toolbar below.
const NO_TEAMS: string[] = [];

export function CalendarView({
  events,
  defaultDate,
  messages,
  defaultCurrency = "PHP",
  locale = "en",
  workspaceTimezone,
  externalAddNonce,
  canCreate = true,
  defaultTeamId,
  colorMode = "status",
  teamColorMap,
  teams,
  writableTeams,
  selectedTeams = NO_TEAMS,
  isOwner = true,
  window: eventsWindow,
  onWindowPendingChange,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.dnd");
  const tCal = useTranslations("app.bookings.calendar");

  const [, startTransition] = useTransition();
  const invalidateFor = useInvalidateFor();

  // Local state for the add/edit wizard modals. Using local state (not URL)
  // ensures the modal always opens on click, even when the URL already contains
  // the relevant param — a URL push to the same URL is a no-op in Next.js.
  // The URL is updated as a side effect for shareability.
  type AddState = { date: string; time?: string; nonce: number } | null;
  type EditState = { bookingId: string } | null;
  const [addState, setAddState] = useState<AddState>(null);
  const [editState, setEditState] = useState<EditState>(null);

  // Seed from URL on mount — handles refreshes / shared links.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    const spAdd = searchParams.get("add");
    const spEdit = searchParams.get("edit");
    const spDate = searchParams.get("date") ?? "";
    const spTime = searchParams.get("time") ?? undefined;
    // Non-owners cannot create bookings — skip seeding the add modal from URL.
    if (spAdd === "1" && canCreate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seeds local modal state from URL on mount (external → React sync)
      setAddState({ date: spDate, time: spTime, nonce: 0 });
    } else if (spEdit) {
      setEditState({ bookingId: spEdit });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Respond to the toolbar's "New Booking" button via an incrementing nonce.
  // Skip nonce=0 (initial mount value — the URL-seed effect above handles that).
  // Non-owners cannot create bookings — ignore the nonce entirely.
  const prevExternalNonceRef = useRef(0);
  useEffect(() => {
    if (!canCreate) return;
    if (!externalAddNonce || externalAddNonce === prevExternalNonceRef.current) return;
    prevExternalNonceRef.current = externalAddNonce;
    setAddState((prev) => ({
      date: "",
      time: undefined,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  }, [canCreate, externalAddNonce]);

  // Respond to URL-driven edit requests set by the BookingDetailModal's
  // "Edit all" button. The detail modal sets ?edit=<id> to hand off to the
  // wizard; we mirror that into local editState.
  useEffect(() => {
    const spEdit = searchParams.get("edit");
    if (spEdit && (!editState || editState.bookingId !== spEdit)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirrors URL ?edit= param into local modal state (external → React sync)
      setEditState({ bookingId: spEdit });
    } else if (!spEdit && editState) {
      // URL cleared externally (e.g. browser back) — close the wizard.
      setEditState(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("edit")]);

  const [optimisticEvents, setOptimisticEvents] =
    useState<CalendarEvent[]>(events);

  // Tracks booking IDs that have an in-flight PATCH. While a booking is pending
  // the calendar dims the event via eventPropGetter and pointer-events:none so
  // the user cannot drag the same event again mid-flight.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Synchronous re-drag lock. pendingIds (state) only updates after applySplit
  // runs — i.e. after the async conflict-check round-trip — so a rapid second
  // drag could slip past a state-based guard during that window. This ref is
  // claimed before any await and released in handleAnyDrop's finally, closing
  // that gap. pendingIds remains the source of truth for the visual dim.
  const inFlightRef = useRef<Set<string>>(new Set());

  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState<Date>(defaultDate ?? new Date());

  // Candles exist only inside the server window; leaving it refetches via ?date.
  const { onVisibleChange, isPending: windowPending } = useCalendarWindowNav({
    window: eventsWindow,
    tz: workspaceTimezone || FALLBACK_TZ,
  });
  useEffect(() => {
    onWindowPendingChange?.(windowPending);
  }, [windowPending, onWindowPendingChange]);

  // Follow ?date when it moves the calendar somewhere the user isn't looking
  // (browser back/forward). Our own replace / slot clicks land inside the
  // visible grid, so they never yank the view.
  const urlDateKey = defaultDate
    ? `${defaultDate.getFullYear()}-${defaultDate.getMonth()}-${defaultDate.getDate()}`
    : null;
  const [syncedUrlDateKey, setSyncedUrlDateKey] = useState(urlDateKey);
  if (urlDateKey !== syncedUrlDateKey) {
    setSyncedUrlDateKey(urlDateKey);
    if (defaultDate) {
      const tzForRange = workspaceTimezone || FALLBACK_TZ;
      const shown = visibleGridRange(date, view, tzForRange);
      const target = visibleGridRange(defaultDate, "day", tzForRange);
      if (!isRangeInsideWindow(target, shown)) setDate(defaultDate);
    }
  }
  // Opt-out convention (see parseBookingsToggleFilters): absent -> ON.
  const showPast = searchParams.get("showPast") !== "0";

  // Keep optimistic state in sync when the server provides new events.
  const prevEventsRef = useRef(events);
  useEffect(() => {
    if (events !== prevEventsRef.current) {
      prevEventsRef.current = events;
      setOptimisticEvents(events);
    }
  }, [events]);

  // Tracks the CalendarEvent currently being dragged out of the overflow popover.
  const externalDragRef = useRef<CalendarEvent | null>(null);

  const openDetailById = useCallback(
    (bookingId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("detail", bookingId);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const openDetail = useCallback(
    (event: CalendarEvent) => {
      openDetailById(event.bookingId);
    },
    [openDetailById]
  );

  // Keeps `date` (the window anchor): dropping it would snap the page back to
  // today's window. Wizard params are not server data, so a history-only replace
  // avoids an RSC round-trip (Next syncs useSearchParams with the History API).
  const clearWizardParams = useCallback((extra: string[] = []) => {
    const params = new URLSearchParams(window.location.search);
    for (const k of ["add", "time", "edit", ...extra]) params.delete(k);
    const qs = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    );
  }, []);

  const openAddForDate = useCallback(
    (date: Date, time?: string) => {
      // Non-owners cannot create bookings — slot clicks are view-only for them.
      if (!canCreate) return;
      // Always open the modal directly (no URL round-trip that may no-op).
      setAddState((prev) => ({
        date: isoDate(date),
        time,
        nonce: (prev?.nonce ?? 0) + 1,
      }));
      // Side-effect: update URL for shareability.
      const params = new URLSearchParams(searchParams.toString());
      params.set("add", "1");
      params.set("date", isoDate(date));
      if (time) params.set("time", time);
      else params.delete("time");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [canCreate, router, pathname, searchParams]
  );

  // ─── Core session apply ───────────────────────────────────────────────────

  /**
   * Replace one session (identified by sessionIndex) with the new candle
   * times and PATCH the server. Bookings can no longer span midnight, so
   * there is no overnight/bled branching here — the new times always live
   * on a single calendar day.
   */
  const applySplit = useCallback(
    async (
      event: CalendarEvent,
      bookingSessions: Session[],
      _touchedDay: Date,
      newCandleStart: Date,
      newCandleEnd: Date
    ) => {
      const prev = optimisticEvents;

      const newSession: Session = { startAt: newCandleStart, endAt: newCandleEnd };
      const newSessions = bookingSessions.map((s, idx) =>
        idx === event.sessionIndex ? newSession : s
      );

      setOptimisticEvents(
        optimisticEvents.map((e) => {
          if (e.bookingId !== event.bookingId || e.sessionIndex !== event.sessionIndex) return e;
          return {
            ...e,
            start: newCandleStart,
            end: newCandleEnd,
            sessionStartAt: newCandleStart,
            sessionEndAt: newCandleEnd,
          };
        })
      );

      setPendingIds((s) => new Set(s).add(event.bookingId));
      // Own the request promise so the pending/in-flight guards outlive the
      // whole round-trip (toast.promise's return value is not awaitable).
      const request = patchBookingSessions(event.bookingId, newSessions).then((result) => {
        if (result.kind === "ok") return result.booking;
        throw result;
      });
      toast.promise(request, {
        loading: t("updating"),
        success: t("updated"),
        error: (err: unknown) => {
          setOptimisticEvents(prev);
          const failure = err as PatchResult;
          if (failure?.kind === "conflict" && failure.conflicts.length > 0) {
            const first = failure.conflicts[0];
            const more = failure.conflicts.length - 1;
            return more > 0
              ? t("conflictBlockDndMany", { title: first.title, more })
              : t("conflictBlockDnd", { title: first.title });
          }
          console.error("[calendar-view] patchBookingSessions failed", {
            bookingId: event.bookingId,
            newSessions,
          });
          return t("updateError");
        },
      });
      try {
        const booking = await request;
        // Authoritative candles for this booking replace the optimistic guess;
        // the events-prop resync then reconciles once the refresh lands.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rebuilt = buildBookingCalendarEvents([booking], {
          today,
          tz: workspaceTimezone || FALLBACK_TZ,
        });
        setOptimisticEvents((cur) => [
          ...cur.filter((e) => e.bookingId !== event.bookingId),
          ...rebuilt,
        ]);
        // Ids mirror the server broadcast so the socket echo is suppressed.
        invalidateFor({
          type: "booking.updated",
          bookingId: event.bookingId,
          clientId: booking.clientId ?? null,
          inquiryId: booking.createdFromInquiryId ?? null,
        });
      } catch {
        // Reverted + toasted in the toast.promise error callback.
      } finally {
        setPendingIds((s) => {
          const next = new Set(s);
          next.delete(event.bookingId);
          return next;
        });
      }
    },
    [optimisticEvents, t, workspaceTimezone, invalidateFor]
  );

  // ─── Universal drag handler ───────────────────────────────────────────────

  /**
   * Shared logic for drop, resize, and external-popover-drop.
   *
   * Steps:
   *   1. Compute newCandleStart / newCandleEnd from the rbc-provided times.
   *   2. Same-position no-op check.
   *   2b. Reject overnight moves — bookings cannot span midnight.
   *   3. Past-date check → PastDateConfirmDialog (skipped when the session's
   *      current startAt is already in the past — user already accepted it).
   *   4. Apply: ONE PATCH with rejectOnConflict; a 409 reverts + toasts.
   */
  const handleAnyDrop = useCallback(
    async (
      event: CalendarEvent,
      newRbcStart: Date,
      newRbcEnd: Date,
      isDateOnlyDrag: boolean,
      touchedDay: Date
    ) => {
      // Guard: ignore if a PATCH is already in flight for this booking. Claimed
      // synchronously (before any await) so a rapid second drag during the
      // conflict-check round-trip can't slip through; released in `finally`.
      if (inFlightRef.current.has(event.bookingId)) return;
      inFlightRef.current.add(event.bookingId);

      try {
        const tz = workspaceTimezone || FALLBACK_TZ;
        const bookingSessions = reconstructSessions(optimisticEvents, event.bookingId);

        // 1. Compute candle times.
        let newCandleStart: Date;
        let newCandleEnd: Date;

        if (isDateOnlyDrag) {
          const dayDiff = Math.round(
            (startOfDay(newRbcStart).getTime() - startOfDay(event.start).getTime()) /
              86_400_000
          );
          newCandleStart = new Date(event.start);
          newCandleStart.setDate(newCandleStart.getDate() + dayDiff);
          newCandleEnd = new Date(event.end);
          newCandleEnd.setDate(newCandleEnd.getDate() + dayDiff);
        } else {
          newCandleStart = newRbcStart;
          newCandleEnd = newRbcEnd;
        }

        // 2. Same-position no-op.
        if (
          newCandleStart.getTime() === event.start.getTime() &&
          newCandleEnd.getTime() === event.end.getTime()
        ) {
          return;
        }

        // 2b. Reject overnight moves — bookings cannot cross midnight.
        // The repeating-sessions form generates one same-day session per day, so
        // DnD must enforce the same invariant.
        const dragStartDateStr = isoDateInTz(newCandleStart, tz);
        const dragEndDateStr = isoDateInTz(newCandleEnd, tz);
        if (dragStartDateStr !== dragEndDateStr) {
          toast.error(t("overnightNotAllowed"));
          return;
        }

        // 3. Reject drops onto past dates / past times. Hard block — no override.
        //
        // Skip when the session being moved is ALREADY in the past — the user has
        // already accepted its pastness and re-blocking every intra-past drag is
        // friction without benefit.
        //
        // "Start of today" is derived in the workspace timezone so users in Manila
        // see the Manila calendar day boundary, not the server's/browser's UTC one.
        const todayDateStr = isoDateInTz(new Date(), tz);
        const startOfTodayInTz = dayBoundInTz(todayDateStr, tz, 0, 0, 0, 0);
        const sessionAlreadyPast = event.sessionStartAt < startOfTodayInTz;
        if (!sessionAlreadyPast) {
          const now = new Date();
          const droppedDateStr = isoDateInTz(newCandleStart, tz);
          const droppedDayStartInTz = dayBoundInTz(droppedDateStr, tz, 0, 0, 0, 0);
          const isPastDay = droppedDayStartInTz < startOfTodayInTz;
          const isPastTimeToday =
            droppedDateStr === todayDateStr && newCandleStart < now;
          if (isPastDay || isPastTimeToday) {
            toast.error(t("pastDropNotAllowed"));
            return;
          }
        }

        // 4. Apply (server-side conflict check via rejectOnConflict).
        await applySplit(event, bookingSessions, touchedDay, newCandleStart, newCandleEnd);
      } finally {
        inFlightRef.current.delete(event.bookingId);
      }
    },
    [optimisticEvents, applySplit, workspaceTimezone, t]
  );

  // ─── Drop handler ─────────────────────────────────────────────────────────

  const handleEventDrop = useCallback(
    async ({ event: anyEvent, start, end }: EventInteractionArgs<AnyCalendarEvent>) => {
      if ("type" in anyEvent && anyEvent.type === "overflow") return;
      const event = anyEvent as CalendarEvent;
      const newStart = new Date(start);
      const newEnd = new Date(end);

      // Month-view drags: rbc sets start to midnight of the target day.
      // In that case preserve the session's shift times and shift dates only.
      const newStartIsMidnight =
        newStart.getHours() === 0 && newStart.getMinutes() === 0;
      const eventHasTime =
        event.start.getHours() !== 0 || event.start.getMinutes() !== 0;
      const isDateOnlyDrag = newStartIsMidnight && eventHasTime;

      await handleAnyDrop(
        event,
        newStart,
        newEnd,
        isDateOnlyDrag,
        startOfDay(event.start)
      );
    },
    [handleAnyDrop]
  );

  // ─── Resize handler ───────────────────────────────────────────────────────

  const handleEventResize = useCallback(
    async ({ event: anyEvent, start, end }: EventInteractionArgs<AnyCalendarEvent>) => {
      if ("type" in anyEvent && anyEvent.type === "overflow") return;
      const event = anyEvent as CalendarEvent;
      const newStart = new Date(start);
      const newEnd = new Date(end);

      // Resize is always time-based (never a date-only drag).
      await handleAnyDrop(
        event,
        newStart,
        newEnd,
        false,
        startOfDay(event.start)
      );
    },
    [handleAnyDrop]
  );

  // ─── External drag (overflow popover → calendar) ──────────────────────────

  const handleExternalDragStart = useCallback((event: CalendarEvent) => {
    externalDragRef.current = event;
  }, []);

  const handleExternalDragEnd = useCallback(() => {
    externalDragRef.current = null;
  }, []);

  // Always return null. We rely on the HTML5 drag image (a candle, built in
  // OverflowPopoverRow.onDragStart) for visual feedback at the cursor — rbc's
  // in-cell preview is more trouble than it's worth here.
  const dragFromOutsideItem = useCallback((): AnyCalendarEvent | null => {
    return null;
  }, []);

  /**
   * Called by rbc when the user drops an externally-dragged event onto a
   * calendar cell. External drops from the overflow popover always land in
   * month view — treat as a date-only drag.
   */
  const handleDropFromOutside = useCallback(
    async ({ start }: { start: string | Date; end: string | Date; allDay: boolean }) => {
      const event = externalDragRef.current;
      externalDragRef.current = null;
      if (!event) return;

      const newStart = new Date(start);

      await handleAnyDrop(
        event,
        newStart,
        newStart,
        true,
        startOfDay(event.start)
      );
    },
    [handleAnyDrop]
  );

  const tz = workspaceTimezone || FALLBACK_TZ;
  const todayDateStr = isoDateInTz(new Date(), tz);
  const startOfTodayInTz = dayBoundInTz(todayDateStr, tz, 0, 0, 0, 0);

  // Filter at the per-candle level using e.end (the candle's own end time).
  // For single-day sessions e.end === e.sessionEndAt, so behaviour is unchanged.
  // For legacy multi-day sessions each per-day candle's end reflects its own
  // day's boundary, so Monday's candle is correctly hidden even when the session
  // runs through Friday. Using sessionEndAt would keep every past candle visible
  // as long as the session's final day is in the future.
  //
  // Cache todayMs as a number so useMemo deps are stable across renders
  // (startOfTodayInTz is a new Date object every render, but its numeric value
  // only changes once per day, so we compare the underlying number).
  const startOfTodayMs = startOfTodayInTz.getTime();
  const visibleEvents = useMemo(() => {
    if (showPast) return optimisticEvents;
    return optimisticEvents.filter((e) => e.end.getTime() >= startOfTodayMs);
  }, [optimisticEvents, showPast, startOfTodayMs]);

  const eventsWithConflicts = useMemo(() => {
    const conflictIds = detectConflictIds(visibleEvents);
    if (conflictIds.size === 0) return visibleEvents;
    return visibleEvents.map((e) => conflictIds.has(e.id) ? { ...e, hasConflict: true } : e);
  }, [visibleEvents]);

  // Team filter (calendar's clickable legend, counterpart to the table's team
  // dropdown). Pushes ?team; "all" clears it. Status filtering now lives in the
  // toolbar status dropdown (?status) for both views — the status legend retired.
  const setTeamFilter = useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.length === 0) params.delete("team");
      else params.set("team", next.join(","));
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [router, pathname, searchParams]
  );

  const toolbarTrailing = useMemo(
    () =>
      teams && teams.length > 1 ? (
        <TeamFilterControl
          teams={teams}
          selected={selectedTeams}
          isOwner={isOwner}
          onChange={setTeamFilter}
        />
      ) : undefined,
    [teams, selectedTeams, isOwner, setTeamFilter]
  );

  return (
    <>
      <BookingCalendarLazy
        events={eventsWithConflicts}
        defaultDate={defaultDate}
        view={view}
        onViewChange={setView}
        date={date}
        onDateChange={setDate}
        onVisibleChange={onVisibleChange}
        emptyMessage={windowPending ? undefined : tCal("emptyPeriod")}
        onSelectEvent={openDetail}
        onSelectSlot={openAddForDate}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        onExternalDragStart={handleExternalDragStart}
        onExternalDragEnd={handleExternalDragEnd}
        onDropFromOutside={handleDropFromOutside}
        dragFromOutsideItem={dragFromOutsideItem}
        pendingIds={pendingIds}
        messages={messages}
        showPast={showPast}
        colorMode={colorMode}
        teamColorMap={teamColorMap}
        toolbarTrailing={toolbarTrailing}
      />
      {addState ? (
        <BookingWizardLazy
          key={`add-${addState.nonce}`}
          mode="create"
          defaultDate={addState.date || undefined}
          defaultTime={addState.time}
          defaultCurrency={defaultCurrency}
          locale={locale}
          workspaceTimezone={workspaceTimezone}
          teamId={defaultTeamId ?? undefined}
          teams={writableTeams}
          onClose={() => {
            setAddState(null);
            clearWizardParams();
          }}
        />
      ) : null}
      {editState ? (
        <BookingWizardLazy
          key={`edit-${editState.bookingId}`}
          mode="edit"
          bookingId={editState.bookingId}
          defaultCurrency={defaultCurrency}
          locale={locale}
          workspaceTimezone={workspaceTimezone}
          onClose={() => {
            setEditState(null);
            clearWizardParams();
          }}
        />
      ) : null}
    </>
  );
}
