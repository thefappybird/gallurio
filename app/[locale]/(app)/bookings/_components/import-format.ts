/** Reads as "has a time of day": 14:30, 9am, 9 pm. Date-only cells get a date-only format. */
const HAS_TIME = /\d{1,2}:\d{2}|\d\s?(am|pm)\b/i;

/**
 * Formats a coerced ISO instant for people: workspace timezone, active locale.
 * `source` is the cell the instant came from; it decides whether a time shows.
 */
export function formatImportInstant(
  iso: string,
  locale: string,
  timeZone: string,
  source = iso
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      ...(HAS_TIME.test(source) || /T\d{2}:/.test(source) ? { timeStyle: "short" } : {}),
      timeZone,
    }).format(date);
  } catch {
    return iso;
  }
}
