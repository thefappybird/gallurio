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

/** Format a Date as HH:MM (24h) or h:MM AM/PM (12h). */
export function formatTime(date: Date, mode: TimeMode = DEFAULT_TIME_MODE): string {
  return FORMATTERS[mode].format(date);
}

/** Format a time range as "HH:MM – HH:MM" or "h:MM AM – h:MM PM" (en-dash separator). */
export function formatTimeRange(
  start: Date,
  end: Date,
  mode: TimeMode = DEFAULT_TIME_MODE
): string {
  return `${formatTime(start, mode)} – ${formatTime(end, mode)}`;
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
