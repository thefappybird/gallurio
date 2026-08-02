/**
 * Characters Excel/Sheets treat as the start of a formula. A leading one in
 * user-authored text (title, notes, client name) would execute when the export
 * is opened, so it gets an apostrophe prefix that both apps render invisibly.
 *
 * Apply to TEXT columns only — prefixing a numeric column would break a
 * negative amount, and a "+63…" phone is text, not a number.
 * `stripFormulaGuard` in csv-parse.ts reverses this on import.
 */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

export function escapeSpreadsheetText(value: string | null | undefined): string {
  if (!value) return "";
  return FORMULA_TRIGGERS.test(value) ? `'${value}` : value;
}

export function quoteField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function serializeRow(row: readonly unknown[]): string {
  return row.map(quoteField).join(",");
}

export function serializeCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[]
): string {
  const lines = [serializeRow(headers)];
  for (const row of rows) {
    lines.push(serializeRow(row));
  }
  return lines.join("\r\n") + "\r\n";
}
