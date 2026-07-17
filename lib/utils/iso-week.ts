/**
 * Pure calendar-arithmetic helpers for ISO-8601 week handling. No timezone
 * awareness here — callers resolve a workspace-local "YYYY-MM-DD" key first
 * (e.g. via lib/utils/timezone.ts), then use these on that key.
 */

/** Add `n` days to a "YYYY-MM-DD" string via pure calendar arithmetic (no timezone). */
export function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** 0=Monday..6=Sunday for a "YYYY-MM-DD" calendar date. */
function weekdayMonday0(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  return (dow + 6) % 7;
}

/** Monday ("YYYY-MM-DD") of the week containing `dateStr` (Mon-start weeks). */
export function weekStartMonday(dateStr: string): string {
  return addDaysStr(dateStr, -weekdayMonday0(dateStr));
}

/** Monday ("YYYY-MM-DD") of ISO week `isoWeek` in `isoYear` (ISO-8601 Thursday rule). */
export function isoWeekStartDate(isoYear: number, isoWeek: number): string {
  const jan4 = `${isoYear}-01-04`;
  const week1Monday = weekStartMonday(jan4);
  return addDaysStr(week1Monday, 7 * (isoWeek - 1));
}

function toUTCTime(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** ISO-8601 {isoYear, isoWeek} for a "YYYY-MM-DD" calendar date. */
export function isoWeekOf(dateStr: string): { isoYear: number; isoWeek: number } {
  const dow = weekdayMonday0(dateStr) + 1; // 1=Mon..7=Sun
  const thursday = addDaysStr(dateStr, 4 - dow);
  const isoYear = Number(thursday.slice(0, 4));
  const jan1 = `${isoYear}-01-01`;
  const diffDays = Math.round((toUTCTime(thursday) - toUTCTime(jan1)) / 86_400_000);
  const isoWeek = Math.floor(diffDays / 7) + 1;
  return { isoYear, isoWeek };
}
