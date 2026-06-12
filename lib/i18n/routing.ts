import { defineRouting } from "next-intl/routing";

// SEA-core locales for MVP. Markets covered:
//   en — default; all non-SEA markets fall through to this (incl. SG/AU/CA/NZ/GB/US
//        and the Gulf states until the Arabic locale ships — see
//        docs/paddle-integration/deferred-scope/arabic-rtl.md).
//   fil — Philippines (Filipino / Tagalog)
//   ms — Malaysia (and Singapore Malay speakers)
//   id — Indonesia
//
// Non-English catalogs at messages/{fil,ms,id}.json were machine-translated at
// launch and tagged in-source - see CLAUDE.md "Internationalization" section.
export const routing = defineRouting({
  locales: ["en", "fil", "ms", "id"] as const,
  defaultLocale: "en",
  // English URLs have no /en/ prefix; non-English locales are prefixed
  // (e.g. /fil/dashboard). Keeps SEO clean for the primary market while
  // still letting other-locale users share locale-bound URLs.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
