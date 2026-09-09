"use client";

import { useEffect, useState } from "react";
import { createTranslator } from "next-intl";
import enMessages from "@/messages/en.json";

type Translator = (key: string, values?: Record<string, string | number>) => string;

// "en" is always available synchronously (it's the fallback for every other
// locale below) — every other locale is fetched on demand and cached forever
// once loaded, so switching back to a previously-picked formLocale is instant.
const messageCache = new Map<string, Record<string, unknown>>([["en", enMessages]]);
const pendingLoads = new Map<string, Promise<void>>();

function ensureLoaded(locale: string): Promise<void> | undefined {
  // Empty/falsy locale (e.g. an unset formLocale draft field) has no bundle
  // to fetch — "en" is already cached and is the correct fallback anyway.
  if (!locale || messageCache.has(locale)) return undefined;
  let pending = pendingLoads.get(locale);
  if (!pending) {
    pending = import(`@/messages/${locale}.json`).then((mod) => {
      messageCache.set(locale, mod.default as Record<string, unknown>);
    });
    pendingLoads.set(locale, pending);
  }
  return pending;
}

/**
 * Client-side translator for the portfolio's OWN language (`formLocale`),
 * decoupled from the CRM route locale.
 *
 * The editor canvas's contact-form swatch must show copy in whatever
 * `formLocale` the owner has live-selected — which changes without a page
 * navigation — so next-intl's request-bound `useTranslations()` (locked to
 * the CRM `/[locale]/` route segment) can't be used here. This dynamically
 * imports the same `messages/${locale}.json` bundle `lib/i18n/request.ts`
 * loads server-side and builds a `createTranslator` (next-intl's pure,
 * client-safe translator factory) from it, scoped to `namespace`.
 *
 * Returns an "en" translator immediately (synchronous, no flash of missing
 * copy) and re-renders once the real locale's messages have loaded — a single
 * one-time fetch per locale for the life of the tab.
 */
export function useFormLocaleTranslator(locale: string, namespace: string): Translator {
  const [, forceRerender] = useState(0);

  useEffect(() => {
    const pending = ensureLoaded(locale);
    if (!pending) return;
    let cancelled = false;
    pending.then(() => {
      if (!cancelled) forceRerender((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const resolvedLocale = messageCache.has(locale) ? locale : "en";
  const messages = messageCache.get(resolvedLocale)!;
  return createTranslator({ locale: resolvedLocale, messages, namespace }) as Translator;
}
