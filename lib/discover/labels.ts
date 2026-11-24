import type { DiscoverCard } from "@/lib/db/queries/discover";

/** Translator scoped to `publicPage.seoDefaults` (resolves `businessType.<value>`). */
export type CategoryTranslator = (key: string) => string;

function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** "Category · Country", skipping whichever part is empty (no category for "other"). */
export function categoryLine(
  card: Pick<DiscoverCard, "category" | "country">,
  locale: string,
  t: CategoryTranslator,
): string {
  const parts = [
    card.category ? t(`businessType.${card.category}`) : "",
    card.country ? countryName(card.country, locale) : "",
  ];
  return parts.filter(Boolean).join(" · ");
}
