"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  BookingCalendar,
  type CalendarEvent,
  type AnyCalendarEvent,
} from "./booking-calendar";
import { PastDateConfirmDialog } from "./past-date-confirm-dialog";
import { BookingWizardModal } from "./booking-wizard-modal";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { Views, type View } from "react-big-calendar";
import {
  type Session,
} from "@/lib/bookings/session-edits";
import {
  type ShiftHit,
  overlappingShifts,
  isoDate,
  isoDateInTz,
  dateToTzMinutes,
  reconstructSessions,
} from "./_helpers/calendar-helpers";
import { FALLBACK_TZ, dayBoundInTz } from "@/lib/utils/timezone";
import type { SupportedCurrency } from "@/lib/validators/workspace";

export type ClientHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Props = {
  events: CalendarEvent[];
  defaultDate?: Date;
  messages: React.ComponentProps<typeof BookingCalendar>["messages"];
  initialClients?: ClientHit[];
  defaultCurrency?: SupportedCurrency;
  locale?: string;
  workspaceTimezone?: string;
  /**
   * Incrementing nonce from a parent toolbar's "New Booking" button. When this
   * changes, CalendarView opens a fresh add modal — decoupled from URL so the
   * button always fires even when ?add=1 is already set.
   */
  externalAddNonce?: number;
};

type PendingPastConfirm = {
  event: CalendarEvent;
  newSessionStart: Date;
  newSessionEnd: Date;
  bookingSessions: Session[];
  touchedDay: Date;
};

/**
 * Fetch shifts on a date, excluding the specific session being dragged via its
 * shift key (`<bookingId>:<sessionIndex>`). Using excludeShiftKey (per-session
 * exclusion) means sibling sessions of the same booking CAN trigger a conflict
 * when the user drags one candle onto the exact time slot another session of
 * the same booking already occupies — which is the correct behaviour.
 *
 * Returns null on non-2xx response or network error — callers must treat
 * null as "check unavailable" and abort the operation.
 */
