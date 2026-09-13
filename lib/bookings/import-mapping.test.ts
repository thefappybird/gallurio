import { describe, expect, it } from "vitest";
import { MAPPABLE_FIELDS, autoMapColumns, requiredFieldsSatisfied } from "./import-mapping";
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
