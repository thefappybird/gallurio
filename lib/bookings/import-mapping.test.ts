import { describe, expect, it } from "vitest";
import {
  MAPPABLE_FIELDS,
  applyMapping,
  autoMapColumns,
  collectUnmappedEnumValues,
  requiredFieldsSatisfied,
} from "./import-mapping";
import { IMPORT_COLUMNS, IMPORT_TEMPLATE_HEADERS } from "./import-template";

describe("MAPPABLE_FIELDS", () => {
  it("covers every importable column, keyed by the name the schema reads", () => {
    // IMPORT_COLUMNS stays the source of truth for WHICH columns exist; this
    // list only adds kind/group metadata. The template's header names are not
    // always the schema key — booking_id is read as bookingId.
    expect(MAPPABLE_FIELDS).toHaveLength(IMPORT_COLUMNS.length);
    expect(MAPPABLE_FIELDS.map((f) => f.key)).toEqual([
      "clientName",
      "clientEmail",
      "startAt",
      "endAt",
      "title",
      "eventType",
      "status",
      "amountTotal",
      "amountDeposit",
      "currency",
      "locationAddress",
      "notes",
      "bookingId",
      "sessionIndex",
      "clientId",
      "clientPhone",
      "locationLat",
      "locationLng",
      "payments",
    ]);
    expect(MAPPABLE_FIELDS.filter((f) => f.required).map((f) => f.key)).toEqual([
      "clientName",
      "startAt",
      "title",
    ]);
  });
});

describe("autoMapColumns", () => {
  it("maps every column of our own template, so a round-trip needs no input", () => {
    const mapping = autoMapColumns([...IMPORT_TEMPLATE_HEADERS]);
    for (const field of MAPPABLE_FIELDS) {
      expect(mapping[field.key], `expected ${field.key} to auto-map`).toEqual({
        source: field.label,
      });
    }
  });
});

describe("autoMapColumns with a foreign file", () => {
  // The exact shape a photographer migrating off another CRM arrives with.
  const HEADERS = [
    "Customer",
    "Email Address",
    "Event",
    "Date",
    "End Date",
    "Package Price",
    "Deposit Paid",
    "Deal Status",
    "Venue",
  ];

  it("recognises common synonyms for our field names", () => {
    const m = autoMapColumns(HEADERS);
    expect(m.clientName).toEqual({ source: "Customer" });
    expect(m.clientEmail).toEqual({ source: "Email Address" });
    expect(m.title).toEqual({ source: "Event" });
    expect(m.amountTotal).toEqual({ source: "Package Price" });
    expect(m.amountDeposit).toEqual({ source: "Deposit Paid" });
    expect(m.status).toEqual({ source: "Deal Status" });
    expect(m.locationAddress).toEqual({ source: "Venue" });
  });

  it("does not let a generic field steal a qualified column", () => {
    // "End Date" contains "date", so startAt would swallow it and endAt would
    // be left empty — silently importing every booking as zero-length.
    const m = autoMapColumns(HEADERS);
    expect(m.startAt).toEqual({ source: "Date" });
    expect(m.endAt).toEqual({ source: "End Date" });
  });

  it("still maps end-before-start ordering, which reads the other way round", () => {
    const m = autoMapColumns(["End Date", "Date", "Customer"]);
    expect(m.endAt).toEqual({ source: "End Date" });
    expect(m.startAt).toEqual({ source: "Date" });
  });

  it("leaves a column it cannot place unassigned rather than guessing", () => {
    const m = autoMapColumns(["Customer", "Internal Ref Code"]);
    expect(m.clientName).toEqual({ source: "Customer" });
    for (const [key, assignment] of Object.entries(m)) {
      if (key !== "clientName") expect(assignment).toBeNull();
    }
  });
});

describe("requiredFieldsSatisfied", () => {
  it("is true only when all three required fields have an assignment", () => {
    const empty = autoMapColumns([]);
    expect(requiredFieldsSatisfied(empty)).toBe(false);
    expect(requiredFieldsSatisfied(autoMapColumns(["Customer", "Date"]))).toBe(false);
    expect(
      requiredFieldsSatisfied(autoMapColumns(["Customer", "Date", "Event"]))
    ).toBe(true);
  });

  it("accepts a fixed value as satisfying a required field", () => {
    // A file with one client per sheet has no name column; typing it once is a
    // legitimate answer, not a missing mapping.
    const m = autoMapColumns(["Date", "Event"]);
    m.clientName = { constant: "Jane Smith" };
    expect(requiredFieldsSatisfied(m)).toBe(true);
  });
});

