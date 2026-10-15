import { z } from "zod";
import { BOOKING_STATUSES, EVENT_TYPES } from "@/lib/validators/booking";
import {
  coerceCurrency,
  coerceDate,
  coerceMoney,
  inferStatus,
  type CoerceFailure,
  type DateOrder,
} from "./import-normalize";
import { normalizeCsvHeader, stripFormulaGuard } from "@/lib/utils/csv-parse";
import { IMPORT_COLUMNS } from "./import-template";

/**
 * Column mapping: the seam between "whatever columns their file has" and the
 * field names `bookingImportRowSchema` reads.
 *
 * The importer used to match the two with a fixed alias table, so an
 * unrecognized header was silently dropped and its row failed on a missing
 * required field. Here the user assigns the columns themselves, and this module
 * turns that assignment into canonical rows. It is pure and runs in the
 * browser; the route still validates everything it is handed.
 */

/** Drives value coercion (see import-normalize.ts) and the picker's type badge. */
export type FieldKind = "text" | "date" | "money" | "number" | "enum" | "json";

/** Where the field sits in the mapping UI's three sections. */
export type FieldGroup = "required" | "common" | "advanced";

export type MappableField = {
  /** The key `bookingImportRowSchema` reads — not always the template header. */
  key: string;
  /** The template's header name, shown as the field's label. */
  label: string;
  required: boolean;
  kind: FieldKind;
  group: FieldGroup;
  /** Whether "no column — use this fixed value" is offered for this field. */
  constantAllowed: boolean;
  /** Whether several columns may be joined into this field (free text only). */
  combinable: boolean;
};

const KIND: Record<string, FieldKind> = {
  startAt: "date",
  endAt: "date",
  eventType: "enum",
  status: "enum",
  currency: "enum",
  amountTotal: "money",
  amountDeposit: "money",
  locationLat: "number",
  locationLng: "number",
  payments: "json",
};

const GROUP: Record<string, FieldGroup> = {
  bookingId: "advanced",
  sessionIndex: "advanced",
  clientId: "advanced",
  payments: "advanced",
  locationLat: "advanced",
  locationLng: "advanced",
};

/**
 * Fields a fixed value must never be offered for. A single `bookingId` shared
 * across every row would collapse the whole file into one booking; the others
 * are identities or structured data where one repeated value is meaningless.
 */
const CONSTANT_FORBIDDEN = new Set([
  "bookingId",
  "sessionIndex",
  "clientId",
  "payments",
  "locationLat",
  "locationLng",
]);

/** Schema-required fields the importer fills itself when left unmapped. */
const AUTO_FILLED = new Set(["title"]);

/**
 * One entry per importable column. `IMPORT_COLUMNS` stays the source of truth
 * for which columns exist; this adds only the metadata the mapping UI needs.
 */
export const MAPPABLE_FIELDS: readonly MappableField[] = IMPORT_COLUMNS.map((col) => {
  const key = normalizeCsvHeader(col.name);
  const kind = KIND[key] ?? "text";
  // The schema requires a title, but applyMapping's titleFallback generates one
  // when it is unmapped, so for mapping purposes it is optional.
  const required = col.required && !AUTO_FILLED.has(key);
  return {
    key,
    label: col.name,
    required,
    kind,
    group: required ? "required" : (GROUP[key] ?? "common"),
    constantAllowed: !CONSTANT_FORBIDDEN.has(key),
    // Joining only makes sense for prose; an email, phone or id is one value.
    combinable:
      kind === "text" && !CONSTANT_FORBIDDEN.has(key) && key !== "clientEmail" && key !== "clientPhone",
  };
});

/**
 * What a target field is filled from: a column, a fixed value, a rule, or
 * nothing. `infer` is offered for `status` alone, where the session date plus
 * the payment state answer the question better than any single column would.
 */
export type Assignment =
  | { source: string }
  | { sources: string[] }
  | { constant: string }
  | { infer: true }
  | null;

/** The source columns an assignment reads, so the UI counts them uniformly. */
export function assignmentSources(a: Assignment): string[] {
  if (!a) return [];
  if ("source" in a) return [a.source];
  if ("sources" in a) return a.sources;
  return [];
}

