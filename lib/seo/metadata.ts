import type { Metadata } from "next";
import { routing } from "@/lib/i18n/routing";

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

// localePrefix is "as-needed", so the default locale serves unprefixed and
// every other locale carries its prefix. Canonical and hreflang URLs have to
// match what actually serves, or they point at redirects.
export function localeUrl(locale: string, path: string): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${baseUrl()}${prefix}${path}`;
}

// x-default points at the default locale: it is what gets served to any
// language Google has no better match for.
function hreflang(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(routing.locales.map((code) => [code, localeUrl(code, path)])),
    "x-default": localeUrl(routing.defaultLocale, path),
  };
}

type MarketingMetadataInput = {
  locale: string;
  path: string;
  title: string;
  description: string;
};

export function marketingMetadata({
  locale,
  path,
  title,
  description,
}: MarketingMetadataInput): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: localeUrl(locale, path), languages: hreflang(path) },
  };
}
