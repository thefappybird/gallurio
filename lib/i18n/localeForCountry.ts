import { routing, type Locale } from "./routing";

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

// Resolves the public-page chrome locale. The form language is owner-controlled
// via `publicPage.formLocale`; when set to a valid locale that value is used,
// otherwise it defaults to English. The workspace country has no bearing on
// this — the contact form must never auto-inherit a language the owner did not
// explicitly choose.
export function resolvePublicChromeLocale(workspace: {
  country?: string | null;
  publicPage?: { formLocale?: string | null } | null;
}): Locale {
  const chosen = workspace.publicPage?.formLocale;
  if (chosen && (routing.locales as readonly string[]).includes(chosen)) {
    return chosen as Locale;
  }
  return "en";
}
