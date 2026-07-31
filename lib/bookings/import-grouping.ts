/**
 * Rows reach this either from the CSV/XLSX parsers (all strings) or from the
 * JSON commit payload (already coerced by the client), so values are unknown.
 */
export type ImportRowLike = Record<string, unknown>;

/**
 * Groups flat import rows into bookings.
 *
 * The exporter emits one row per session plus a shared `booking_id`, so the
 * importer has to put them back together — otherwise a two-session booking
 * comes back as two separate single-session bookings. Rows with no bookingId
 * each stay their own group, which is the pre-existing behaviour for
 * hand-authored files.
 */

/** A single booking can't reasonably carry more sessions than this. */
export const MAX_SESSIONS_PER_BOOKING = 100;

export type ImportGroup = {
  /** Present only when the file supplied one — drives update-vs-create. */
  bookingId: string | null;
  rows: ImportRowLike[];
  /** 1-based source row numbers, parallel to `rows`, for error reporting. */
  rowNumbers: number[];
  /** Set when the group exceeds MAX_SESSIONS_PER_BOOKING. */
  error?: "too_many_sessions";
};

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function sessionOrder(row: ImportRowLike): number {
  const parsed = Number.parseInt(text(row.sessionIndex), 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function groupImportRows(rows: readonly ImportRowLike[]): ImportGroup[] {
  const groups: ImportGroup[] = [];
  const byBookingId = new Map<string, ImportGroup>();

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const bookingId = text(row.bookingId) || null;

    if (!bookingId) {
      groups.push({ bookingId: null, rows: [row], rowNumbers: [rowNumber] });
      return;
    }

    const existing = byBookingId.get(bookingId);
    if (existing) {
      existing.rows.push(row);
      existing.rowNumbers.push(rowNumber);
      return;
    }

    const group: ImportGroup = { bookingId, rows: [row], rowNumbers: [rowNumber] };
    byBookingId.set(bookingId, group);
    groups.push(group);
  });

  for (const group of groups) {
    if (group.rows.length < 2) continue;

    // Sort rows and their source line numbers together so error messages keep
    // pointing at the right line after reordering.
    const order = group.rows
      .map((row, i) => ({ row, rowNumber: group.rowNumbers[i], sort: sessionOrder(row) }))
      .sort((a, b) => a.sort - b.sort);
    group.rows = order.map((o) => o.row);
    group.rowNumbers = order.map((o) => o.rowNumber);

    if (group.rows.length > MAX_SESSIONS_PER_BOOKING) group.error = "too_many_sessions";
  }

  return groups;
}
