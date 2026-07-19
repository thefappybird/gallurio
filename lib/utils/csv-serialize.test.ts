import { describe, it, expect } from "vitest";
import { quoteField, serializeRow, serializeCsv } from "./csv-serialize";

describe("quoteField", () => {
  it("returns empty string for null", () => {
    expect(quoteField(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(quoteField(undefined)).toBe("");
  });

  it("returns plain value for simple string", () => {
    expect(quoteField("Wedding")).toBe("Wedding");
  });

  it("wraps in double quotes when value contains a comma", () => {
    expect(quoteField("Smith, Jr.")).toBe('"Smith, Jr."');
  });

  it("doubles embedded double-quotes and wraps in quotes", () => {
    expect(quoteField(`Say "hello"`)).toBe(`"Say ""hello"""`);
  });

  it("wraps in quotes when value contains a newline", () => {
    expect(quoteField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps in quotes when value contains a carriage return", () => {
    expect(quoteField("line1\rline2")).toBe('"line1\rline2"');
  });

  it("converts numbers to string without quoting", () => {
    expect(quoteField(12345)).toBe("12345");
  });

  it("converts boolean to string", () => {
    expect(quoteField(true)).toBe("true");
  });
});

describe("serializeRow", () => {
  it("joins fields with commas", () => {
    expect(serializeRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("quotes a field containing a comma", () => {
    expect(serializeRow(["Smith, Jr.", "jane@example.com"])).toBe(
      '"Smith, Jr.",jane@example.com'
    );
  });

  it("handles empty array", () => {
    expect(serializeRow([])).toBe("");
  });
});

describe("serializeCsv", () => {
  it("produces header line + data rows joined by CRLF with trailing CRLF", () => {
    const result = serializeCsv(["name", "email"], [["Alice", "alice@example.com"]]);
    expect(result).toBe("name,email\r\nAlice,alice@example.com\r\n");
  });

  it("produces only header line for empty rows array", () => {
    const result = serializeCsv(["name", "email"], []);
    expect(result).toBe("name,email\r\n");
  });

  it("handles multiple rows", () => {
    const result = serializeCsv(
      ["title", "status"],
      [
        ["Smith Wedding", "booked"],
        ["Jones Event", "completed"],
      ]
    );
    expect(result).toBe(
      "title,status\r\nSmith Wedding,booked\r\nJones Event,completed\r\n"
    );
  });

  it("quotes fields with commas in data rows", () => {
    const result = serializeCsv(["title", "notes"], [["Smith, Jr. Wedding", "no notes"]]);
    expect(result).toBe('title,notes\r\n"Smith, Jr. Wedding",no notes\r\n');
  });

  it("doubles double-quotes in data values", () => {
    const result = serializeCsv(
      ["title", "notes"],
      [["My Wedding", `Say "hello" to the couple`]]
    );
    expect(result).toBe(
      `title,notes\r\nMy Wedding,"Say ""hello"" to the couple"\r\n`
    );
  });

  it("renders null and undefined values as empty fields", () => {
    const result = serializeCsv(
      ["a", "b", "c"],
      [[null, undefined, "val"]]
    );
    expect(result).toBe("a,b,c\r\n,,val\r\n");
  });

  it("full round-trip fixture — all 14 booking columns (incl. booking_id and session_index)", () => {
    const headers = [
      "clientName", "clientEmail", "startAt", "endAt", "title",
      "eventType", "status", "amountTotal", "amountDeposit",
      "currency", "locationAddress", "notes", "booking_id", "session_index",
    ];
    const row = [
      "Jane Smith",
      "jane@example.com",
      "2026-06-15T09:00:00.000Z",
      "2026-06-15T18:00:00.000Z",
      "Smith Wedding",
      "wedding",
      "booked",
      50000,
      10000,
      "PHP",
      "100 Ayala Ave",
      "",
      "6849abc123def456789abcde",
      0,
    ];
    const csv = serializeCsv(headers, [row]);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(headers.join(","));
    expect(lines[1]).toBe(
      "Jane Smith,jane@example.com,2026-06-15T09:00:00.000Z,2026-06-15T18:00:00.000Z,Smith Wedding,wedding,booked,50000,10000,PHP,100 Ayala Ave,,6849abc123def456789abcde,0"
    );
  });
});
