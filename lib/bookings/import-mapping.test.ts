import { describe, expect, it } from "vitest";
import {
  MAPPABLE_FIELDS,
  applyMapping,
  assignmentSources,
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
    ]);
  });

  it("treats title as optional, since the importer generates one when it is unmapped", () => {
    const title = MAPPABLE_FIELDS.find((f) => f.key === "title");
    expect(title?.required).toBe(false);
    expect(title?.group).toBe("common");
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

  it("maps 'Event Date' to startAt, not title", () => {
    const m = autoMapColumns([
      "Customer", "E-mail", "Event Date", "Package", "Package Price", "Deposit Paid", "Venue", "Remarks",
    ]);
    expect(m.startAt).toEqual({ source: "Event Date" });
    expect(m.title).toBeNull();
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
  it("is true only when the name and start date have an assignment; title may stay unmapped", () => {
    const empty = autoMapColumns([]);
    expect(requiredFieldsSatisfied(empty)).toBe(false);
    expect(requiredFieldsSatisfied(autoMapColumns(["Customer"]))).toBe(false);
    expect(requiredFieldsSatisfied(autoMapColumns(["Customer", "Date"]))).toBe(true);
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

  it("drops an unreadable amount with a note instead of failing the row", () => {
    const m = autoMapColumns(HEADERS);
    const [row] = applyMapping(
      [{ ...ROWS[0], "Package Price": "to be confirmed", "Deal Status": "Confirmed" }],
      m,
      { ...OPTS, valueMap: { status: { Confirmed: "booked" } } }
    );
    expect(row.issues).toEqual([]);
    expect(row.values.amountTotal).toBeUndefined();
    expect(row.notes).toContainEqual({
      field: "amountTotal",
      value: "to be confirmed",
      reason: "amount_dropped",
    });
  });

  it("infers a status for a value nobody mapped, and says so", () => {
    const m = autoMapColumns(HEADERS);
    const [row] = applyMapping(ROWS, m, OPTS);
    expect(row.issues).toEqual([]);
    // Past but unpaid, so inference keeps it booked rather than completed.
    expect(row.values.status).toBe("booked");
    expect(row.notes).toContainEqual({
      field: "status",
      value: "Confirmed",
      reason: "status_inferred",
    });
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

describe("combined columns", () => {
  const OPTS = { timeZone: "Asia/Manila", dateOrder: "MDY" as const };

  it("joins the non-blank cells of several source columns with a space", () => {
    const m = autoMapColumns([]);
    m.clientName = { sources: ["First", "Last"] };
    const [row] = applyMapping([{ First: "Jane", Last: " Smith " }], m, OPTS);
    expect(row.values.clientName).toBe("Jane Smith");
    expect(assignmentSources(m.clientName)).toEqual(["First", "Last"]);
  });
});

describe("combinable fields", () => {
  it("allows free text only, never email or identities", () => {
    const keys = MAPPABLE_FIELDS.filter((f) => f.combinable).map((f) => f.key).sort();
    expect(keys).toEqual(["clientName", "locationAddress", "notes", "title"]);
  });
});

describe("autoMapColumns first/last name", () => {
  it("combines a first-name and last-name column into clientName", () => {
    const m = autoMapColumns(["First Name", "Last Name", "Date", "Event"]);
    expect(m.clientName).toEqual({ sources: ["First Name", "Last Name"] });
  });
});

describe("autoMapColumns name pairing false positives", () => {
  it("does not read First Contact / Last Updated as a name pair when a name column exists", () => {
    const m = autoMapColumns(["Customer", "Event Date", "First Contact", "Last Updated"]);
    expect(m.clientName).toEqual({ source: "Customer" });
  });

  it("does not pair headers that only contain first/last without a name word", () => {
    const m = autoMapColumns(["First Contact", "Last Updated", "Date"]);
    expect(m.clientName).toBeNull();
  });

  it("pairs Given name / Surname and fname / lname", () => {
    expect(autoMapColumns(["Given name", "Family Name"]).clientName).toEqual({ sources: ["Given name", "Family Name"] });
    expect(autoMapColumns(["fname", "lname"]).clientName).toEqual({ sources: ["fname", "lname"] });
    expect(autoMapColumns(["FirstName", "Surname"]).clientName).toEqual({ sources: ["FirstName", "Surname"] });
  });
});

describe("autoMapColumns qualified name headers", () => {
  it("does not let Event Name block a first/last pairing", () => {
    const m = autoMapColumns(["Event Name", "First Name", "Last Name", "Date"]);
    expect(m.clientName).toEqual({ sources: ["First Name", "Last Name"] });
    expect(m.title).toEqual({ source: "Event Name" });
  });

  it("keeps clientName ahead of title for a qualified contact header", () => {
    const m = autoMapColumns(["Event Contact", "Date"]);
    expect(m.clientName).toEqual({ source: "Event Contact" });
  });
});

describe("autoMapColumns lone name half", () => {
  it("does not map a lone first-name column to clientName", () => {
    const m = autoMapColumns(["First Name", "Date", "Event"]);
    expect(m.clientName).toBeNull();
  });
});

describe("applyMapping leniency", () => {
  const OPTS = { timeZone: "Asia/Manila", dateOrder: "MDY" as const, now: new Date("2026-06-20T00:00:00Z") };
  const BASE = { clientName: "Jane", title: "Wedding", startAt: "06/15/2026" };
  const m = () => {
    const mapping = autoMapColumns([]);
    for (const k of ["clientName", "title", "startAt", "endAt", "clientEmail", "currency", "eventType", "status", "notes"]) {
      mapping[k] = { source: k };
    }
    return mapping;
  };

  it("drops an unreadable end date with a note", () => {
    const [row] = applyMapping([{ ...BASE, endAt: "later" }], m(), OPTS);
    expect(row.issues).toEqual([]);
    expect(row.values.endAt).toBeUndefined();
    expect(row.notes).toContainEqual({ field: "endAt", value: "later", reason: "end_date_dropped" });
  });

  it("still blocks the row on an unreadable start date", () => {
    const [row] = applyMapping([{ ...BASE, startAt: "someday" }], m(), OPTS);
    expect(row.issues).toEqual([{ field: "startAt", value: "someday", reason: "not_a_date" }]);
  });

  it("drops an invalid email with a note", () => {
    const [row] = applyMapping([{ ...BASE, clientEmail: "not-an-email" }], m(), OPTS);
    expect(row.values.clientEmail).toBeUndefined();
    expect(row.notes).toContainEqual({ field: "clientEmail", value: "not-an-email", reason: "email_dropped" });
  });

  it("blanks an unrecognized event type with a note", () => {
    const [row] = applyMapping([{ ...BASE, eventType: "Gig" }], m(), OPTS);
    expect(row.issues).toEqual([]);
    expect(row.values.eventType).toBeUndefined();
    expect(row.notes).toContainEqual({ field: "eventType", value: "Gig", reason: "event_type_blank" });
  });

  it("truncates over-long text with a note", () => {
    const long = "x".repeat(170);
    const [row] = applyMapping([{ ...BASE, title: long }], m(), OPTS);
    expect(row.values.title).toBe("x".repeat(160));
    expect(row.notes).toContainEqual({ field: "title", value: long, reason: "truncated" });
  });

  it("does not split an emoji when truncating at the cap", () => {
    const long = "x".repeat(159) + "\u{1F600}" + "tail";
    const [row] = applyMapping([{ ...BASE, title: long }], m(), OPTS);
    expect(row.values.title).toBe("x".repeat(159));
    expect(row.notes).toContainEqual({ field: "title", value: long, reason: "truncated" });
  });

  it("does not split an emoji at the notes cap", () => {
    const long = "y".repeat(1999) + "\u{1F600}";
    const [row] = applyMapping([{ ...BASE, notes: long }], m(), OPTS);
    expect(row.values.notes).toBe("y".repeat(1999));
  });

  it("drops a deposit when the total was dropped or absent", () => {
    const mapping = m();
    mapping.amountTotal = { source: "amountTotal" };
    mapping.amountDeposit = { source: "amountDeposit" };
    const [dropped] = applyMapping([{ ...BASE, amountTotal: "tbc", amountDeposit: "5000" }], mapping, OPTS);
    expect(dropped.values.amountDeposit).toBeUndefined();
    expect(dropped.notes).toContainEqual({ field: "amountDeposit", value: "5000", reason: "deposit_dropped" });
    const [absent] = applyMapping([{ ...BASE, amountDeposit: "5000" }], mapping, OPTS);
    expect(absent.values.amountDeposit).toBeUndefined();
    expect(absent.notes).toContainEqual({ field: "amountDeposit", value: "5000", reason: "deposit_dropped" });
  });

  it("drops a deposit larger than the total but keeps a valid one", () => {
    const mapping = m();
    mapping.amountTotal = { source: "amountTotal" };
    mapping.amountDeposit = { source: "amountDeposit" };
    const [over] = applyMapping([{ ...BASE, amountTotal: "1000", amountDeposit: "5000" }], mapping, OPTS);
    expect(over.values.amountTotal).toBe("1000");
    expect(over.values.amountDeposit).toBeUndefined();
    expect(over.notes).toContainEqual({ field: "amountDeposit", value: "5000", reason: "deposit_dropped" });
    const [ok] = applyMapping([{ ...BASE, amountTotal: "1000", amountDeposit: "500" }], mapping, OPTS);
    expect(ok.values.amountDeposit).toBe("500");
  });

  it("notes a negative amount as dropped", () => {
    const mapping = m();
    mapping.amountTotal = { source: "amountTotal" };
    const [row] = applyMapping([{ ...BASE, amountTotal: "-500" }], mapping, OPTS);
    expect(row.issues).toEqual([]);
    expect(row.notes).toContainEqual({ field: "amountTotal", value: "-500", reason: "amount_dropped" });
  });

  it("notes an unsupported currency as dropped", () => {
    const [row] = applyMapping([{ ...BASE, currency: "XYZ" }], m(), OPTS);
    expect(row.values.currency).toBeUndefined();
    expect(row.notes).toContainEqual({ field: "currency", value: "XYZ", reason: "currency_dropped" });
  });

  it("drops a phone over 30 characters with a note instead of truncating it", () => {
    const mapping = m();
    mapping.clientPhone = { source: "clientPhone" };
    const long = "+63 917 123 4567 ext 99 call after lunch";
    const [row] = applyMapping([{ ...BASE, clientPhone: long }], mapping, OPTS);
    expect(row.values.clientPhone).toBeUndefined();
    expect(row.notes).toContainEqual({ field: "clientPhone", value: long, reason: "phone_dropped" });
  });

  it("generates a title from the row when none was mapped", () => {
    const mapping = m();
    mapping.title = null;
    const [row] = applyMapping([{ ...BASE }], mapping, {
      ...OPTS,
      titleFallback: (v) => `${v.clientName} booking`,
    });
    expect(row.values.title).toBe("Jane booking");
    expect(row.notes.filter((n) => n.field === "title")).toEqual([]);
  });
});
