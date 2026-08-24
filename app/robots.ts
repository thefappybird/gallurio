import type { MetadataRoute } from "next";
import { routing } from "@/lib/i18n/routing";

// Route segments that sit behind auth or exist only as redirect targets.
// Listed as bare segments rather than full paths so the locale-prefixed
// variants below cannot drift out of sync when a locale is added or dropped.
const PRIVATE_SEGMENTS = [
  "dashboard",
  "bookings",
  "clients",
  "inquiries",
  "notifications",
  "portfolio",
  "portfolio-preview",
  "settings",
  "teams",
  "onboarding",
  "subscribe",
  "invite",
  "inquiry-redirect",
  "sign-in",
  "sign-up",
  "forgot-password",
  "reset-password",
  "verify-email",
];

// localePrefix is "as-needed" (lib/i18n/routing.ts), so English routes are
// unprefixed and every other locale carries its prefix. Both forms are emitted:
// the unprefixed one is the route that actually serves, the prefixed ones cover
// the redirect URLs that still get linked and crawled.
const PATH_PREFIXES = ["", ...routing.locales.map((locale) => `/${locale}`)];

// Public surfaces. "/" already covers the marketing pages, /blog, /compare and
// /tools; /w/ is named explicitly because tenant portfolios are the highest
// volume crawl target on the domain.
const ALLOW = ["/", "/w/"];

// robots.txt matching is prefix-based, so disallowing "/portfolio" also matches
// "/portfolio-maker-demo". Conflicts resolve by longest match, so naming the
// longer path here re-opens the public demo without weakening the rule above.
const ALLOW_OVERRIDES = ["/portfolio-maker-demo"];

// AI crawlers are named individually and given exactly the access "*" gets:
// public surfaces yes, app routes and /api/ no. Several of them treat an
// unnamed site conservatively, and a named group is what settles it. Answering
// engines are a first-class traffic source for the comparison pages, so this is
// deliberate rather than incidental.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "meta-externalagent",
  "cohere-ai",
  "Amazonbot",
  "Bytespider",
  "DuckAssistBot",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    ...PATH_PREFIXES.flatMap((prefix) =>
      PRIVATE_SEGMENTS.map((segment) => `${prefix}/${segment}`)
    ),
    "/api/",
  ];

  return {
    rules: [
      {
        userAgent: ["*", ...AI_CRAWLERS],
        allow: [...ALLOW, ...ALLOW_OVERRIDES],
        disallow,
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/sitemap.xml`,
  };
}
