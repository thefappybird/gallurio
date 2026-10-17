import { hasTimeOfDay } from "@/lib/bookings/import-normalize";

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
      ...(hasTimeOfDay(source) || /T\d{2}:/.test(source) ? { timeStyle: "short" } : {}),
      timeZone,
    }).format(date);
  } catch {
    return iso;
  }
}
