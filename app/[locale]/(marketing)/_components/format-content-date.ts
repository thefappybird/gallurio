// `publishedAt`/`updatedAt` on content entries are date-only "YYYY-MM-DD"
// strings. `new Date("YYYY-MM-DD")` parses as UTC midnight, so the formatter
// pins timeZone: "UTC" too — otherwise a negative-offset host would render
// the previous day.
export function formatContentDate(isoDay: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(isoDay)
  );
}
