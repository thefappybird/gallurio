import { defineRouting } from "next-intl/routing";

// SEA-core locales + Arabic. Markets covered:
//   en — default; all markets without a dedicated catalog fall through to this
//        (incl. SG/AU/CA/NZ/GB/US).
//   fil — Philippines (Filipino / Tagalog)
//   id — Indonesia
//   ar — Arabic / RTL (Gulf markets). Selectable now; localeForCountry does NOT
//        yet auto-default Gulf tenants to it — see lib/i18n/localeForCountry.ts.
//   th — Thailand
//
// Non-English catalogs at messages/{fil,id,ar,th}.json were machine-translated
// and tagged in-source - see CLAUDE.md "i18n" section.
export const routing = defineRouting({
  locales: ["en", "fil", "id", "ar", "th"] as const,
  defaultLocale: "en",
  // English URLs have no /en/ prefix; non-English locales are prefixed
  // (e.g. /fil/dashboard). Keeps SEO clean for the primary market while
  // still letting other-locale users share locale-bound URLs.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
