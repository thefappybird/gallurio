import { useLocale } from "next-intl";

// Single source of truth for which locales render right-to-left. Keep the "ar"
// literal here only — components and the root layout derive direction from this
// so adding a future RTL locale (or renaming one) is a one-line change.

/** Pure check usable in Server Components (e.g. the root layout's `dir`). */
export function isRtl(locale: string): boolean {
  return locale === "ar";
}

/** Client-component convenience: direction of the active request locale. */
export function useIsRtl(): boolean {
  return isRtl(useLocale());
}
