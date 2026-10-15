import { isCompletionEligible } from "./payment-rules";
import { SUPPORTED_CURRENCIES } from "@/lib/validators/workspace";
import { wallTimeInTzToUtc } from "@/lib/utils/timezone";

/**
 * Value normalization for the bookings import.
 *
 * The mapping step answers "which column is this", and this answers "what does
 * that cell actually say". Spreadsheets carry money as "PHP 50,000.00" and
 * dates as "06/15/2026"; `bookingImportRowSchema` accepts neither, so rows that
 * were perfectly good data used to be rejected over formatting. Everything here
 * is pure and runs in the browser before the preview.
 *
 * Failures return a stable code rather than a sentence: the caller turns it into
 * a localized message, and the preview shows it on the row like any other error.
 */

export type CoerceResult =
  | { ok: true; value: string }
  | { ok: false; reason: CoerceFailure };

export type CoerceFailure =
  | "not_a_number"
  | "negative_amount"
  | "not_a_date"
  | "unsupported_currency";

/**
 * Reads a money cell however the sheet decorated it.
 *
 * Separator handling is the fiddly part: "1,234.56" and "1.500.000" are both
 * valid and mean different things, so the last separator wins only when both
 * kinds appear, and a lone separator with exactly three trailing digits is read
 * as a thousands mark.
 */
export function coerceMoney(raw: string): CoerceResult {
  const trimmed = raw.trim();
  // A blank cell is an absent optional amount, which the schema already handles.
  // Coercing it to 0 would invent a total the user never wrote.
  if (!trimmed) return { ok: true, value: "" };

  // Accountant's parentheses and a leading minus both mean negative, which the
  // schema refuses. Stripping the sign would silently invert a refund.
  if (/^\(.*\)$/.test(trimmed) || trimmed.startsWith("-")) {
    return { ok: false, reason: "negative_amount" };
  }

  const bare = trimmed.replace(/[^\d.,]/g, "");
  if (!bare) return { ok: false, reason: "not_a_number" };

  const lastComma = bare.lastIndexOf(",");
  const lastDot = bare.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: whichever comes last is the decimal point.
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = bare.split(thousands).join("").replace(decimal, ".");
  } else {
    const sep = lastComma >= 0 ? "," : lastDot >= 0 ? "." : "";
    const parts = sep ? bare.split(sep) : [bare];
    const grouped = parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
    normalized = grouped ? parts.join("") : parts.join(".");
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return { ok: false, reason: "not_a_number" };
  if (n < 0) return { ok: false, reason: "negative_amount" };
  return { ok: true, value: String(n) };
}

/** Which of the two leading numbers a slash/dash date puts first. */
export type DateOrder = "MDY" | "DMY";

/** Zones whose locale writes month-first: PH and the US/Canada. Latin America is day-first. */
const MDY_ZONES = new Set([
  "Asia/Manila", "Pacific/Honolulu",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "America/Detroit", "America/Boise",
  "America/Juneau", "America/Adak", "America/Toronto", "America/Vancouver",
  "America/Edmonton", "America/Winnipeg", "America/Halifax",
]);
const MDY_PREFIXES = ["America/Indiana/", "America/Kentucky/", "America/North_Dakota/"];

