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
  const headerLine = rawLines.find((l) => l.trim() && !l.trimStart().startsWith("#"));
  const delimiter = headerLine ? detectDelimiter(headerLine) : ",";

  // State machine: skip leading comment/blank lines until we find the header,
  // then parse every remaining line as data — no # stripping after the header.
  let headers: string[] = [];
  let headerSeen = false;
  const rows: CsvRow[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trimEnd();

    if (!headerSeen) {
      if (!line.trim()) continue; // blank before header — skip
      if (line.trimStart().startsWith("#")) continue; // comment before header — skip
      // First non-comment, non-blank line is the header. Kept verbatim: the
      // mapping step shows these names back to the user, so the parser must not
      // rewrite them. `trim` also drops Excel's UTF-8 BOM, which normalization
      // used to absorb.
      headers = dedupeHeaders(parseFields(line, delimiter).map((h) => h.trim()));
      headerSeen = true;
      continue;
    }

    // Data row: only skip truly blank lines; # is valid data content.
    if (!line.trim()) continue;
    const values = parseFields(line, delimiter);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Decodes uploaded CSV bytes: strict UTF-8 (BOM stripped), falling back to
 * windows-1252 for legacy Excel "CSV" exports. Browser-safe.
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Cheap binary sniff on the first 8 KB: a NUL byte, or more than 10% control
 * bytes other than tab/LF/CR, means this is not a text file.
 */
export function isProbablyText(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8192);
  let control = 0;
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    if (b === 0) return false;
    if (b < 32 && b !== 9 && b !== 10 && b !== 13) control++;
  }
  return n === 0 || control / n <= 0.1;
}

/**
 * Row objects are keyed by header text, so two columns sharing a name would
 * collapse into one and silently lose a column. Suffixes repeats instead.
 */
export function dedupeHeaders(headers: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    // An unnamed column stays unnamed: suffixing blanks would invent " (2)"
    // columns that consumers mistake for real fields.
    if (!h) return h;
    const n = (seen.get(h) ?? 0) + 1;
    seen.set(h, n);
    return n === 1 ? h : `${h} (${n})`;
  });
}

/**
 * Reverses `escapeSpreadsheetText` from csv-serialize.ts: removes exactly one
 * leading apostrophe when it guards a formula trigger, so an exported value
 * round-trips back to what the user originally typed. A value that genuinely
 * starts with an apostrophe ("'tis") is left alone.
 */
export function stripFormulaGuard(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
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
    // Round-trip identity columns emitted by the exporter. Without these the
    // headers normalize to "bookingid"/"sessionindex"/"clientid" and get
    // dropped, so an exported file can never come back as an update.
    bookingid: "bookingId",
    sessionindex: "sessionIndex",
    clientid: "clientId",
    clientphone: "clientPhone",
    phone: "clientPhone",
    locationlat: "locationLat",
    lat: "locationLat",
    locationlng: "locationLng",
    lng: "locationLng",
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

/**
 * Picks `,` `;` or tab by how often each appears in the header line outside
 * quotes. Ties and no-delimiter lines fall back to comma.
 */
function detectDelimiter(headerLine: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of headerLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  let best = ",";
  for (const d of [";", "\t"]) if (counts[d] > counts[best]) best = d;
  return best;
}

/** Parses a single CSV line into field values, stripping outer quotes. */
function parseFields(line: string, delimiter = ","): string[] {
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
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}