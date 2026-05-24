"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { DropConflictDialog, type ShiftHit } from "./drop-conflict-dialog";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import {
  type Session,
  splitDayOut,
} from "@/lib/bookings/session-edits";

type Props = {
  events: CalendarEvent[];
  defaultDate?: Date;
  messages: React.ComponentProps<typeof BookingCalendar>["messages"];
};

type PendingConflict = {
  event: CalendarEvent;
  newSessionStart: Date;
  newSessionEnd: Date;
  bookingSessions: Session[];
  conflicts: ShiftHit[];
  touchedDay: Date;
};

type PendingPastConfirm = {
  event: CalendarEvent;
  newSessionStart: Date;
  newSessionEnd: Date;
  bookingSessions: Session[];
  touchedDay: Date;
};

/** Convert "HH:MM" string to minutes since midnight. Returns null on bad input. */
function toMinutes(hhmm: string): number | null {
  const parts = hhmm.split(":");
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Fetch shifts on a date, excluding a specific booking id. Returns [] on error. */
async function fetchConflicts(
  dateStr: string,
  excludeId: string
): Promise<ShiftHit[]> {
  try {
    const r = await fetch(
      `/api/bookings/shifts-on-date?date=${dateStr}&excludeId=${encodeURIComponent(excludeId)}`
    );
    if (!r.ok) return [];
    const { shifts } = await r.json();
    return Array.isArray(shifts) ? (shifts as ShiftHit[]) : [];
  } catch {
    return [];
  }
}

/** Return shifts that overlap [aStart, aEnd) in minutes since midnight. */
function overlappingShifts(
  shifts: ShiftHit[],
  aStart: number,
  aEnd: number
): ShiftHit[] {
  return shifts.filter((s) => {
    const bStart = toMinutes(s.shiftStart);
    const bEnd = toMinutes(s.shiftEnd);
    return bStart !== null && bEnd !== null && aStart < bEnd && bStart < aEnd;
  });
}

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

  const [pendingPastConfirm, setPendingPastConfirm] =
    useState<PendingPastConfirm | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
  // Incrementing this key forces BookingCalendar to remount, flushing rbc's
  // internal optimistic drag state when the user cancels.
  const [refreshKey, setRefreshKey] = useState(0);

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

  // ─── Core splitDayOut apply ───────────────────────────────────────────────

  /**
   * Apply splitDayOut semantics: the dragged candle becomes its own session at
   * the new location. Only the dragged candle moves in the optimistic update;
   * siblings in the same session stay at their original positions.
   */
  const applySplit = useCallback(
    async (
      event: CalendarEvent,
      bookingSessions: Session[],
      touchedDay: Date,
      newCandleStart: Date,
      newCandleEnd: Date
    ) => {
      const prev = optimisticEvents;

      const splitResult = splitDayOut(
        { startAt: event.sessionStartAt, endAt: event.sessionEndAt },
        touchedDay,
        newCandleStart,
        newCandleEnd
      );

      const newSessions = bookingSessions.flatMap((s, idx) =>
        idx === event.sessionIndex ? splitResult : [s]
      );

      // Optimistic: move only the dragged candle; siblings stay put.
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
        if (!ok) throw new Error();
      } catch {
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
   *   3. Past-date check → PastDateConfirmDialog.
   *   4. Overnight conflict check (fetches shifts for both dates when the
   *      candle window spans midnight).
   *   5. Conflict check → DropConflictDialog on match.
   *   6. Apply via splitDayOut.
   */
  const handleAnyDrop = useCallback(
    async (
      event: CalendarEvent,
      newRbcStart: Date,
      newRbcEnd: Date,
      isDateOnlyDrag: boolean,
      touchedDay: Date
    ) => {
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

      // 3. Past-date check.
      const today = startOfDay(new Date());
      if (startOfDay(newCandleStart) < today) {
        setPendingPastConfirm({
          event,
          newSessionStart: newCandleStart,
          newSessionEnd: newCandleEnd,
          bookingSessions,
          touchedDay,
        });
        return;
      }

      // 4. Conflict check — fetch shifts for both dates if the window is overnight.
      const startDateStr = isoDate(newCandleStart);
      const endDateStr = isoDate(newCandleEnd);
      const aStart = newCandleStart.getHours() * 60 + newCandleStart.getMinutes();
      const aEnd = newCandleEnd.getHours() * 60 + newCandleEnd.getMinutes();

      let allShifts: ShiftHit[];
      if (startDateStr !== endDateStr) {
        const [shiftsA, shiftsB] = await Promise.all([
          fetchConflicts(startDateStr, event.bookingId),
          fetchConflicts(endDateStr, event.bookingId),
        ]);
        const seen = new Set<string>();
        allShifts = [...shiftsA, ...shiftsB].filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
      } else {
        allShifts = await fetchConflicts(startDateStr, event.bookingId);
      }

      const conflicts = overlappingShifts(allShifts, aStart, aEnd);

      // 5. Show conflict dialog if needed.
      if (conflicts.length > 0) {
        setPendingConflict({
          event,
          newSessionStart: newCandleStart,
          newSessionEnd: newCandleEnd,
          bookingSessions,
          conflicts,
          touchedDay,
        });
        return;
      }

      // 6. Apply.
      await applySplit(event, bookingSessions, touchedDay, newCandleStart, newCandleEnd);
    },
    [optimisticEvents, applySplit]
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

  // ─── Conflict dialog handlers ─────────────────────────────────────────────

  const handleConflictCancel = useCallback(() => {
    setPendingConflict(null);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleConflictConfirm = useCallback(async () => {
    if (!pendingConflict) return;
    const { event, bookingSessions, touchedDay, newSessionStart, newSessionEnd } =
      pendingConflict;
    setPendingConflict(null);
    await applySplit(event, bookingSessions, touchedDay, newSessionStart, newSessionEnd);
  }, [pendingConflict, applySplit]);

  return (
    <>
      <BookingCalendar
        key={refreshKey}
        events={optimisticEvents}
        defaultDate={defaultDate}
        onSelectEvent={openDetail}
        onSelectSlot={(date, time) => openAddForDate(date, time)}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        onExternalDragStart={handleExternalDragStart}
        onExternalDragEnd={handleExternalDragEnd}
        onDropFromOutside={handleDropFromOutside}
        dragFromOutsideItem={dragFromOutsideItem}
        messages={messages}
      />
      <PastDateConfirmDialog
        open={pendingPastConfirm !== null}
        onCancel={handlePastCancel}
        onConfirm={handlePastConfirm}
      />
      <DropConflictDialog
        open={pendingConflict !== null}
        conflicts={pendingConflict?.conflicts ?? []}
        proposedStart={pendingConflict?.newSessionStart ?? new Date()}
        proposedEnd={pendingConflict?.newSessionEnd ?? new Date()}
        onCancel={handleConflictCancel}
        onConfirm={handleConflictConfirm}
      />
    </>
  );
}
