import "server-only";

import ExcelJS from "exceljs";
import { dedupeHeaders, type CsvRow, type ParsedCsv } from "./csv-parse";

/**
 * XLSX read/write for the bookings import/export.
 *
 * Every cell is coerced to a string on the way in so XLSX and CSV converge on
 * the same `Record<string, string>` shape and share ONE validation path. This
 * module is server-only: exceljs pulls Node built-ins and must never be
 * bundled for the browser (see `serverExternalPackages` in next.config.ts).
 */

/** Name of the sheet written by the exporter / template. */
const SHEET_NAME = "Bookings";

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    // exceljs keeps a cell's wall-clock in the UTC fields. Emit it as zoneless
    // text so the importer applies the workspace timezone instead of treating
    // the cell as an instant.
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
  }
  if (typeof value === "object") {
    // Formula cells carry their computed result; rich text carries runs.
    if ("result" in value) return value.result == null ? "" : String(value.result);
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value) return String(value.text);
    return "";
  }
  return String(value);
}

/** How far down a sheet to look for the header row (banners, titles). */
const HEADER_SCAN_ROWS = 10;

function rowStrings(row: ExcelJS.Row): string[] {
  const raw: string[] = [];
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    raw[col - 1] = cellToString(cell.value).trim();
  });
  // eachCell skips trailing empties; normalize holes so indexes stay aligned.
  for (let i = 0; i < raw.length; i++) raw[i] ??= "";
  return raw;
}

/** Header = first of the top rows with at least two non-empty cells. */
function findHeader(sheet: ExcelJS.Worksheet): { rowNumber: number; raw: string[] } | null {
  const last = Math.min(sheet.rowCount, HEADER_SCAN_ROWS);
  for (let r = 1; r <= last; r++) {
    const raw = rowStrings(sheet.getRow(r));
    if (raw.filter(Boolean).length >= 2) return { rowNumber: r, raw };
  }
  return null;
}

/** Declared (uncompressed) size ceiling; the upload cap only bounds the compressed bytes. */
const MAX_UNCOMPRESSED_BYTES = 50_000_000;
const MAX_ZIP_ENTRIES = 2000;

/** Thrown when the zip directory declares more than we are willing to inflate. */
export class XlsxTooLargeError extends Error {
  constructor() {
    super("xlsx_too_large");
    this.name = "XlsxTooLargeError";
  }
}

/**
 * Reads the zip end-of-central-directory + central directory (no inflation) and
 * rejects bombs before exceljs/JSZip decompress anything. ZIP64 is refused: a
 * legitimate <2 MB workbook never needs it. Malformed directories throw a plain
 * Error (callers map it to "unreadable file").
 */
export function assertXlsxWithinLimits(input: ArrayBuffer | Uint8Array | Buffer): void {
  const buf = input instanceof ArrayBuffer ? Buffer.from(input) : Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const minEocd = 22;
  let eocd = -1;
  for (let i = buf.length - minEocd; i >= Math.max(0, buf.length - minEocd - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip_eocd_not_found");
  if (eocd >= 20 && buf.readUInt32LE(eocd - 20) === 0x07064b50) throw new XlsxTooLargeError();
  const entries = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (entries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new XlsxTooLargeError();
  if (entries > MAX_ZIP_ENTRIES) throw new XlsxTooLargeError();
  if (cdOffset + cdSize > eocd) throw new Error("zip_directory_out_of_bounds");

  let pos = cdOffset;
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) throw new Error("zip_directory_malformed");
    const size = buf.readUInt32LE(pos + 24);
    if (size === 0xffffffff) throw new XlsxTooLargeError();
    total += size;
    if (total > MAX_UNCOMPRESSED_BYTES) throw new XlsxTooLargeError();
    pos += 46 + buf.readUInt16LE(pos + 28) + buf.readUInt16LE(pos + 30) + buf.readUInt16LE(pos + 32);
  }
}

export async function parseXlsxToRows(buffer: ArrayBuffer | Buffer): Promise<ParsedCsv> {
  assertXlsxWithinLimits(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ArrayBuffer);

  // First tab that actually has a header, so an "Instructions" tab is skipped.
  let sheet: ExcelJS.Worksheet | undefined;
  let found: { rowNumber: number; raw: string[] } | null = null;
  for (const ws of workbook.worksheets) {
    found = findHeader(ws);
    if (found) {
      sheet = ws;
      break;
    }
  }
  if (!sheet || !found) return { headers: [], rows: [] };

  const headerRowNumber = found.rowNumber;
  // Header text is kept verbatim — the mapping step shows it back to the user.
  const headers = dedupeHeaders(found.raw);

  const rows: CsvRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
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
