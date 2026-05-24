import { describe, it, expect } from "vitest";
import { parseCsv, normalizeCsvHeader } from "./csv-parse";

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
});

describe("parseCsv", () => {
  it("parses a simple two-column CSV", () => {
    const { headers, rows } = parseCsv("title,clientName\nWedding,Jane");
    expect(headers).toEqual(["title", "clientName"]);
    expect(rows).toHaveLength(1);
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

  it("normalizes header aliases", () => {
    const { headers } = parseCsv("Title,Client Name,Start Date\nv1,v2,v3");
    expect(headers).toEqual(["title", "clientName", "startAt"]);
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
});
