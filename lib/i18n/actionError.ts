"use client";

import { useTranslations } from "next-intl";

/**
 * Translator for server action / route-handler error codes.
 *
 * The contract: mutations return a stable snake_case `error` code (and optional
 * `params`) instead of a localized string. The client maps the code to
 * `app.errors.<code>` in the viewer's locale, falling back to a generic message
 * for any unrecognized code so a stale/unknown code never leaks to the UI.
 *
 * A legacy inline-param form is also supported: an `error` like
 * `"max_themes_reached:5"` resolves `app.errors.max_themes_reached` with
 * `{ count: "5" }`.
 */
export function useActionError() {
  const t = useTranslations("app.errors");
  return (
    error?: string | null,
    params?: Record<string, string | number>,
  ): string => {
    if (!error) return t("generic");
    const sep = error.indexOf(":");
    const code = sep === -1 ? error : error.slice(0, sep);
    const merged =
      sep === -1 ? params : { ...params, count: error.slice(sep + 1) };
    return t.has(code) ? t(code, merged) : t("generic");
  };
}
