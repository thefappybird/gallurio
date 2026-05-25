import type { CalendarEvent } from "../booking-calendar";
import type { Session } from "@/lib/bookings/session-edits";
import type { ShiftHit } from "../drop-conflict-dialog";

/**
 * Convert "HH:MM" string to minutes since midnight.
 * Returns null on bad input (empty, non-numeric, out of range).
 */
export function toMinutes(hhmm: string): number | null {
  if (!hhmm) return null;
  const parts = hhmm.split(":");
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Return the subset of `shifts` whose time window overlaps [aStart, aEnd)
 * (both in minutes since midnight). Adjacent-exact boundaries do NOT overlap.
 */
export function overlappingShifts(
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

/**
 * Format a Date as a local YYYY-MM-DD string (local time, not UTC).
 * Used so drag-drop date strings match what the workspace timezone would show.
 */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Reconstruct the full ordered sessions array for a given booking from the
 * current optimistic events state.
 *
 * Candles share `sessionIndex`, `sessionStartAt`, `sessionEndAt` within each
 * session group — we deduplicate by `sessionIndex` and sort ascending.
 */
export function reconstructSessions(
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
