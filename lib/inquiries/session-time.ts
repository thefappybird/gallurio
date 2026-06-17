import { formatRangeFromParts, type TimeMode } from "@/lib/utils/time-format";

/**
 * Format an inquiry session's requested times as a display range.
 *
 * Inquiry sessions store `startTime`/`endTime` as workspace-local wall-clock
 * strings ("HH:MM"). They must NOT be shifted by `tz` — the digits are already
 * correct for the workspace. This function treats them as wall-clock values and
 * delegates to the shared `formatRangeFromParts` core so output is byte-identical
 * to what `formatTimeRange` produces for the same wall-clock time.
 *
 * The `tz` parameter is accepted for API symmetry and documentation (callers
 * pass the workspace tz for clarity) but is not applied to the display — that
 * is the intended behaviour and the fix for the calendar↔modal mismatch (#14).
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
