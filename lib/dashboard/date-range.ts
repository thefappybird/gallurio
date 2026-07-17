import { dayBoundInTz } from "@/lib/utils/timezone";
import { addDaysStr, isoWeekStartDate } from "@/lib/utils/iso-week";

export type DateFilterMode = "week" | "month" | "year" | "custom" | "all";

export type DashboardRange = {
  /** Inclusive lower bound (UTC instant of local start-of-day), or null = open. */
  from: Date | null;
  /** Inclusive upper bound (UTC instant of local end-of-day), or null = open. */
  to: Date | null;
  /** Active mode, or null when no/invalid filter is applied. */
  mode: DateFilterMode | null;
};

/** Raw search params as delivered by Next (values may be string | string[]). */
type RawSearchParams = Record<string, string | string[] | undefined>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pick(sp: RawSearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Resolve the dashboard date filter from URL search params, interpreting the
 * calendar dates as the owner's local day in `tz` (so day boundaries match
 * bookings/inquiries, not UTC).
 */
export function parseDashboardRange(
  sp: RawSearchParams,
  tz: string,
  now: Date = new Date()
): DashboardRange {
  const df = pick(sp, "df");

  if (df === "all") return { from: null, to: null, mode: "all" };

  if (df === "week") {
    const w = pick(sp, "w");
    const m = w ? /^(\d{4})-W(\d{2})$/.exec(w) : null;
    if (m) {
      const monday = isoWeekStartDate(Number(m[1]), Number(m[2]));
      const sunday = addDaysStr(monday, 6);
      return {
        from: dayBoundInTz(monday, tz, 0, 0, 0, 0),
        to: dayBoundInTz(sunday, tz, 23, 59, 59, 999),
        mode: "week",
      };
    }
  }

  if (df === "month") {
    const m = pick(sp, "m");
    if (m && /^\d{4}-\d{2}$/.test(m)) {
      const [y, mo] = m.split("-").map(Number);
      const pad = (n: number) => String(n).padStart(2, "0");
      const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      return {
        from: dayBoundInTz(`${y}-${pad(mo)}-01`, tz, 0, 0, 0, 0),
        to: dayBoundInTz(`${y}-${pad(mo)}-${pad(lastDay)}`, tz, 23, 59, 59, 999),
        mode: "month",
      };
    }
  }

  if (df === "year") {
    const y = pick(sp, "y");
    if (y && /^\d{4}$/.test(y)) {
      return {
        from: dayBoundInTz(`${y}-01-01`, tz, 0, 0, 0, 0),
        to: dayBoundInTz(`${y}-12-31`, tz, 23, 59, 59, 999),
        mode: "year",
      };
    }
  }

  if (df === "custom") {
    const fromRaw = pick(sp, "from");
    const toRaw = pick(sp, "to");
    const from = fromRaw && DATE_RE.test(fromRaw) ? dayBoundInTz(fromRaw, tz, 0, 0, 0, 0) : null;
    const to = toRaw && DATE_RE.test(toRaw) ? dayBoundInTz(toRaw, tz, 23, 59, 59, 999) : null;
    if (from || to) return { from, to, mode: "custom" };
  }

  // Default: the current month in the workspace timezone.
  const localToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).format(now); // YYYY-MM
  const [cy, cmo] = localToday.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(cy, cmo, 0)).getUTCDate();
  return {
    from: dayBoundInTz(`${cy}-${pad(cmo)}-01`, tz, 0, 0, 0, 0),
    to: dayBoundInTz(`${cy}-${pad(cmo)}-${pad(lastDay)}`, tz, 23, 59, 59, 999),
    mode: "month",
  };
}