/** Month-first where the workspace's own clock says so, else day-first. */
export function defaultDateOrder(timeZone: string): DateOrder {
  return MDY_ZONES.has(timeZone) || MDY_PREFIXES.some((p) => timeZone.startsWith(p)) ? "MDY" : "DMY";
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Excel counts days from 1899-12-30; 25569 is that epoch's Unix day offset. */
const EXCEL_EPOCH_OFFSET = 25569;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Rejects 31 February rather than letting Date roll it forward to 3 March. */
function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** "9:00 AM", "14:30", "9pm", "noon" — one alternative per branch. */
const TIME_RE =
  /(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?|\b(\d{1,2})\.(\d{2})\s*([ap]\.?m\.?)(?![a-z])|\b(\d{1,2})\s*([ap]\.?m\.?)(?![a-z])|\b(noon|midnight)\b/i;

/** True when a cell carries a time of day, by the same rule coerceDate reads it with. */
export function hasTimeOfDay(cell: string): boolean {
  return TIME_RE.test(cell);
}

/**
 * Pulls the time out of a cell as 24-hour "HH:MM", and returns the text without it.
 * `invalid` means a time-like token was present but unreadable ("25:00", "42pm");
 * the caller must reject the cell rather than quietly fall back to midnight.
 */
function extractTime(raw: string): { time: string; rest: string; invalid: boolean } {
  const m = raw.match(TIME_RE);
  if (!m) return { time: "", rest: raw, invalid: false };
  const rest = raw.replace(TIME_RE, " ").trim();
  if (m[9]) return { time: m[9].toLowerCase() === "noon" ? "12:00" : "00:00", rest, invalid: false };
  let hour = Number(m[1] ?? m[4] ?? m[7]);
  const minute = m[2] ?? m[5] ?? "00";
  const meridiem = (m[3] ?? m[6] ?? m[8])?.toLowerCase().replace(/\./g, "");
  if (meridiem && (hour < 1 || hour > 12)) return { time: "", rest, invalid: true };
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || Number(minute) > 59) return { time: "", rest, invalid: true };
  return { time: `${pad(hour)}:${minute}`, rest, invalid: false };
}

/**
 * Strips weekday names, ordinal suffixes and "Jun." dots (they carry no date
 * information and would be mistaken for the month word), then lifts the time out,
 * leaving only the date part to interpret.
 */
function splitTime(trimmed: string): { time: string; rest: string; invalid: boolean } {
  const cleaned = trimmed
    .replace(/\b(mon|tues?|wed(nes)?|thu(rs?)?|fri|sat(ur)?|sun)(day)?\b\.?,?/gi, " ")
    .replace(/(\d)(st|nd|rd|th)\b/gi, "$1")
    .replace(/\b([a-z]{3,})\./gi, "$1")
    .trim();
  return extractTime(cleaned);
}

/**
 * Reads a date cell in whatever shape the sheet wrote it and returns a UTC
 * instant, interpreting any wall time as the workspace's own clock.
 *
 * `order` only settles genuinely ambiguous numeric dates — when one of the two
 * leading numbers is above 12 there is only one valid reading and it wins
 * regardless, so a declared order can never corrupt an unambiguous column.
 */
export function coerceDate(raw: string, timeZone: string, order: DateOrder): CoerceResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: "" };

  // Already an instant (our own export, or an exceljs date cell) — keep it
  // exactly, so a round-trip never drifts by a timezone offset.
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return { ok: false, reason: "not_a_date" };
    return { ok: true, value: parsed.toISOString() };
  }

  // A bare number in a date column is an Excel serial, which is what a real
  // date cell becomes once the sheet is read as text.
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (serial < 1 || serial > 2958465) return { ok: false, reason: "not_a_date" };
    const ms = Math.round((serial - EXCEL_EPOCH_OFFSET) * 86400000);
    const at = new Date(ms);
    const time = serial % 1 === 0 ? "00:00" : `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
    const day = at.toISOString().slice(0, 10);
    return { ok: true, value: wallTimeInTzToUtc(day, time, timeZone) };
  }

  const { time: parsedTime, rest: datePart, invalid } = splitTime(trimmed);
  if (invalid) return { ok: false, reason: "not_a_date" };
  const time = parsedTime || "00:00";

  let y: number | undefined;
  let mo: number | undefined;
  let d: number | undefined;

  const named = datePart.match(/([a-z]{3,})/i);
  if (named) {
    // "June 15, 2026" or "15 June 2026" — the month is unambiguous, so the two
    // remaining numbers sort themselves out by magnitude.
    const monthIndex = MONTH_NAMES.findIndex((n) => n.startsWith(named[1].toLowerCase()));
    if (monthIndex < 0) return { ok: false, reason: "not_a_date" };
    const nums = datePart.match(/\d+/g)?.map(Number) ?? [];
    if (nums.length < 2) return { ok: false, reason: "not_a_date" };
    mo = monthIndex + 1;
    y = nums.find((n) => n > 31) ?? nums[1];
    y = y < 100 ? 2000 + y : y;
    d = nums.find((n) => n <= 31);
  } else {
    const parts = datePart.split(/[/\-.]/).map((p) => p.trim());
    if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
      return { ok: false, reason: "not_a_date" };
    }
    const [a, b, c] = parts.map(Number);
    if (parts[0].length === 4) {
      // ISO-ish: 2026-06-15.
      [y, mo, d] = [a, b, c];
    } else {
      y = c < 100 ? 2000 + c : c;
      // The declared order decides only when both readings are possible.
      const mdyValid = isRealDate(y, a, b);
      const dmyValid = isRealDate(y, b, a);
      if (mdyValid && dmyValid) [mo, d] = order === "MDY" ? [a, b] : [b, a];
      else if (mdyValid) [mo, d] = [a, b];
      else if (dmyValid) [mo, d] = [b, a];
      else return { ok: false, reason: "not_a_date" };
    }
  }

  if (y === undefined || mo === undefined || d === undefined || !isRealDate(y, mo, d)) {
    return { ok: false, reason: "not_a_date" };
  }
  return { ok: true, value: wallTimeInTzToUtc(`${y}-${pad(mo)}-${pad(d)}`, time, timeZone) };
}

/**
 * What a sheet writes instead of an ISO code. Only currencies the workspace can
 * actually settle in are listed — an unsupported one has to fail loudly rather
 * than be silently rewritten to the workspace default.
 */
const CURRENCY_ALIASES: Record<string, string> = {
  "₱": "PHP", peso: "PHP", pesos: "PHP", php: "PHP",
  $: "USD", "us$": "USD", dollar: "USD", dollars: "USD",
  rp: "IDR", rupiah: "IDR",
  rm: "MYR", ringgit: "MYR",
  "s$": "SGD", "sg$": "SGD",
  "฿": "THB", baht: "THB",
  "a$": "AUD", "au$": "AUD",
  "c$": "CAD", "ca$": "CAD",
  "nz$": "NZD",
  "£": "GBP", pound: "GBP", pounds: "GBP", sterling: "GBP",
  dirham: "AED", riyal: "SAR", dinar: "KWD",
};

export function coerceCurrency(raw: string): CoerceResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: "" };

  const upper = trimmed.toUpperCase();
  if ((SUPPORTED_CURRENCIES as readonly string[]).includes(upper)) {
    return { ok: true, value: upper };
  }
  const alias = CURRENCY_ALIASES[trimmed.toLowerCase()];
  if (alias) return { ok: true, value: alias };
  return { ok: false, reason: "unsupported_currency" };
}

/**
 * Whether a date column needs the user to declare day/month order.
 *
 * Ambiguity is a property of the whole column, not of one cell: a single value
 * with a day above 12 settles every other value in it. Only when nothing in the
 * column disambiguates does the reading become a real choice — and guessing
 * there would corrupt dates invisibly, which is worse than failing.
 */
export function isAmbiguousDateColumn(values: readonly string[]): boolean {
  let sawAmbiguous = false;
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const parts = splitTime(trimmed).rest.split(/[/\-.]/);
    if (parts.length !== 3 || parts[0].length === 4) continue;
    if (!parts.every((p) => /^\d+$/.test(p.trim()))) continue;
    const [a, b] = parts.map(Number);
    // A number above 12 can only be a day, which decides the whole column.
    if (a > 12 || b > 12) return false;
    sawAmbiguous = true;
  }
  return sawAmbiguous;
}

/**
 * Picks a status for a file that has no status column, from the one thing every
 * booking sheet does carry: the date.
 *
 * The unpaid-past branch is load-bearing. The import route refuses a
 * `completed` booking whose deposit plus paid payments does not settle the
 * total, so inferring "completed" from the date alone would manufacture the
 * very failure this feature exists to remove. Such a booking imports as
 * `booked` and the owner completes it once the money is recorded.
 */
export function inferStatus(input: {
  endAt: Date;
  now: Date;
  amountTotal?: number;
  amountDeposit?: number;
  payments?: { price: number; status: "paid" | "unpaid" }[];
}): "booked" | "completed" {
  if (input.endAt.getTime() > input.now.getTime()) return "booked";
  const eligible = isCompletionEligible(input.payments ?? [], {
    total: input.amountTotal ?? 0,
    deposit: input.amountDeposit ?? 0,
  });
  return eligible ? "completed" : "booked";
}
