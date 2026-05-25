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
import { BookingWizardModal } from "./booking-wizard-modal";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import {
  type Session,
  splitDayOut,
} from "@/lib/bookings/session-edits";
import {
  overlappingShifts,
  isoDate,
  reconstructSessions,
} from "./_helpers/calendar-helpers";
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

/**
 * Fetch shifts on a date, excluding a specific booking id.
 * Returns null on non-2xx response or network error — callers must treat null
 * as "check unavailable" and abort the operation (not silently allow it).
 */
async function fetchConflicts(
  dateStr: string,
  excludeId: string
): Promise<ShiftHit[] | null> {
  try {
    const r = await fetch(
      `/api/bookings/shifts-on-date?date=${dateStr}&excludeId=${encodeURIComponent(excludeId)}`
    );
    if (!r.ok) {
      console.error("[fetchConflicts] non-ok response", { status: r.status, dateStr });
      return null;
    }
    const { shifts } = await r.json();
    return Array.isArray(shifts) ? (shifts as ShiftHit[]) : [];
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
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.dnd");

  // Read wizard state from URL search params so the wizard modal is managed
  // here alongside the client list (enables client refetch after creation).
  const spAdd = searchParams.get("add");
  const spEdit = searchParams.get("edit");
  const spDate = searchParams.get("date") ?? undefined;
  const spTime = searchParams.get("time") ?? undefined;

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

      // Bled (midnight-split) candles represent ONE overnight session displayed
      // as two halves. splitDayOut would produce an invalid before-portion
      // because the same calendar day serves as both session-day and drag-day.
      // Shift the whole session by the drag delta instead.
      const isBled = event.isMorningContinuation === true || event.isEveningHead === true;

      let newSessions: Session[];
      if (isBled) {
        const deltaMs = newCandleStart.getTime() - event.start.getTime();
        const oldSession = bookingSessions[event.sessionIndex];
        const shifted: Session = {
          startAt: new Date(oldSession.startAt.getTime() + deltaMs),
          endAt: new Date(oldSession.endAt.getTime() + deltaMs),
        };
        newSessions = bookingSessions.map((s, idx) =>
          idx === event.sessionIndex ? shifted : s
        );

        // Optimistic: shift every candle/half belonging to this session.
        setOptimisticEvents(
          optimisticEvents.map((e) => {
            if (e.bookingId !== event.bookingId || e.sessionIndex !== event.sessionIndex) {
              return e;
            }
            return {
              ...e,
              start: new Date(e.start.getTime() + deltaMs),
              end: new Date(e.end.getTime() + deltaMs),
              sessionStartAt: shifted.startAt,
              sessionEndAt: shifted.endAt,
            };
          })
        );
      } else {
        const splitResult = splitDayOut(
          { startAt: event.sessionStartAt, endAt: event.sessionEndAt },
          touchedDay,
          newCandleStart,
          newCandleEnd
        );

        newSessions = bookingSessions.flatMap((s, idx) =>
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
      }

      try {
        const ok = await patchBookingSessions(event.bookingId, newSessions);
        if (!ok) throw new Error("PATCH returned non-ok");
        if (isBled) {
          // Re-derive candles from the server so overnight↔same-day transitions
          // render cleanly (splitSessionIntoCandles lives in the server page).
          router.refresh();
        }
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
    [optimisticEvents, t, router]
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

      let allShifts: ShiftHit[] | null;
      if (startDateStr !== endDateStr) {
        const [shiftsA, shiftsB] = await Promise.all([
          fetchConflicts(startDateStr, event.bookingId),
          fetchConflicts(endDateStr, event.bookingId),
        ]);
        if (shiftsA === null || shiftsB === null) {
          toast.error(t("conflictCheckFailed"));
          return;
        }
        const seen = new Set<string>();
        allShifts = [...shiftsA, ...shiftsB].filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
      } else {
        allShifts = await fetchConflicts(startDateStr, event.bookingId);
        if (allShifts === null) {
          toast.error(t("conflictCheckFailed"));
          return;
        }
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
      {spAdd === "1" ? (
        <BookingWizardModal
          mode="create"
          defaultDate={spDate}
          defaultTime={spTime}
          defaultCurrency={defaultCurrency}
          locale={locale}
          clients={clients}
          onClientCreated={refetchClients}
        />
      ) : null}
      {spEdit ? (
        <BookingWizardModal
          mode="edit"
          bookingId={spEdit}
          defaultCurrency={defaultCurrency}
          locale={locale}
          clients={clients}
          onClientCreated={refetchClients}
        />
      ) : null}
    </>
  );
}
