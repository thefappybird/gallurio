import "server-only";

import ExcelJS from "exceljs";
import { normalizeCsvHeader, type CsvRow, type ParsedCsv } from "./csv-parse";

/**
 * XLSX read/write for the bookings import/export.
 *
 * Every cell is coerced to a string on the way in so XLSX and CSV converge on
 * the same `Record<string, string>` shape and share ONE validation path. This
 * module is server-only: exceljs pulls Node built-ins and must never be
 * bundled for the browser (see `serverExternalPackages` in next.config.ts).
 */

/** Only the first worksheet is read — the importer has no notion of tabs. */
const SHEET_NAME = "Bookings";

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    // Formula cells carry their computed result; rich text carries runs.
    if ("result" in value) return value.result == null ? "" : String(value.result);
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value) return String(value.text);
    return "";
  }
  return String(value);
}

export async function parseXlsxToRows(buffer: ArrayBuffer | Buffer): Promise<ParsedCsv> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ArrayBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = normalizeCsvHeader(cellToString(cell.value));
  });
  // eachCell skips trailing empties; normalize holes so indexes stay aligned.
  for (let i = 0; i < headers.length; i++) headers[i] ??= "";

  const rows: CsvRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: CsvRow = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      if (!header) return;
      const text = cellToString(row.getCell(idx + 1).value).trim();
      record[header] = text;
      if (text) hasValue = true;
    });
    if (hasValue) rows.push(record);
  });

  return { headers: headers.filter(Boolean), rows };
}

export async function rowsToXlsxBuffer(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET_NAME);

  sheet.addRow([...headers]);
  for (const row of rows) sheet.addRow([...row]);

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

/** True when the bytes look like a zip container, which is what .xlsx is. */
export function looksLikeXlsx(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}
