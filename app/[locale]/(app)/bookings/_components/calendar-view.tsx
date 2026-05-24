"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  BookingCalendar,
  type CalendarEvent,
} from "./booking-calendar";
import { SessionEditConfirmDialog } from "./session-edit-confirm-dialog";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import {
  type Session,
  splitDayOut,
  shiftSession,
  shiftSessionTimes,
} from "@/lib/bookings/session-edits";

type Props = {
  events: CalendarEvent[];
  defaultDate?: Date;
  messages: React.ComponentProps<typeof BookingCalendar>["messages"];
};

/**
 * Describes a drop or resize that is awaiting user confirmation.
 *
 * `bookingSessions` is reconstructed in-memory from optimisticEvents (Option B)
 * to avoid a round-trip fetch just to read the sessions array. The tradeoff: if
 * the user drags again before the previous PATCH lands, the sessions count may
 * be slightly stale. Acceptable for MVP — a comment flags this below.
 */
type PendingEdit = {
  event: CalendarEvent;
  newStart: Date;
  newEnd: Date;
  kind: "drop" | "resize";
  /** The full sessions array for this booking, reconstructed from optimistic state. */
  bookingSessions: Session[];
  /** Day the user dragged from (for splitDayOut). For drop = event.start's calendar day. */
  touchedDay: Date;
  /** Precomputed shift for drop edits: newSessionStart - event.sessionStartAt. */
  shiftMs: number;
  /** For drop: the fully-resolved new session start/end (date + time). */
  newSessionStart: Date;
  newSessionEnd: Date;
  /** True when this was a month-view date-only drag (no time change). */
  isDateOnlyDrag: boolean;
} | null;

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Reconstruct the full ordered sessions array for a given booking from the
 * current optimistic events state. Candles share sessionIndex, sessionStartAt,
 * sessionEndAt within each session group — we deduplicate by sessionIndex and
 * sort ascending.
 *
 * Option B: in-memory reconstruction, no fetch required.
 *
 * Caveat (MVP): if a PATCH is in-flight when the user starts another drag, the
 * reconstructed sessions may not yet reflect the previous save. The candle's
 * sessionDayCount will also be stale in that window, which could show the
 * wrong prompt. Acceptable — rare race, and the worst outcome is showing the
 * dialog for a single-day session (harmless extra click).
 */
function reconstructSessions(
  optimisticEvents: CalendarEvent[],
  bookingId: string
): Session[] {
  const byIndex = new Map<number, Session>();
  for (const e of optimisticEvents) {
    if (e.bookingId !== bookingId) continue;
    if (!byIndex.has(e.sessionIndex)) {
      byIndex.set(e.sessionIndex, {
        startAt: e.sessionStartAt,
        endAt: e.sessionEndAt,
      });
    }
  }
  return Array.from(byIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([, s]) => s);
}

/**
 * After computing new sessions for a booking, produce an updated optimistic
 * candle list. Strategy: in-place shift of candle start/end times for the
 * affected session index. We do NOT attempt to regenerate sessionDayCount or
 * sessionPastDayCount client-side — those will correct themselves when the
 * server-rendered events prop updates after the PATCH. This is intentionally
 * pragmatic: a second drag before the server responds may show a stale prompt.
 */
function applyOptimisticCandleShift(
  optimisticEvents: CalendarEvent[],
  event: CalendarEvent,
  newSessionStart: Date,
  newSessionEnd: Date,
  isDateOnlyDrag: boolean,
  dragStart: Date
): CalendarEvent[] {
  const dayDiff = isDateOnlyDrag
    ? Math.round(
        (startOfDay(newSessionStart).getTime() -
          startOfDay(event.sessionStartAt).getTime()) /
          86_400_000
      )
    : 0;
  const shift = isDateOnlyDrag ? 0 : newSessionStart.getTime() - event.sessionStartAt.getTime();

  return optimisticEvents.map((e) => {
    if (e.bookingId !== event.bookingId || e.sessionIndex !== event.sessionIndex) return e;
    const newCandleStart = isDateOnlyDrag
      ? (() => {
          const s = new Date(e.start);
          s.setDate(s.getDate() + dayDiff);
          return s;
        })()
      : new Date(e.start.getTime() + (event.start.getTime() === dragStart.getTime() ? shift : shift));
    const newCandleEnd = isDateOnlyDrag
      ? (() => {
          const s = new Date(e.end);
          s.setDate(s.getDate() + dayDiff);
          return s;
        })()
      : new Date(e.end.getTime() + shift);
    return {
      ...e,
      start: newCandleStart,
      end: newCandleEnd,
      sessionStartAt: newSessionStart,
      sessionEndAt: newSessionEnd,
    };
  });
}

