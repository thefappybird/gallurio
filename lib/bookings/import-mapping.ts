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

/**
 * One entry per importable column. `IMPORT_COLUMNS` stays the source of truth
 * for which columns exist; this adds only the metadata the mapping UI needs.
 */
export const MAPPABLE_FIELDS: readonly MappableField[] = IMPORT_COLUMNS.map((col) => {
  const key = normalizeCsvHeader(col.name);
  return {
    key,
    label: col.name,
    required: col.required,
    kind: KIND[key] ?? "text",
    group: col.required ? "required" : (GROUP[key] ?? "common"),
    constantAllowed: !CONSTANT_FORBIDDEN.has(key),
  };
});

/**
 * What a target field is filled from: a column, a fixed value, a rule, or
 * nothing. `infer` is offered for `status` alone, where the session date plus
 * the payment state answer the question better than any single column would.
 */
export type Assignment =
  | { source: string }
  | { constant: string }
  | { infer: true }
  | null;

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
const SYNONYMS: Record<string, { match: string[]; avoid?: string[] }> = {
  clientName: { match: ["client", "customer", "name", "contact", "guest"] },
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
  // 3. Whole-word synonyms. Qualified fields (endAt, amountDeposit) run before
  //    their generic siblings so they claim their column first, and the generic
  //    ones additionally refuse a header carrying the qualifier.
  const synonymOrder = [...MAPPABLE_FIELDS].sort(
    (a, b) => (SYNONYMS[a.key]?.avoid ? 1 : 0) - (SYNONYMS[b.key]?.avoid ? 1 : 0)
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
  reason: CoerceFailure | "unrecognized_value";
};

export type MappedRow = {
  /** Canonical field keys, ready for `bookingImportRowSchema`. */
  values: Record<string, string>;
  /** Cells that could not be normalized. The preview shows these as row errors. */
  issues: MappedRowIssue[];
};

export type ApplyMappingOptions = {
  timeZone: string;
  dateOrder: DateOrder;
  /** field key -> the file's value -> our value. "" means import it blank. */
  valueMap?: Record<string, Record<string, string>>;
  now?: Date;
};

/** Resolves an enum cell against our members, then the user's value mapping. */
function resolveEnum(
  fieldKey: string,
  raw: string,
  valueMap: ApplyMappingOptions["valueMap"]
): { value: string } | { issue: "unrecognized_value" } {
  const members = ENUM_MEMBERS[fieldKey];
  if (!members) return { value: raw };
  const direct = members.find((m) => m.toLowerCase() === raw.trim().toLowerCase());
  if (direct) return { value: direct };
  const mapped = valueMap?.[fieldKey]?.[raw];
  // "" is a deliberate "import this blank", not an absent mapping.
  if (mapped !== undefined) return { value: mapped };
  return { issue: "unrecognized_value" };
}

/**
 * Turns the user's column assignments into rows the import schema can read.
 *
 * A cell that cannot be normalized is reported rather than dropped: a silently
 * missing amount is indistinguishable from one the user never entered, and the
 * whole point of this step is that nothing fails without saying why.
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

    for (const field of MAPPABLE_FIELDS) {
      const assignment = mapping[field.key];
      if (!assignment || "infer" in assignment) continue;

      const raw =
        "constant" in assignment ? assignment.constant : (source[assignment.source] ?? "");
      const cell = stripFormulaGuard(raw).trim();
      if (!cell) continue;

      if (field.kind === "enum") {
        const resolved = resolveEnum(field.key, cell, opts.valueMap);
        if ("issue" in resolved) {
          issues.push({ field: field.key, value: cell, reason: resolved.issue });
          continue;
        }
        // currency has no member list here; normalize it the same as any cell.
        if (field.key === "currency") {
          const c = coerceCurrency(resolved.value);
          if (!c.ok) issues.push({ field: field.key, value: cell, reason: c.reason });
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

      if (!coerced.ok) issues.push({ field: field.key, value: cell, reason: coerced.reason });
      else if (coerced.value) values[field.key] = coerced.value;
    }

    // Inference runs last: it reads the dates and amounts resolved above.
    const status = mapping.status;
    if (status && "infer" in status && values.startAt) {
      values.status = inferStatus({
        endAt: new Date(values.endAt || values.startAt),
        now,
        amountTotal: values.amountTotal ? Number(values.amountTotal) : 0,
        amountDeposit: values.amountDeposit ? Number(values.amountDeposit) : 0,
      });
    }

    return { values, issues };
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
