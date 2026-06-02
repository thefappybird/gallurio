import type { Locale } from "./routing";

// Map a workspace's country (ISO 3166-1 alpha-2) to the locale used for the
// Gallurio chrome on its public page (`/w/[orgSlug]`). The visitor's
// Accept-Language is intentionally ignored — tenant-authored content is the
// source of truth, and the chrome should match the locale the tenant set up
// in their workspace.
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
    // Gulf markets fall back to English chrome until the Arabic locale ships —
    // see docs/paddle-integration/arabic-rtl.md. When ready, change these
    // cases to return "ar".
    case "AE":
    case "SA":
    case "QA":
    case "KW":
    case "OM":
    case "BH":
      return "en";
    default:
      return "en";
  }
}
