"use client";

import { useEffect } from "react";

/**
 * Keeps `<html lang>` in sync with the workspace's resolved public-page locale.
 *
 * The root layout (`app/(public)/layout.tsx`) hardcodes `lang="en"` on `<html>`
 * because it renders unconditionally above `[orgSlug]` (so `not-found.tsx`
 * always has a shell) and structurally cannot read the workspace's locale.
 * This component patches the document's `lang` attribute client-side once the
 * workspace locale is known, so assistive tech and browser features that key
 * off `document.documentElement.lang` get the correct value.
 */
export function SyncDocumentLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
