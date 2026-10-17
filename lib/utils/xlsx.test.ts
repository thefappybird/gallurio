import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseXlsxToRows, rowsToXlsxBuffer, XlsxTooLargeError } from "./xlsx";

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

  it("preserves raw header text so XLSX and CSV feed the same mapping step", async () => {
    const buffer = await rowsToXlsxBuffer(
      ["Booking ID", "Client Name", "Start Date"],
      [["abc123", "Ana Cruz", "2026-09-01T09:00:00Z"]]
    );
    const parsed = await parseXlsxToRows(buffer);
    expect(parsed.headers).toEqual(["Booking ID", "Client Name", "Start Date"]);
    expect(parsed.rows[0]["Booking ID"]).toBe("abc123");
  });

  it("rejects a non-zip buffer instead of returning empty rows", async () => {
    // A crafted or truncated upload must surface as an error the route can turn
    // into a 400, never a silent success or a 500.
    await expect(parseXlsxToRows(Buffer.from("not a spreadsheet"))).rejects.toThrow();
  });
});

describe("xlsx date cells", () => {
  it("reads a date-only cell as YYYY-MM-DD", async () => {
    const buffer = await rowsToXlsxBuffer(["Name", "Event Date"], [["Ana", new Date("2031-06-11T00:00:00.000Z")]]);
    const parsed = await parseXlsxToRows(buffer);
    expect(parsed.rows[0]["Event Date"]).toBe("2031-06-11");
  });
});

describe("xlsx date cells (time, strings)", () => {
  it("reads a date-time cell as YYYY-MM-DD HH:mm", async () => {
    const buffer = await rowsToXlsxBuffer(["Name", "When"], [["Ana", new Date("2031-06-11T14:30:00.000Z")]]);
    const parsed = await parseXlsxToRows(buffer);
    expect(parsed.rows[0].When).toBe("2031-06-11 14:30");
  });

  it("passes an ISO string cell through unchanged (export round-trip)", async () => {
    const buffer = await rowsToXlsxBuffer(["title", "startAt"], [["T", "2031-06-11T02:00:00.000Z"]]);
    const parsed = await parseXlsxToRows(buffer);
    expect(parsed.rows[0].startAt).toBe("2031-06-11T02:00:00.000Z");
  });
});

async function wb(build: (w: ExcelJS.Workbook) => void): Promise<Buffer> {
  const w = new ExcelJS.Workbook();
  build(w);
  return Buffer.from(await w.xlsx.writeBuffer());
}

describe("xlsx header detection", () => {
  it("skips a banner row and blank row to find the header at row 3", async () => {
    const buf = await wb((w) => {
      const s = w.addWorksheet("Sheet1");
      s.getCell("A1").value = "Bookings 2031";
      s.getRow(3).values = ["Name", "Date"];
      s.getRow(4).values = ["Ana", "2031-06-11"];
    });
    const parsed = await parseXlsxToRows(buf);
    expect(parsed.headers).toEqual(["Name", "Date"]);
    expect(parsed.rows).toEqual([{ Name: "Ana", Date: "2031-06-11" }]);
  });

  it("uses the first worksheet that has a header row, skipping an instructions tab", async () => {
    const buf = await wb((w) => {
      w.addWorksheet("Instructions").getCell("A1").value = "Read me";
      const s = w.addWorksheet("Data");
      s.getRow(1).values = ["Name", "Date"];
      s.getRow(2).values = ["Bea", "2031-07-01"];
    });
    const parsed = await parseXlsxToRows(buf);
    expect(parsed.headers).toEqual(["Name", "Date"]);
    expect(parsed.rows).toEqual([{ Name: "Bea", Date: "2031-07-01" }]);
  });
});

// Minimal zip with a single stored entry whose central directory declares `declared` bytes.
function craftZip(declared: number, entries = 1): Buffer {
  const name = Buffer.from("a");
  const cd: Buffer[] = [];
  for (let i = 0; i < entries; i++) {
    const h = Buffer.alloc(46);
    h.writeUInt32LE(0x02014b50, 0);
    h.writeUInt32LE(declared, 24);
    h.writeUInt16LE(name.length, 28);
    cd.push(h, name);
  }
  const dir = Buffer.concat(cd);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries, 8);
  eocd.writeUInt16LE(entries, 10);
  eocd.writeUInt32LE(dir.length, 12);
  eocd.writeUInt32LE(0, 16);
  return Buffer.concat([dir, eocd]);
}

describe("xlsx zip-bomb guard", () => {
  it("rejects a zip declaring a huge uncompressed size before exceljs inflates anything", async () => {
    await expect(parseXlsxToRows(craftZip(60_000_000))).rejects.toBeInstanceOf(XlsxTooLargeError);
  });

  it("rejects a directory with too many entries", async () => {
    await expect(parseXlsxToRows(craftZip(1, 2001))).rejects.toBeInstanceOf(XlsxTooLargeError);
  });

  it("rejects ZIP64 markers", async () => {
    await expect(parseXlsxToRows(craftZip(0xffffffff))).rejects.toBeInstanceOf(XlsxTooLargeError);
  });

  it("treats a missing or malformed directory as unreadable, not too large", async () => {
    const err = await parseXlsxToRows(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0])).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(XlsxTooLargeError);
  });

  it("still parses a normal workbook", async () => {
    const buf = await rowsToXlsxBuffer(["Name", "Date"], [["Ana", "2031-06-11"]]);
    expect((await parseXlsxToRows(buf)).rows).toHaveLength(1);
  });
});
