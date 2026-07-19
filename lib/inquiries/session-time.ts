import { formatRangeFromParts, type TimeMode } from "@/lib/utils/time-format";

/**
 * Format an inquiry session's requested times as a display range.
 *
 * Invariant: assumes startTime/endTime are already workspace-local wall-clock
 * strings ("HH:MM"); tz is not applied.
 *
 * Inquiry sessions store `startTime`/`endTime` as workspace-local wall-clock
 * strings. They must NOT be shifted by `tz` — the digits are already correct
 * for the workspace. This function passes them directly to `formatRangeFromParts`
 * (the same core used by `formatTimeRange`) so calendar and modal displays are
 * structurally guaranteed to agree for the same wall-clock time.
 *
 * The `_tz` parameter is accepted for call-site symmetry (callers pass the
 * workspace tz for documentation clarity) but is intentionally unused — that is
 * the fix for the calendar↔modal mismatch (#14).
 */
export function formatSessionTimeRange(
  session: { startDate: string; startTime: string; endTime: string },
  mode: TimeMode,
  // tz is accepted for call-site symmetry but intentionally unused: the stored
  // HH:MM strings are already workspace-local wall clock, so no tz conversion
  // is needed or wanted.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tz: string
): string {
  return formatRangeFromParts(session.startTime, session.endTime, mode);
}