/**
 * Optimistic update for a resize: apply new times to all candles of the
 * affected session.
 */
function applyOptimisticCandleResize(
  optimisticEvents: CalendarEvent[],
  event: CalendarEvent,
  newSessionStart: Date,
  newSessionEnd: Date
): CalendarEvent[] {
  return optimisticEvents.map((e) => {
    if (e.bookingId !== event.bookingId || e.sessionIndex !== event.sessionIndex) return e;
    const newCandleStart = new Date(e.start);
    newCandleStart.setHours(newSessionStart.getHours(), newSessionStart.getMinutes(), 0, 0);
    const newCandleEnd = new Date(e.end);
    newCandleEnd.setHours(newSessionEnd.getHours(), newSessionEnd.getMinutes(), 0, 0);
    return {
      ...e,
      start: newCandleStart,
      end: newCandleEnd,
      sessionStartAt: newSessionStart,
      sessionEndAt: newSessionEnd,
    };
  });
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

export function CalendarView({ events, defaultDate, messages }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.dnd");

  const [optimisticEvents, setOptimisticEvents] =
    useState<CalendarEvent[]>(events);

  const [pendingEdit, setPendingEdit] = useState<PendingEdit>(null);
  const [savingDnd, setSavingDnd] = useState(false);

  // Keep optimistic state in sync when the server provides new events (e.g.
  // after navigation or after the wizard creates/edits a booking).
  const prevEventsRef = useRef(events);
  useEffect(() => {
    if (events !== prevEventsRef.current) {
      prevEventsRef.current = events;
      setOptimisticEvents(events);
    }
  }, [events]);

  const openDetail = useCallback(
    (event: CalendarEvent) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("detail", event.bookingId);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const openAddForDate = useCallback(
    (date: Date, time?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("add", "1");
      params.set("date", isoDate(date));
      if (time) params.set("time", time);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  // ─── Shared save logic ────────────────────────────────────────────────────

  /**
   * Apply optimistic update + PATCH for a drop edit.
   * Works for both single-day fast-path and confirmed multi-day edits.
   */
  const applyDropSave = useCallback(
    async (
      event: CalendarEvent,
      bookingSessions: Session[],
      newSessionStart: Date,
      newSessionEnd: Date,
      isDateOnlyDrag: boolean,
      dragStart: Date,
      shiftedSessions: Session[],
      splitHappened: boolean
    ) => {
      const prev = optimisticEvents;

      const newSessions = bookingSessions.flatMap((s, idx) =>
        idx === event.sessionIndex ? shiftedSessions : [s]
      );

      // Optimistic update: shift candle positions in-place.
      setOptimisticEvents(
        applyOptimisticCandleShift(
          prev,
          event,
          newSessionStart,
          newSessionEnd,
          isDateOnlyDrag,
          dragStart
        )
      );

      const today = startOfDay(new Date());
      if (newSessionStart < today) {
        toast.warning(t("pastDateWarning"));
      } else if (splitHappened) {
        // Past portion was preserved; future was shifted.
        toast.warning(t("pastSplitWarning"));
      }

      try {
        const ok = await patchBookingSessions(event.bookingId, newSessions);
        if (!ok) throw new Error();
      } catch {
        setOptimisticEvents(prev);
        toast.error(t("updateError"));
      }
    },
    [optimisticEvents, t]
  );

  /**
   * Apply optimistic update + PATCH for a resize edit.
   */
  const applyResizeSave = useCallback(
    async (
      event: CalendarEvent,
      bookingSessions: Session[],
      newSessionStart: Date,
      newSessionEnd: Date,
      shiftedSessions: Session[],
      splitHappened: boolean
    ) => {
      const prev = optimisticEvents;

      const newSessions = bookingSessions.flatMap((s, idx) =>
        idx === event.sessionIndex ? shiftedSessions : [s]
      );

      setOptimisticEvents(
        applyOptimisticCandleResize(prev, event, newSessionStart, newSessionEnd)
      );

      if (splitHappened) {
        toast.warning(t("pastSplitWarning"));
      }

      try {
        const ok = await patchBookingSessions(event.bookingId, newSessions);
        if (!ok) throw new Error();
      } catch {
        setOptimisticEvents(prev);
        toast.error(t("updateError"));
      }
    },
    [optimisticEvents, t]
  );

  // ─── Drop handler ─────────────────────────────────────────────────────────

  const handleEventDrop = useCallback(
    async ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
      const newStart = new Date(start);
      const newEnd = new Date(end);

      // Month-view drags: rbc sets start to midnight of the target day.
      // In that case preserve the session's shift times and shift dates only.
      const newStartIsMidnight =
        newStart.getHours() === 0 && newStart.getMinutes() === 0;
      const eventHasTime =
        event.start.getHours() !== 0 || event.start.getMinutes() !== 0;
      const isDateOnlyDrag = newStartIsMidnight && eventHasTime;

      let newSessionStart: Date;
      let newSessionEnd: Date;
      let shiftMs: number;

      if (isDateOnlyDrag) {
        const dayDiff = Math.round(
          (startOfDay(newStart).getTime() - startOfDay(event.start).getTime()) /
            86_400_000
        );
        newSessionStart = new Date(event.sessionStartAt);
        newSessionStart.setDate(newSessionStart.getDate() + dayDiff);
        newSessionEnd = new Date(event.sessionEndAt);
        newSessionEnd.setDate(newSessionEnd.getDate() + dayDiff);
        shiftMs = dayDiff * 86_400_000;
      } else {
        shiftMs = newStart.getTime() - event.start.getTime();
        newSessionStart = new Date(event.sessionStartAt.getTime() + shiftMs);
        newSessionEnd = new Date(event.sessionEndAt.getTime() + shiftMs);
      }

      const bookingSessions = reconstructSessions(optimisticEvents, event.bookingId);

      // Single-day session: fast path — no dialog.
      if (event.sessionDayCount === 1) {
        const today = new Date();
        const shifted = shiftSession(
          { startAt: event.sessionStartAt, endAt: event.sessionEndAt },
          shiftMs,
          today
        );
        const splitHappened = shifted.length > 1;

        await applyDropSave(
          event,
          bookingSessions,
          newSessionStart,
          newSessionEnd,
          isDateOnlyDrag,
          newStart,
          shifted,
          splitHappened
        );
        return;
      }

      // Multi-day session: defer to the confirmation dialog.
      setPendingEdit({
        event,
        newStart,
        newEnd,
        kind: "drop",
        bookingSessions,
        touchedDay: startOfDay(event.start),
        shiftMs,
        newSessionStart,
        newSessionEnd,
        isDateOnlyDrag,
      });
    },
    [optimisticEvents, applyDropSave]
  );

  // ─── Resize handler ───────────────────────────────────────────────────────

  const handleEventResize = useCallback(
    async ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
      const newStart = new Date(start);
      const newEnd = new Date(end);

      // Resize adjusts shift times on the session endpoints.
      const newSessionStart = new Date(event.sessionStartAt);
      if (newStart.getTime() !== event.start.getTime()) {
        newSessionStart.setHours(newStart.getHours(), newStart.getMinutes(), 0, 0);
      }
      const newSessionEnd = new Date(event.sessionEndAt);
      newSessionEnd.setHours(newEnd.getHours(), newEnd.getMinutes(), 0, 0);

      const bookingSessions = reconstructSessions(optimisticEvents, event.bookingId);

      // Single-day session: fast path — apply immediately.
      if (event.sessionDayCount === 1) {
        const today = new Date();
        const shifted = shiftSessionTimes(
          { startAt: event.sessionStartAt, endAt: event.sessionEndAt },
          newSessionStart,
          newSessionEnd,
          today
        );
        const splitHappened = shifted.length > 1;

        await applyResizeSave(
          event,
          bookingSessions,
          newSessionStart,
          newSessionEnd,
          shifted,
          splitHappened
        );
        return;
      }

      // Multi-day session: open dialog.
      setPendingEdit({
        event,
        newStart,
        newEnd,
        kind: "resize",
        bookingSessions,
        touchedDay: startOfDay(event.start),
        shiftMs: 0, // not used for resize
        newSessionStart,
        newSessionEnd,
        isDateOnlyDrag: false,
      });
    },
    [optimisticEvents, applyResizeSave]
  );

  // ─── Dialog apply handlers ────────────────────────────────────────────────

  const handleApplyToDay = useCallback(async () => {
    if (!pendingEdit) return;
    const { event, bookingSessions, touchedDay, newSessionStart, newSessionEnd, kind, newStart } = pendingEdit;

    // Block: cannot split off a past day.
    const today = startOfDay(new Date());
    if (touchedDay < today) {
      toast.error(t("thisDayOnlyOnPast"));
      setPendingEdit(null);
      return;
    }

    setSavingDnd(true);
    const prev = optimisticEvents;

    // "Apply to this day only" must produce a single-day session, not a shifted
    // copy of the full session range. Compute the target day + the shift times:
    //   - DROP:   target day = where the user dropped (startOfDay(newStart)); times from newSessionStart/End.
    //   - RESIZE: day stays the same (touchedDay); times from newSessionStart/End.
    const targetDay = kind === "drop" ? startOfDay(newStart) : new Date(touchedDay);
    const singleDayStart = new Date(targetDay);
    singleDayStart.setHours(newSessionStart.getHours(), newSessionStart.getMinutes(), 0, 0);
    const singleDayEnd = new Date(targetDay);
    singleDayEnd.setHours(newSessionEnd.getHours(), newSessionEnd.getMinutes(), 0, 0);

    const splitResult = splitDayOut(
      { startAt: event.sessionStartAt, endAt: event.sessionEndAt },
      touchedDay,
      singleDayStart,
      singleDayEnd
    );

    const newSessions = bookingSessions.flatMap((s, idx) =>
      idx === event.sessionIndex ? splitResult : [s]
    );

    // Optimistic: move the dragged candle only (others in the session stay put).
    setOptimisticEvents(
      optimisticEvents.map((e) => {
        if (e.bookingId !== event.bookingId || e.id !== event.id) return e;
        return {
          ...e,
          start: singleDayStart,
          end: singleDayEnd,
          sessionStartAt: singleDayStart,
          sessionEndAt: singleDayEnd,
        };
      })
    );

    try {
      const ok = await patchBookingSessions(event.bookingId, newSessions);
      if (!ok) throw new Error();
    } catch {
      setOptimisticEvents(prev);
      toast.error(t("updateError"));
    } finally {
      setSavingDnd(false);
      setPendingEdit(null);
    }
  }, [pendingEdit, optimisticEvents, t]);

  const handleApplyToSession = useCallback(async () => {
    if (!pendingEdit) return;
    const {
      event,
      kind,
      bookingSessions,
      shiftMs,
      newSessionStart,
      newSessionEnd,
      isDateOnlyDrag,
    } = pendingEdit;

    setSavingDnd(true);
    const today = new Date();
    const session: Session = { startAt: event.sessionStartAt, endAt: event.sessionEndAt };

    let shiftedSessions: Session[];
    if (kind === "drop") {
      shiftedSessions = shiftSession(session, shiftMs, today);
    } else {
      // Resize: time-only change.
      shiftedSessions = shiftSessionTimes(session, newSessionStart, newSessionEnd, today);
    }

    const splitHappened = shiftedSessions.length > 1;
    // The representative "new" session for optimistic candle update is the last
    // element (the future/shifted portion).
    const representativeSession = shiftedSessions[shiftedSessions.length - 1];

    const newSessions = bookingSessions.flatMap((s, idx) =>
      idx === event.sessionIndex ? shiftedSessions : [s]
    );

    const prev = optimisticEvents;

    if (kind === "drop") {
      setOptimisticEvents(
        applyOptimisticCandleShift(
          optimisticEvents,
          event,
          representativeSession.startAt,
          representativeSession.endAt,
          isDateOnlyDrag,
          pendingEdit.newStart
        )
      );
      const todayStart = startOfDay(new Date());
      if (representativeSession.startAt < todayStart) {
        toast.warning(t("pastDateWarning"));
      } else if (splitHappened) {
        toast.warning(t("pastSplitWarning"));
      }
    } else {
      setOptimisticEvents(
        applyOptimisticCandleResize(
          optimisticEvents,
          event,
          representativeSession.startAt,
          representativeSession.endAt
        )
      );
      if (splitHappened) {
        toast.warning(t("pastSplitWarning"));
      }
    }

    try {
      const ok = await patchBookingSessions(event.bookingId, newSessions);
      if (!ok) throw new Error();
    } catch {
      setOptimisticEvents(prev);
      toast.error(t("updateError"));
    } finally {
      setSavingDnd(false);
      setPendingEdit(null);
    }
  }, [pendingEdit, optimisticEvents, t]);

  return (
    <>
      <BookingCalendar
        events={optimisticEvents}
        defaultDate={defaultDate}
        onSelectEvent={openDetail}
        onSelectSlot={(date, time) => openAddForDate(date, time)}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        messages={messages}
      />
      <SessionEditConfirmDialog
        open={pendingEdit !== null}
        sessionDayCount={pendingEdit?.event.sessionDayCount ?? 0}
        pastDayCount={pendingEdit?.event.sessionPastDayCount ?? 0}
        onApplyToDay={handleApplyToDay}
        onApplyToSession={handleApplyToSession}
        onCancel={() => setPendingEdit(null)}
        busy={savingDnd}
      />
    </>
  );
}
