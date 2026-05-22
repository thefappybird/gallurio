import type { Locale } from "./routing";

// Map a workspace's country (ISO 3166-1 alpha-2) to the locale used for the
// Gallurio chrome on its public page (`/w/[orgSlug]`). The visitor's
// Accept-Language is intentionally ignored — tenant-authored content is the
// source of truth, and the chrome should match the locale the tenant set up
// in their workspace.
//
// HitPay-only markets currently. Falls back to English for anything else.
export function localeForCountry(country: string | null | undefined): Locale {
  switch ((country ?? "").toUpperCase()) {
    case "PH":
      return "fil";
    case "MY":
      return "ms";
    case "ID":
      return "id";
    case "TH":
      return "th";
    default:
      return "en";
  }
}
