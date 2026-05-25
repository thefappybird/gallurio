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
