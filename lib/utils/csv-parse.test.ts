import { describe, it, expect } from "vitest";
import { parseCsv, normalizeCsvHeader, stripFormulaGuard } from "./csv-parse";

describe("stripFormulaGuard", () => {
  it("reverses the export-side apostrophe guard, and only that", () => {
    // Round-trip: escapeSpreadsheetText("=SUM(1)") -> "'=SUM(1)" -> back again.
    expect(stripFormulaGuard("'=SUM(1)")).toBe("=SUM(1)");
    expect(stripFormulaGuard("'+63917")).toBe("+63917");
    // A legitimately apostrophe-led value is not a guard and must survive.
    expect(stripFormulaGuard("'tis the season")).toBe("'tis the season");
    expect(stripFormulaGuard("Garden Wedding")).toBe("Garden Wedding");
  });
});

describe("normalizeCsvHeader", () => {
  it("maps known aliases to canonical names", () => {
    expect(normalizeCsvHeader("Client Name")).toBe("clientName");
    expect(normalizeCsvHeader("client_name")).toBe("clientName");
    expect(normalizeCsvHeader("clientName")).toBe("clientName");
    expect(normalizeCsvHeader("Start Date")).toBe("startAt");
    expect(normalizeCsvHeader("startAt")).toBe("startAt");
    expect(normalizeCsvHeader("Total")).toBe("amountTotal");
    expect(normalizeCsvHeader("amountTotal")).toBe("amountTotal");
    expect(normalizeCsvHeader("Location")).toBe("locationAddress");
    expect(normalizeCsvHeader("email")).toBe("clientEmail");
  });

  it("passes through unknown headers unchanged (lowercased)", () => {
    expect(normalizeCsvHeader("customField")).toBe("customfield");
  });

  it("maps the round-trip identity columns the exporter emits", () => {
    // Without these the exporter's own headers arrive as "bookingid" /
    // "sessionindex" and are dropped, so an exported file can never be
    // re-imported as an update.
    expect(normalizeCsvHeader("booking_id")).toBe("bookingId");
    expect(normalizeCsvHeader("Booking ID")).toBe("bookingId");
    expect(normalizeCsvHeader("session_index")).toBe("sessionIndex");
    expect(normalizeCsvHeader("client_id")).toBe("clientId");
  });
});

describe("parseCsv", () => {
  it("parses a simple two-column CSV", () => {
    const { headers, rows } = parseCsv("title,clientName\nWedding,Jane");
    expect(headers).toEqual(["title", "clientName"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ title: "Wedding", clientName: "Jane" });
  });

  it("strips a UTF-8 BOM so an Excel-saved file's first column still maps", () => {
    // Excel writes a BOM; without stripping it the first header parses as
    // "﻿title", the required title column silently goes missing, and every
    // row fails validation.
    const { headers, rows } = parseCsv("﻿title,clientName\r\nWedding,Jane\r\n");
    expect(headers).toEqual(["title", "clientName"]);
    expect(rows[0]).toEqual({ title: "Wedding", clientName: "Jane" });
  });

  it("skips blank lines", () => {
    const { rows } = parseCsv("title,clientName\nWedding,Jane\n\n");
    expect(rows).toHaveLength(1);
  });

  it("handles CRLF line endings", () => {
    const { rows } = parseCsv("title,clientName\r\nWedding,Jane\r\n");
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Wedding");
  });

  it("handles quoted fields with embedded commas", () => {
    const { rows } = parseCsv(`title,clientName\n"Smith, Jr. Wedding",Jane`);
    expect(rows[0].title).toBe("Smith, Jr. Wedding");
    expect(rows[0].clientName).toBe("Jane");
  });

  it("handles escaped double-quotes inside quoted fields", () => {
    const { rows } = parseCsv(`title,clientName\n"It's the ""Big Day""",Jane`);
    expect(rows[0].title).toBe(`It's the "Big Day"`);
  });

  it("preserves the user's original header text", () => {
    // The mapping step shows these back to the user, so the parser must not
    // rewrite them. Normalization moved to auto-mapping.
    const { headers } = parseCsv("Customer,Package Price,Deal Status\nJane,500,Confirmed");
    expect(headers).toEqual(["Customer", "Package Price", "Deal Status"]);
  });

  it("suffixes duplicate headers so neither column is lost", () => {
    // Rows are keyed by header text, so two "Amount" columns would collapse
    // into one and the second would vanish without a trace.
    const { headers, rows } = parseCsv("Amount,Notes,Amount\n100,hi,200");
    expect(headers).toEqual(["Amount", "Notes", "Amount (2)"]);
    expect(rows[0]).toEqual({ Amount: "100", Notes: "hi", "Amount (2)": "200" });
  });

  it("leaves unnamed columns unnamed rather than suffixing them", () => {
    // Trailing empty header cells are common in exported sheets. Suffixing them
    // would invent " (2)" columns that consumers then treat as real fields.
    const { headers } = parseCsv("Amount,,\n100,x,y");
    expect(headers).toEqual(["Amount", "", ""]);
  });

  it("returns empty result for empty string", () => {
    const { headers, rows } = parseCsv("");
    expect(headers).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });

  it("fills missing trailing columns with empty string", () => {
    const { rows } = parseCsv("title,clientName,notes\nWedding,Jane");
    expect(rows[0].notes).toBe("");
  });

  it("strips leading # comment lines before parsing headers", () => {
    const csv =
      "# Required: clientName, startAt. clientEmail optional but used to dedupe.\n" +
      "title,clientName\n" +
      "Smith Wedding,Jane\n";
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["title", "clientName"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Smith Wedding");
  });

  it("strips multiple # comment lines in sequence", () => {
    const csv = "# line 1\n# line 2\ntitle,clientName\nWedding,Bob\n";
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["title", "clientName"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].clientName).toBe("Bob");
  });

  it("does not strip # values that appear inside data rows", () => {
    const csv = "title,clientName\nMy #Wedding,Jane\n";
    const { rows } = parseCsv(csv);
    expect(rows[0].title).toBe("My #Wedding");
  });

  it("parses data rows whose first field starts with #", () => {
    const csv = "title,clientName\n#5 Birthday,Jane\n";
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("#5 Birthday");
    expect(rows[0].clientName).toBe("Jane");
  });

  it("only skips # comment lines that appear before the header row", () => {
    const csv =
      "# this is a comment\n" +
      "title,clientName\n" +
      "#3 Anniversary,Bob\n" +
      "#4 Wedding,Alice\n";
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["title", "clientName"]);
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe("#3 Anniversary");
    expect(rows[1].title).toBe("#4 Wedding");
  });
});