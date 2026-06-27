/**
 * Shared timezone utilities used by both server routes and client components.
 * All helpers use the IANA Intl API — no third-party date libraries needed.
 */

export const FALLBACK_TZ = "Asia/Manila";

/** Resolve a workspace's IANA timezone, falling back to the platform default. */
export function resolveWorkspaceTimezone(
  workspace: { timezone?: string | null } | null | undefined
): string {
  return workspace?.timezone || FALLBACK_TZ;
}

/**
 * UTC instant of the current local day's midnight in `timeZone` — the rollup
 * day bucket so a day's analytics align with the owner's calendar day.
 */
export function localDayStart(timeZone: string, now: Date): Date {
  // en-CA formats as YYYY-MM-DD.
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return dayBoundInTz(dateStr, timeZone, 0, 0, 0, 0);
}

/** Extract date/time parts from a UTC Date as seen in `timeZone`. */
function intlParts(
  d: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Returns the UTC instant corresponding to HH:MM:SS.mmm on `dateStr`
 * (YYYY-MM-DD) in `timeZone`.
 *
 * Algorithm: probe with the naive UTC equivalent, ask Intl what local
 * date/time that probe represents, then shift by the diff. A second
 * refinement pass corrects for DST transitions where the first probe
 * straddles the clock change (e.g. LA spring-forward: the initial probe
 * may fall in PST while the target instant is in PDT, so one correction
 * overshoots by 1h; the second pass brings it back).
 */
export function dayBoundInTz(
  dateStr: string,
  timeZone: string,
  h: number,
  min: number,
  sec: number,
  ms: number
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const desired = Date.UTC(year, month - 1, day, h, min, sec, ms);

  // First pass.
  const probe1 = new Date(Date.UTC(year, month - 1, day, h, min, sec, ms));
  const local1 = intlParts(probe1, timeZone);
  const reported1 = Date.UTC(local1.year, local1.month - 1, local1.day, local1.hour, local1.minute, local1.second, ms);
  const candidate = new Date(probe1.getTime() + (desired - reported1));

  // Second pass (refinement): re-check the candidate's local time. If the
  // first correction overshot due to a DST boundary, this brings it back.
  const local2 = intlParts(candidate, timeZone);
  const reported2 = Date.UTC(local2.year, local2.month - 1, local2.day, local2.hour, local2.minute, local2.second, ms);
  if (reported2 === desired) return candidate;
  return new Date(candidate.getTime() + (desired - reported2));
}

/**
 * Interprets `date` (YYYY-MM-DD) and `time` (HH:MM) as wall-clock in
 * `timeZone` and returns the corresponding UTC ISO string.
 *
 * This is the correct replacement for:
 *   `new Date(\`${date}T${time}:00\`).toISOString()`
 * which incorrectly parses as browser-local time.
 */
export function wallTimeInTzToUtc(
  date: string,
  time: string,
  timeZone: string
): string {
  if (!date) return "";
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const [hStr, mStr] = t.split(":");
  return dayBoundInTz(date, timeZone, Number(hStr), Number(mStr), 0, 0).toISOString();
}