describe("applyMapping", () => {
  const TZ = "Asia/Manila";
  const OPTS = { timeZone: TZ, dateOrder: "MDY" as const, now: new Date("2026-06-20T00:00:00Z") };

  const HEADERS = ["Customer", "Event", "Date", "Package Price", "Deal Status"];
  const ROWS = [
    {
      Customer: "Jane Smith",
      Event: "Smith Wedding",
      Date: "06/15/2026",
      "Package Price": "₱50,000.00",
      "Deal Status": "Confirmed",
    },
  ];

  it("rekeys columns to schema field names and coerces their values", () => {
    const m = autoMapColumns(HEADERS);
    const [row] = applyMapping(ROWS, m, { ...OPTS, valueMap: { status: { Confirmed: "booked" } } });
    expect(row.issues).toEqual([]);
    expect(row.values.clientName).toBe("Jane Smith");
    expect(row.values.title).toBe("Smith Wedding");
    expect(row.values.startAt).toBe("2026-06-14T16:00:00.000Z");
    expect(row.values.amountTotal).toBe("50000");
    expect(row.values.status).toBe("booked");
  });

  it("writes a fixed value into every row", () => {
    const m = autoMapColumns(HEADERS);
    m.currency = { constant: "PHP" };
    const [row] = applyMapping(ROWS, m, { ...OPTS, valueMap: { status: { Confirmed: "booked" } } });
    expect(row.values.currency).toBe("PHP");
  });

  it("reports a value it cannot read instead of dropping it silently", () => {
    const m = autoMapColumns(HEADERS);
    const [row] = applyMapping(
      [{ ...ROWS[0], "Package Price": "to be confirmed", "Deal Status": "Confirmed" }],
      m,
      { ...OPTS, valueMap: { status: { Confirmed: "booked" } } }
    );
    expect(row.issues).toContainEqual({ field: "amountTotal", reason: "not_a_number" });
  });

  it("reports an enum value nobody mapped, which is what the value step prevents", () => {
    const m = autoMapColumns(HEADERS);
    const [row] = applyMapping(ROWS, m, OPTS);
    expect(row.issues).toContainEqual({ field: "status", reason: "unrecognized_value" });
  });

  it("infers status from the session date when asked to", () => {
    const m = autoMapColumns(HEADERS);
    m.status = { infer: true };
    const pastPaid = applyMapping(
      [{ ...ROWS[0], Date: "01/15/2026" }],
      { ...m, amountTotal: null },
      OPTS
    );
    expect(pastPaid[0].values.status).toBe("completed");
    const future = applyMapping(
      [{ ...ROWS[0], Date: "12/15/2026" }],
      { ...m, amountTotal: null },
      OPTS
    );
    expect(future[0].values.status).toBe("booked");
  });

  it("leaves an unpaid past booking as booked so the route will accept it", () => {
    const m = autoMapColumns(HEADERS);
    m.status = { infer: true };
    m.amountDeposit = { constant: "10000" };
    const [row] = applyMapping([{ ...ROWS[0], Date: "01/15/2026" }], m, OPTS);
    expect(row.values.amountTotal).toBe("50000");
    expect(row.values.status).toBe("booked");
  });
});

describe("collectUnmappedEnumValues", () => {
  it("lists each unrecognized value once, with how many rows carry it", () => {
    const m = autoMapColumns(["Customer", "Event", "Date", "Deal Status"]);
    const rows = [
      { Customer: "A", Event: "E", Date: "06/15/2026", "Deal Status": "Confirmed" },
      { Customer: "B", Event: "E", Date: "06/16/2026", "Deal Status": "Confirmed" },
      { Customer: "C", Event: "E", Date: "06/17/2026", "Deal Status": "booked" },
      { Customer: "D", Event: "E", Date: "06/18/2026", "Deal Status": "Pencilled in" },
    ];
    expect(collectUnmappedEnumValues(rows, m)).toEqual([
      { field: "status", value: "Confirmed", count: 2, suggestion: "booked" },
      { field: "status", value: "Pencilled in", count: 1, suggestion: null },
    ]);
  });

  it("says nothing when every value already matches", () => {
    const m = autoMapColumns(["Customer", "Event", "Date", "Deal Status"]);
    const rows = [{ Customer: "A", Event: "E", Date: "06/15/2026", "Deal Status": "cancelled" }];
    expect(collectUnmappedEnumValues(rows, m)).toEqual([]);
  });
});
