import type { CalendarEvent } from "../booking-calendar";
import type { Session } from "@/lib/bookings/session-edits";
import type { ShiftHit } from "../booking-wizard-steps/event-step";
export type { ShiftHit } from "../booking-wizard-steps/event-step";
import { FALLBACK_TZ } from "@/lib/utils/timezone";

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
 * Format a UTC Date as YYYY-MM-DD in the given IANA timezone.
 * This is the timezone-correct replacement for `isoDate()` when the workspace
 * timezone is known. The server's shifts-on-date route uses this same TZ to
 * resolve day boundaries, so the client must send the same date string.
 */
export function isoDateInTz(d: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // en-CA produces YYYY-MM-DD natively
}

/**
 * Return minutes-since-midnight for a UTC Date as seen in `timeZone`.
 * Used so the client-side overlap comparison uses the same TZ reference as the
 * server's shiftStart/shiftEnd HH:MM strings.
 */
export function dateToTzMinutes(d: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
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