/** Target field key -> assignment. Every MAPPABLE_FIELDS key is present. */
export type ColumnMapping = Record<string, Assignment>;

/** Collapses punctuation and case so "Client Name" and "client_name" agree. */
function loose(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

/** Splits a header into lowercase words: "Deposit Paid" -> ["deposit","paid"]. */
function tokens(header: string): string[] {
  return header
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

/**
 * The vocabulary other CRMs and hand-kept spreadsheets actually use. `avoid`
 * exists because several of our fields are the generic half of a pair: without
 * it "End Date" matches startAt's `date` and endAt is left empty, which imports
 * every booking as zero-length instead of failing loudly.
 */
const FIRST_WORDS = ["first", "given", "fname", "firstname"];
const LAST_WORDS = ["last", "surname", "family", "lname", "lastname"];

const SYNONYMS: Record<string, { match: string[]; avoid?: string[] }> = {
  clientName: {
    match: ["client", "customer", "name", "contact", "guest"],
    // Half of a name is not the name; the pair rule in autoMapColumns joins them.
    avoid: [...FIRST_WORDS, ...LAST_WORDS],
  },
  clientEmail: { match: ["email", "mail"] },
  clientPhone: { match: ["phone", "mobile", "tel", "cell"] },
  startAt: {
    match: ["start", "date", "when", "begin", "from", "schedule"],
    avoid: ["end", "finish", "until", "through", "created", "updated"],
  },
  endAt: { match: ["end", "finish", "until", "through"] },
  title: { match: ["title", "event", "booking", "job", "summary", "description"] },
  eventType: {
    match: ["type", "category", "service", "package", "kind"],
    // "Package" names a service tier, but "Package Price" names money.
    avoid: ["price", "cost", "amount", "total", "fee", "value", "rate"],
  },
  status: { match: ["status", "stage", "state", "deal"] },
  amountTotal: {
    match: ["total", "amount", "price", "value", "fee", "cost"],
    avoid: ["deposit", "downpayment", "retainer", "balance", "due", "paid"],
  },
  amountDeposit: { match: ["deposit", "downpayment", "retainer", "advance"] },
  currency: { match: ["currency"] },
  locationAddress: { match: ["location", "address", "venue", "place", "where", "site"] },
  notes: { match: ["notes", "note", "remarks", "comments", "memo"] },
};

/**
 * Best-effort initial mapping, so a file that already speaks our language needs
 * no input at all and a foreign one starts part-filled rather than empty.
 *
 * Each source column is consumed by at most one field, and the ladder runs one
 * rung at a time across ALL fields before falling to the next: an exact match
 * elsewhere must win over a fuzzy match here, or "End Date" gets eaten by
 * startAt's token rule before endAt ever sees it.
 */
export function autoMapColumns(rawHeaders: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const field of MAPPABLE_FIELDS) mapping[field.key] = null;

  const available = rawHeaders.filter(Boolean);
  const taken = new Set<string>();

  const claim = (fieldKey: string, header: string) => {
    mapping[fieldKey] = { source: header };
    taken.add(header);
  };

  const pass = (matches: (field: MappableField, header: string) => boolean) => {
    for (const field of MAPPABLE_FIELDS) {
      if (mapping[field.key]) continue;
      const hit = available.find((h) => !taken.has(h) && matches(field, h));
      if (hit) claim(field.key, hit);
    }
  };

  // 1. The alias table the importer has always used.
  pass((field, header) => normalizeCsvHeader(header) === field.key);
  // 2. Same words, different punctuation or casing.
  pass(
    (field, header) =>
      loose(header) === loose(field.key) || loose(header) === loose(field.label)
  );
  // 2b. A first-name + last-name pair is one clientName, joined at import time.
  //     Only a real "<first|given> name" / "<last|surname|family> name" header (or
  //     fname/lname) counts — "First Contact" is not half a name — and a plain
  //     name column ("Customer") makes the pair unnecessary.
  const hasNameColumn = () => {
    const rule = SYNONYMS.clientName;
    // "Event Name" / "Company Name" name something else; only a header that
    // names the client counts: client/customer/contact/guest, or just "name".
    return available.some(
      (h) =>
        !taken.has(h) &&
        !tokens(h).some((w) => rule.avoid?.includes(w)) &&
        (["name", "fullname"].includes(loose(h)) ||
          tokens(h).some((w) => w !== "name" && rule.match.includes(w)))
    );
  };
  if (!mapping.clientName && !hasNameColumn()) {
    const isHalf = (h: string, words: string[], exact: string[]) => {
      const t = tokens(h);
      return exact.includes(loose(h)) || (t.includes("name") && t.some((w) => words.includes(w)));
    };
    const pick = (words: string[], exact: string[]) =>
      available.find((h) => !taken.has(h) && isHalf(h, words, exact));
    const first = pick(["first", "given"], ["fname", "firstname", "givenname"]);
    if (first) taken.add(first);
    const last = pick(["last", "surname", "family"], ["lname", "lastname", "surname", "familyname"]);
    if (first && last) {
      mapping.clientName = { sources: [first, last] };
      taken.add(last);
    } else if (first) {
      taken.delete(first);
    }
  }
  // 3. Whole-word synonyms. Qualified fields (endAt, amountDeposit) run before
  //    their generic siblings so they claim their column first, and the generic
  //    ones additionally refuse a header carrying the qualifier.
  const GENERIC_SIBLINGS = new Set(["startAt", "eventType", "amountTotal"]);
  const synonymOrder = [...MAPPABLE_FIELDS].sort(
    (a, b) => (GENERIC_SIBLINGS.has(a.key) ? 1 : 0) - (GENERIC_SIBLINGS.has(b.key) ? 1 : 0)
  );
  for (const field of synonymOrder) {
    if (mapping[field.key]) continue;
    const rule = SYNONYMS[field.key];
    if (!rule) continue;
    const hit = available.find((h) => {
      if (taken.has(h)) return false;
      const words = tokens(h);
      if (rule.avoid?.some((a) => words.includes(a))) return false;
      return rule.match.some((m) => words.includes(m));
    });
    if (hit) claim(field.key, hit);
  }

  return mapping;
}

/**
 * Whether the mapping can produce importable rows at all. A fixed value counts:
 * a sheet covering one client has no name column, and typing the name once is a
 * real answer rather than a gap.
 */
export function requiredFieldsSatisfied(mapping: ColumnMapping): boolean {
  return MAPPABLE_FIELDS.filter((f) => f.required).every((f) => mapping[f.key] != null);
}

/** The enum members each choice field accepts, for value matching. */
const ENUM_MEMBERS: Record<string, readonly string[]> = {
  status: BOOKING_STATUSES,
  eventType: EVENT_TYPES,
};

/** What a sheet is likely to call each of our status and event-type members. */
const VALUE_SUGGESTIONS: Record<string, Record<string, string>> = {
  status: {
    confirmed: "booked", booked: "booked", reserved: "booked", scheduled: "booked",
    pending: "booked", upcoming: "booked", deposit: "booked",
    completed: "completed", complete: "completed", done: "completed",
    delivered: "completed", finished: "completed", paid: "completed",
    cancelled: "cancelled", canceled: "cancelled", lost: "cancelled",
    declined: "cancelled", refunded: "cancelled",
  },
  eventType: {
    wedding: "wedding", bridal: "wedding", nuptials: "wedding",
    corporate: "corporate", business: "corporate", company: "corporate",
    portrait: "portrait", headshot: "portrait", portraits: "portrait",
    engagement: "engagement", prenup: "engagement", proposal: "engagement",
    anniversary: "anniversary",
  },
};

export type MappedRowIssue = {
  field: string;
  /** The cell text that could not be read, so the error can quote it back. */
  value: string;
  reason: CoerceFailure;
};

/** Why a cell was dropped, blanked or adjusted without failing its row. */
export type NoteReason = "amount_dropped" | "currency_dropped" | "end_date_dropped" | "email_dropped" | "event_type_blank" | "status_inferred" | "truncated" | "phone_dropped" | "deposit_dropped";

/** A non-blocking adjustment the preview can surface next to the row. */
export type MappedRowNote = { field: string; value: string; reason: NoteReason };

export type MappedRow = {
  /** Canonical field keys, ready for `bookingImportRowSchema`. */
  values: Record<string, string>;
  /** Blocking problems only: cells the row cannot import without. */
  issues: MappedRowIssue[];
  /** Cells that were dropped or adjusted so the row could still import. */
  notes: MappedRowNote[];
};

export type ApplyMappingOptions = {
  timeZone: string;
  dateOrder: DateOrder;
  /** field key -> the file's value -> our value. "" means import it blank. */
  valueMap?: Record<string, Record<string, string>>;
  now?: Date;
  /** Builds a title for a row whose own title cell is empty (title is required). */
  titleFallback?: (values: Record<string, string>) => string;
};

const emailSchema = z.string().email();

/** `bookingImportRowSchema` caps clientPhone at 30 characters. */
const PHONE_MAX = 30;

/** The caps `bookingImportRowSchema` enforces on free text. */
const TEXT_MAX: Record<string, number> = {
  title: 160,
  clientName: 120,
  locationAddress: 240,
  notes: 2000,
};

/** Resolves an enum cell against our members, then the user's value mapping. */
function resolveEnum(
  fieldKey: string,
  raw: string,
  valueMap: ApplyMappingOptions["valueMap"]
): { value: string } | null {
  const members = ENUM_MEMBERS[fieldKey];
  if (!members) return { value: raw };
  const direct = members.find((m) => m.toLowerCase() === raw.trim().toLowerCase());
  if (direct) return { value: direct };
  const mapped = valueMap?.[fieldKey]?.[raw];
  // "" is a deliberate "import this blank", not an absent mapping.
  if (mapped !== undefined) return { value: mapped };
  return null;
}

/**
 * Turns the user's column assignments into rows the import schema can read.
 *
 * Only an unreadable start date blocks a row (`issues`). Every other bad cell is
 * dropped, blanked or trimmed and recorded in `notes`, so the preview can say
 * what changed instead of failing a booking over a stray amount or email.
 */
export function applyMapping(
  rows: readonly Record<string, string>[],
  mapping: ColumnMapping,
  opts: ApplyMappingOptions
): MappedRow[] {
  const now = opts.now ?? new Date();

  return rows.map((source) => {
    const values: Record<string, string> = {};
    const issues: MappedRowIssue[] = [];
    const notes: MappedRowNote[] = [];
    // A status cell nobody mapped; settled after the loop, once dates are known.
    let unknownStatus = "";
    let depositCell = "";

    for (const field of MAPPABLE_FIELDS) {
      const assignment = mapping[field.key];
      if (!assignment || "infer" in assignment) continue;

      const read = (v: string | undefined) => stripFormulaGuard(v ?? "").trim();
      const cell =
        "constant" in assignment
          ? read(assignment.constant)
          : "sources" in assignment
            ? assignment.sources.map((s) => read(source[s])).filter(Boolean).join(" ")
            : read(source[assignment.source]);
      if (!cell) continue;
      if (field.key === "amountDeposit") depositCell = cell;

      if (field.kind === "enum") {
        const resolved = resolveEnum(field.key, cell, opts.valueMap);
        if (!resolved) {
          if (field.key === "status") unknownStatus = cell;
          else notes.push({ field: field.key, value: cell, reason: "event_type_blank" });
          continue;
        }
        // currency has no member list here; normalize it the same as any cell.
        if (field.key === "currency") {
          const c = coerceCurrency(resolved.value);
          if (!c.ok) notes.push({ field: field.key, value: cell, reason: "currency_dropped" });
          else if (c.value) values[field.key] = c.value;
          continue;
        }
        if (resolved.value) values[field.key] = resolved.value;
        continue;
      }

      const coerced =
        field.kind === "date"
          ? coerceDate(cell, opts.timeZone, opts.dateOrder)
          : field.kind === "money"
            ? coerceMoney(cell)
            : { ok: true as const, value: cell };

      if (!coerced.ok) {
        // An unreadable amount is dropped; an unreadable start date blocks the row.
        if (field.kind === "money") {
          notes.push({ field: field.key, value: cell, reason: "amount_dropped" });
        } else if (field.key === "endAt") {
          notes.push({ field: field.key, value: cell, reason: "end_date_dropped" });
        } else {
          issues.push({ field: field.key, value: cell, reason: coerced.reason });
        }
      } else if (field.key === "clientEmail" && !emailSchema.safeParse(coerced.value).success) {
        // The route's schema rejects a malformed email; the booking matters more.
        notes.push({ field: field.key, value: cell, reason: "email_dropped" });
      } else if (field.key === "clientPhone" && coerced.value.length > PHONE_MAX) {
        // A truncated number is a wrong number; drop it and keep the booking.
        notes.push({ field: field.key, value: cell, reason: "phone_dropped" });
      } else if (coerced.value) {
        const max = TEXT_MAX[field.key];
        if (max && coerced.value.length > max) {
          notes.push({ field: field.key, value: cell, reason: "truncated" });
          let cut = coerced.value.slice(0, max);
          // Never leave half a surrogate pair (an emoji) at the cut.
          const last = cut.charCodeAt(cut.length - 1);
          if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
          values[field.key] = cut;
        } else values[field.key] = coerced.value;
      }
    }

    // Mirrors bookingImportRowSchema: a non-zero deposit needs a total, and may not
    // exceed it. Total can be dropped above, so this runs after the loop.
    const deposit = Number(values.amountDeposit);
    if (values.amountDeposit && deposit > 0) {
      const total = Number(values.amountTotal ?? 0);
      if (total <= 0 || deposit > total) {
        notes.push({ field: "amountDeposit", value: depositCell, reason: "deposit_dropped" });
        delete values.amountDeposit;
      }
    }

    // Inference runs last: it reads the dates and amounts resolved above.
    const status = mapping.status;
    const infers = status && "infer" in status;
    if ((infers || unknownStatus) && values.startAt) {
      values.status = inferStatus({
        endAt: new Date(values.endAt || values.startAt),
        now,
        amountTotal: values.amountTotal ? Number(values.amountTotal) : 0,
        amountDeposit: values.amountDeposit ? Number(values.amountDeposit) : 0,
      });
    }
    if (unknownStatus) notes.push({ field: "status", value: unknownStatus, reason: "status_inferred" });

    if (!values.title && opts.titleFallback) {
      values.title = opts.titleFallback(values).slice(0, TEXT_MAX.title);    }

    return { values, issues, notes };
  });
}

export type UnmappedEnumValue = {
  field: string;
  value: string;
  count: number;
  /** Our best guess, or null when the user has to decide unaided. */
  suggestion: string | null;
};

/**
 * The distinct values in the file's choice columns that mean nothing to us yet.
 *
 * These drive the value-matching step: mapping "Confirmed" once is the
 * difference between importing 14 bookings and reporting 14 failures.
 */
export function collectUnmappedEnumValues(
  rows: readonly Record<string, string>[],
  mapping: ColumnMapping
): UnmappedEnumValue[] {
  const out: UnmappedEnumValue[] = [];

  for (const field of MAPPABLE_FIELDS) {
    const members = ENUM_MEMBERS[field.key];
    const assignment = mapping[field.key];
    if (!members || !assignment || !("source" in assignment)) continue;

    const counts = new Map<string, number>();
    for (const row of rows) {
      const cell = stripFormulaGuard(row[assignment.source] ?? "").trim();
      if (!cell) continue;
      if (members.some((m) => m.toLowerCase() === cell.toLowerCase())) continue;
      counts.set(cell, (counts.get(cell) ?? 0) + 1);
    }

    for (const [value, count] of counts) {
      out.push({
        field: field.key,
        value,
        count,
        suggestion: VALUE_SUGGESTIONS[field.key]?.[value.trim().toLowerCase()] ?? null,
      });
    }
  }

  return out;
}
