import { routing, type Locale } from "./routing";

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

// Resolves the public-page chrome locale, preferring the owner's explicit
// per-page `publicPage.formLocale` choice and falling back to the
// country-derived locale when it's unset/invalid. Keeps the inquiry form, nav,
// footer, and gallery labels in ONE language, isolated from the owner's app UI.
export function resolvePublicChromeLocale(workspace: {
  country?: string | null;
  publicPage?: { formLocale?: string | null } | null;
}): Locale {
  const chosen = workspace.publicPage?.formLocale;
  if (chosen && (routing.locales as readonly string[]).includes(chosen)) {
    return chosen as Locale;
  }
  return localeForCountry(workspace.country);
}
