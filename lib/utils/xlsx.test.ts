import { describe, expect, it } from "vitest";
import { parseXlsxToRows, rowsToXlsxBuffer } from "./xlsx";

describe("xlsx round-trip", () => {
  it("writes a workbook that parses back to the same headers and cells", async () => {
    const headers = ["title", "clientName", "amountTotal"];
    const rows = [
      ["Garden Wedding", "Ana Cruz", 15000],
      ["Studio Shoot", "Bea Santos", 0],
    ];

    const buffer = await rowsToXlsxBuffer(headers, rows);
    const parsed = await parseXlsxToRows(buffer);

    expect(parsed.headers).toEqual(headers);
    // Every cell comes back as a string so XLSX and CSV share one validator.
    expect(parsed.rows).toEqual([
      { title: "Garden Wedding", clientName: "Ana Cruz", amountTotal: "15000" },
      { title: "Studio Shoot", clientName: "Bea Santos", amountTotal: "0" },
    ]);
  });

  it("normalizes header aliases so XLSX and CSV hit the same validator", async () => {
    const buffer = await rowsToXlsxBuffer(
      ["Booking ID", "Client Name", "Start Date"],
      [["abc123", "Ana Cruz", "2026-09-01T09:00:00Z"]]
    );
    const parsed = await parseXlsxToRows(buffer);
    expect(parsed.headers).toEqual(["bookingId", "clientName", "startAt"]);
    expect(parsed.rows[0].bookingId).toBe("abc123");
  });

  it("rejects a non-zip buffer instead of returning empty rows", async () => {
    // A crafted or truncated upload must surface as an error the route can turn
    // into a 400, never a silent success or a 500.
    await expect(parseXlsxToRows(Buffer.from("not a spreadsheet"))).rejects.toThrow();
  });
});
