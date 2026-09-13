import { normalizeCsvHeader } from "@/lib/utils/csv-parse";
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

/** What a target field is filled from: a column, a fixed value, or nothing. */
export type Assignment = { source: string } | { constant: string } | null;

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