async function fetchConflicts(
  dateStr: string,
  bookingId: string,
  sessionIndex: number
): Promise<ShiftHit[] | null> {
  try {
    const shiftKey = `${bookingId}:${sessionIndex}`;
    const r = await fetch(
      `/api/bookings/shifts-on-date?date=${dateStr}&excludeShiftKey=${encodeURIComponent(shiftKey)}`
    );
    if (!r.ok) {
      console.error("[fetchConflicts] non-ok response", { status: r.status, dateStr });
      return null;
    }
    const data: { shifts: ShiftHit[] } = await r.json();
    return data.shifts ?? [];
  } catch (err) {
    console.error("[fetchConflicts] request failed", { dateStr, err });
    return null;
  }
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * PATCH `/api/bookings/{id}` with the full sessions array.
 * Returns true on success, false on failure.
 */
async function patchBookingSessions(
  bookingId: string,
  sessions: Session[]
): Promise<boolean> {
  const body = sessions.map((s) => ({
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
  }));
  const res = await fetch(`/api/bookings/${bookingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessions: body }),
  });
  return res.ok;
}

export function CalendarView({
  events,
  defaultDate,
  messages,
  initialClients,
  defaultCurrency = "PHP",
  locale = "en",
  workspaceTimezone,
  externalAddNonce,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.dnd");

  const [, startTransition] = useTransition();

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
    if (spAdd === "1") {
      setAddState({ date: spDate, time: spTime, nonce: 0 });
    } else if (spEdit) {
      setEditState({ bookingId: spEdit });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Respond to the toolbar's "New Booking" button via an incrementing nonce.
  // Skip nonce=0 (initial mount value — the URL-seed effect above handles that).
  const prevExternalNonceRef = useRef(0);
  useEffect(() => {
    if (!externalAddNonce || externalAddNonce === prevExternalNonceRef.current) return;
    prevExternalNonceRef.current = externalAddNonce;
    setAddState((prev) => ({
      date: "",
      time: undefined,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  }, [externalAddNonce]);

  // Respond to URL-driven edit requests set by the BookingDetailModal's
  // "Edit all" button. The detail modal sets ?edit=<id> to hand off to the
  // wizard; we mirror that into local editState.
  useEffect(() => {
    const spEdit = searchParams.get("edit");
    if (spEdit && (!editState || editState.bookingId !== spEdit)) {
      setEditState({ bookingId: spEdit });
    } else if (!spEdit && editState) {
      // URL cleared externally (e.g. browser back) — close the wizard.
      setEditState(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("edit")]);

  const [clients, setClients] = useState<ClientHit[]>(initialClients ?? []);

  const refetchClients = useCallback(async () => {
    const r = await fetch("/api/clients?limit=1000");
    if (r.ok) {
      const data = await r.json();
      setClients(Array.isArray(data) ? data : (data.clients ?? []));
    }
  }, []);

  // If no initial clients were server-rendered, fetch on mount.
  useEffect(() => {
    if (!initialClients) {
      refetchClients();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [optimisticEvents, setOptimisticEvents] =
    useState<CalendarEvent[]>(events);

  const [pendingPastConfirm, setPendingPastConfirm] =
    useState<PendingPastConfirm | null>(null);
  // Incrementing this key forces BookingCalendar to remount, flushing rbc's
  // internal optimistic drag state when the user cancels. The user's current
  // view + visible date are held HERE so the remount doesn't reset them.
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState<Date>(defaultDate ?? new Date());
  const showPast = searchParams.get("showPast") === "1";

  // On mount: if the persisted/URL view is WEEK but the viewport is mobile
  // (< sm = 640px), snap to DAY so the hidden Week button doesn't leave the
  // user stranded on a view they can't switch away from via the toolbar.
  useEffect(() => {
    if (view !== Views.WEEK) return;
    const mq = window.matchMedia("(max-width: 639px)");
    if (mq.matches) setView(Views.DAY);
  // Only run on mount — view changes thereafter are intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const clearWizardParams = useCallback(
    (extra: string[] = []) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const k of ["add", "date", "time", "edit", ...extra]) params.delete(k);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  const openAddForDate = useCallback(
    (date: Date, time?: string) => {
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
    [router, pathname, searchParams]
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
          if (e.bookingId !== event.bookingId || e.id !== event.id) return e;
          return {
            ...e,
            start: newCandleStart,
            end: newCandleEnd,
            sessionStartAt: newCandleStart,
            sessionEndAt: newCandleEnd,
          };
        })
      );

      try {
        const ok = await patchBookingSessions(event.bookingId, newSessions);
        if (!ok) throw new Error("PATCH returned non-ok");
      } catch (err) {
        const errInfo =
          err instanceof Error
            ? { name: err.name, message: err.message, stack: err.stack }
            : String(err);
        console.error("[calendar-view] patchBookingSessions failed", {
          bookingId: event.bookingId,
          newSessions,
          err: errInfo,
        });
        setOptimisticEvents(prev);
        toast.error(t("updateError"));
      }
    },
    [optimisticEvents, t]
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
   *   4. Conflict check (single date only, overnight is rejected above).
   *   4b. Hard-block conflicting shifts with a toast.
   *   5. Apply.
   */
  const handleAnyDrop = useCallback(
    async (
      event: CalendarEvent,
      newRbcStart: Date,
      newRbcEnd: Date,
      isDateOnlyDrag: boolean,
      touchedDay: Date
    ) => {
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

      // 3. Past-date / past-time check. The same confirm dialog covers both —
      // dropping on a past calendar day OR dropping today at a time that has
      // already passed.
      //
      // Skip the modal entirely when the session being moved is ALREADY in the
      // past — the user has already accepted the past-ness of that event and
      // re-confirming on every intra-past drag is friction without benefit.
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
          setPendingPastConfirm({
            event,
            newSessionStart: newCandleStart,
            newSessionEnd: newCandleEnd,
            bookingSessions,
            touchedDay,
          });
          return;
        }
      }

      // 4. Conflict check — fetch shifts for the (single) date.
      const startDateStr = isoDateInTz(newCandleStart, tz);
      const aStart = dateToTzMinutes(newCandleStart, tz);
      const aEnd = dateToTzMinutes(newCandleEnd, tz);

      const allShifts = await fetchConflicts(startDateStr, event.bookingId, event.sessionIndex);
      if (allShifts === null) {
        toast.error(t("conflictCheckFailed"));
        return;
      }

      const conflicts = overlappingShifts(allShifts, aStart, aEnd);

      // 4b. Hard block — overlapping shifts are forbidden.
      if (conflicts.length > 0) {
        const first = conflicts[0];
        const more = conflicts.length - 1;
        toast.error(
          more > 0
            ? t("conflictBlockDndMany", { title: first.title, more })
            : t("conflictBlockDnd", { title: first.title })
        );
        return;
      }

      // 5. Apply.
      await applySplit(event, bookingSessions, touchedDay, newCandleStart, newCandleEnd);
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

  // ─── Past-date confirm handlers ───────────────────────────────────────────

  const handlePastCancel = useCallback(() => {
    setPendingPastConfirm(null);
    setRefreshKey((k) => k + 1);
  }, []);

  const handlePastConfirm = useCallback(async () => {
    if (!pendingPastConfirm) return;
    const { event, bookingSessions, touchedDay, newSessionStart, newSessionEnd } =
      pendingPastConfirm;
    setPendingPastConfirm(null);
    await applySplit(event, bookingSessions, touchedDay, newSessionStart, newSessionEnd);
  }, [pendingPastConfirm, applySplit]);

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

  return (
    <>
      <BookingCalendar
        key={refreshKey}
        events={visibleEvents}
        defaultDate={defaultDate}
        view={view}
        onViewChange={setView}
        date={date}
        onDateChange={setDate}
        onSelectEvent={openDetail}
        onSelectSlot={(d, time) => openAddForDate(d, time)}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        onExternalDragStart={handleExternalDragStart}
        onExternalDragEnd={handleExternalDragEnd}
        onDropFromOutside={handleDropFromOutside}
        dragFromOutsideItem={dragFromOutsideItem}
        messages={messages}
        showPast={showPast}
      />
      <PastDateConfirmDialog
        open={pendingPastConfirm !== null}
        onCancel={handlePastCancel}
        onConfirm={handlePastConfirm}
      />
      {addState ? (
        <BookingWizardModal
          key={`add-${addState.nonce}`}
          mode="create"
          defaultDate={addState.date || undefined}
          defaultTime={addState.time}
          defaultCurrency={defaultCurrency}
          locale={locale}
          workspaceTimezone={workspaceTimezone}
          clients={clients}
          onClientCreated={refetchClients}
          onClose={() => {
            setAddState(null);
            clearWizardParams();
          }}
        />
      ) : null}
      {editState ? (
        <BookingWizardModal
          key={`edit-${editState.bookingId}`}
          mode="edit"
          bookingId={editState.bookingId}
          defaultCurrency={defaultCurrency}
          locale={locale}
          workspaceTimezone={workspaceTimezone}
          clients={clients}
          onClientCreated={refetchClients}
          onClose={() => {
            setEditState(null);
            clearWizardParams();
          }}
        />
      ) : null}
    </>
  );
}
