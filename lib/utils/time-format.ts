/**
 * Centralised time-format helpers.
 *
 * DEFAULT_TIME_MODE drives all display formatting across the app.
 * Will later be overridden by a per-user preference once settings ship —
 * keep callsites passing through this helper so flipping the default (or
 * sourcing the mode from user context) only requires one change here.
 *
 * DEFAULT_TIME_INPUT_LANG pairs with DEFAULT_TIME_MODE — the `lang` hint
 * passed to every <input type="time"> so Chromium/Firefox renders the picker
 * in the matching hour cycle. Flip both together when a per-user preference
 * setting ships.
 */

export type TimeMode = "24h" | "12h";

/**
 * Global default. Flip to "12h" here (or source from user context) once
 * per-user preference settings ship.
 */
export const DEFAULT_TIME_MODE: TimeMode = "24h";

// ─── Display formatting ───────────────────────────────────────────────────────

const FORMATTERS: Record<TimeMode, Intl.DateTimeFormat> = {
  "24h": new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
  "12h": new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }),
};

function makeFormatter(mode: TimeMode, timeZone: string): Intl.DateTimeFormat {
  return mode === "24h"
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone })
    : new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone });
}

/** Format a Date as HH:MM (24h) or h:MM AM/PM (12h).
 *  Pass `timeZone` (IANA) to get a timezone-correct display instead of runtime-local. */
export function formatTime(date: Date, mode: TimeMode = DEFAULT_TIME_MODE, timeZone?: string): string {
  if (timeZone) return makeFormatter(mode, timeZone).format(date);
  return FORMATTERS[mode].format(date);
}

/**
 * Pin a wall-clock "HH:MM" string at UTC epoch so an Intl formatter with
 * timeZone "UTC" reads exactly the hours/minutes supplied — no host-tz shift.
 */
function toUTCDate(hhmm: string): Date {
  const [hh, mm] = hhmm.split(":").map(Number);
  const d = new Date(0);
  d.setUTCHours(hh, mm, 0, 0);
  return d;
}

/**
 * Shared formatting core: accepts wall-clock "HH:MM" strings and returns a
 * formatted range (en-dash separator U+2013).
 *
 * Both `formatTimeRange` (which extracts wall-clock HH:MM parts from its Date
 * inputs in the target tz before calling here) and `formatSessionTimeRange`
 * (which passes stored wall-clock strings directly) funnel through this single
 * Intl code path — ensuring calendar and modal displays are structurally
 * identical, not just test-asserted to be equal.
 *
 * Pins the times at UTC epoch so the formatter (timeZone "UTC") reads exactly
 * the hours/minutes supplied — no host-tz shift.
 */
export function formatRangeFromParts(
  startHHMM: string,
  endHHMM: string,
  mode: TimeMode
): string {
  const fmt = makeFormatter(mode, "UTC");
  return `${fmt.format(toUTCDate(startHHMM))} – ${fmt.format(toUTCDate(endHHMM))}`;
}

/**
 * Extract the wall-clock "HH:MM" string from a Date in the given IANA tz,
 * or in the runtime-local zone when tz is undefined (mirrors FORMATTERS behaviour).
 */
function dateToHHMM(date: Date, timeZone?: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  };
  // en-GB always formats hh:mm with leading zero and no AM/PM.
  return new Intl.DateTimeFormat("en-GB", opts).format(date);
}

/**
 * Format a time range as "HH:MM – HH:MM" or "h:MM AM – h:MM PM" (en-dash separator).
 * Pass `timeZone` (IANA) to get a timezone-correct display instead of runtime-local.
 *
 * Delegates to `formatRangeFromParts` — the same primitive used by
 * `formatSessionTimeRange` — so both paths produce structurally identical output.
 */
export function formatTimeRange(
  start: Date,
  end: Date,
  mode: TimeMode = DEFAULT_TIME_MODE,
  timeZone?: string
): string {
  return formatRangeFromParts(dateToHHMM(start, timeZone), dateToHHMM(end, timeZone), mode);
}

// ─── Native <input type="time"> lang hint ─────────────────────────────────────

/**
 * Maps each TimeMode to the BCP-47 language tag whose default hour cycle
 * matches. Chromium-based browsers and Firefox respect this to override their
 * OS locale default for time pickers.
 *
 * This pairs with DEFAULT_TIME_MODE — flip both together when user-preference
 * settings ship.
 */
export const TIME_INPUT_LANG: Record<TimeMode, string> = {
  "24h": "en-GB",
  "12h": "en-US",
};

export const DEFAULT_TIME_INPUT_LANG = TIME_INPUT_LANG[DEFAULT_TIME_MODE];
