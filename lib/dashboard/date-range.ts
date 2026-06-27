import { dayBoundInTz } from "@/lib/utils/timezone";

export type DateRangeMode = "until" | "between" | "since";

export type DashboardRange = {
  /** Inclusive lower bound (UTC instant of local start-of-day), or null = open. */
  from: Date | null;
  /** Inclusive upper bound (UTC instant of local end-of-day), or null = open. */
  to: Date | null;
  /** Active mode, or null when no/invalid filter is applied (= all-time). */
  mode: DateRangeMode | null;
};

/** Raw search params as delivered by Next (values may be string | string[]). */
type RawSearchParams = Record<string, string | string[] | undefined>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pick(sp: RawSearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Parse YYYY-MM-DD as the UTC instant of that wall-time in `tz`, or null. */
function bound(
  raw: string | undefined,
  tz: string,
  end: boolean
): Date | null {
  if (!raw || !DATE_RE.test(raw)) return null;
  return end
    ? dayBoundInTz(raw, tz, 23, 59, 59, 999)
    : dayBoundInTz(raw, tz, 0, 0, 0, 0);
}

/**
 * Resolve the dashboard date filter from URL search params, interpreting the
 * `from`/`to` calendar dates as the owner's local day in `tz` (so day
 * boundaries match bookings/inquiries, not UTC).
 *
 * `?dmode=until` → (-inf, to] · `between` → [from, to] · `since` → [from, +inf).
 * Missing mode or unparseable dates collapse to all-time ({ null, null, null }).
 */
export function parseDashboardRange(
  sp: RawSearchParams,
  tz: string
): DashboardRange {
  const mode = pick(sp, "dmode");
  const from = bound(pick(sp, "from"), tz, false);
  const to = bound(pick(sp, "to"), tz, true);

  if (mode === "until") return { from: null, to, mode };
  if (mode === "since") return { from, to: null, mode };
  if (mode === "between") return { from, to, mode };
  return { from: null, to: null, mode: null };
}
