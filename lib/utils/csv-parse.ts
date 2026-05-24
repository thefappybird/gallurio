export type CsvRow = Record<string, string>;

export type ParsedCsv = {
  headers: string[];
  rows: CsvRow[];
};

/**
 * Minimal RFC-4180 CSV parser. Handles quoted fields (including embedded
 * commas and newlines), escaped double-quotes (""), and CR+LF / LF line ends.
 *
 * Returns normalized header names and one CsvRow object per data line.
 */
export function parseCsv(text: string): ParsedCsv {
  const rawLines = splitCsvLines(text);
  if (rawLines.length === 0) return { headers: [], rows: [] };

  const rawHeaders = parseFields(rawLines[0]);
  const headers = rawHeaders.map(normalizeCsvHeader);

  const rows: CsvRow[] = [];
  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line.trim()) continue;
    const values = parseFields(line);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Maps raw CSV header text to the camelCase field name the import schema
 * expects. Case-insensitive; ignores spaces, underscores, and dashes.
 */
export function normalizeCsvHeader(raw: string): string {
  const key = raw.trim().replace(/[\s_-]+/g, "").toLowerCase();
  const MAP: Record<string, string> = {
    title: "title",
    clientname: "clientName",
    client: "clientName",
    clientemail: "clientEmail",
    email: "clientEmail",
    startat: "startAt",
    start: "startAt",
    startdate: "startAt",
    endat: "endAt",
    end: "endAt",
    enddate: "endAt",
    eventtype: "eventType",
    type: "eventType",
    status: "status",
    locationaddress: "locationAddress",
    location: "locationAddress",
    address: "locationAddress",
    amounttotal: "amountTotal",
    total: "amountTotal",
    amount: "amountTotal",
    amountdeposit: "amountDeposit",
    deposit: "amountDeposit",
    currency: "currency",
    notes: "notes",
    note: "notes",
  };
  return MAP[key] ?? key;
}

/**
 * Splits CSV text into logical lines, keeping quoted newlines inside the
 * current line rather than starting a new one. Accumulates characters
 * verbatim — no content transformation here, just quote-aware line splitting.
 */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (!inQuotes && ch === "\r" && text[i + 1] === "\n") {
      lines.push(current);
      current = "";
      i++;
    } else if (!inQuotes && ch === "\n") {
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

/** Parses a single CSV line into field values, stripping outer quotes. */
function parseFields(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (!inQuotes) {
        inQuotes = true;
      } else if (line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}
