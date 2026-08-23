/**
 * Pure SEO-string resolution for the two public portfolio pages (Home,
 * Gallery). No next-intl import here — callers resolve ICU strings via
 * `getTranslations` and pass the already-translated output in. This keeps
 * the module trivially unit-testable and keeps the locale catalogs owned by
 * the frontend agent (this file only defines the key *paths*, not copy).
 *
 * Namespace: `publicPage.seoDefaults`. All keys below are relative to that
 * namespace — call `t(SEO_DEFAULT_KEYS.homeDescription, {...})` after
 * `getTranslations({ locale, namespace: "publicPage.seoDefaults" })`.
 */

export type SeoStrings = {
  title: string;
  description: string;
  /** True when `description` came from the automatic default, not an owner-entered value. */
  isDefaulted: boolean;
};

export const SEO_DEFAULT_KEYS = {
  /** ICU: `{name}`, `{businessType}`. Used when the workspace has a known, non-"other" business type. */
  homeDescription: "homeDescription",
  /** ICU: `{name}`. Used when businessType is "other" or absent. */
  homeDescriptionGeneric: "homeDescriptionGeneric",
  /** ICU: `{name}`. Gallery page's own default — deliberately distinct copy from Home's. */
  galleryDescription: "galleryDescription",
  /** Human label per BUSINESS_TYPE_VALUES, interpolated into `homeDescription`. */
  businessType: {
    photographer: "businessType.photographer",
    venue: "businessType.venue",
    planner: "businessType.planner",
    stylist: "businessType.stylist",
    catering: "businessType.catering",
    entertainer: "businessType.entertainer",
    artists: "businessType.artists",
    other: "businessType.other",
  },
} as const;

function normalize(value?: string | null): string {
  return (value ?? "").trim();
}

export function resolveHomeSeo(input: {
  name: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  /** Already-translated label, or null. Not consumed here — the caller folds it
   *  into `defaultDescription` before calling; kept on the input contract so the
   *  settings UI and this resolver share one shape. */
  businessTypeLabel?: string | null;
  /** Already-translated template output (Home's default description). */
  defaultDescription: string;
}): SeoStrings {
  const title = normalize(input.seoTitle) || input.name;
  const configured = normalize(input.seoDescription);
  if (configured) {
    return { title, description: configured, isDefaulted: false };
  }
  return { title, description: input.defaultDescription, isDefaulted: true };
}

export function resolveGallerySeo(input: {
  name: string;
  galleryDescription?: string | null;
  seoDescription?: string | null;
  /** Already-translated template output (Gallery's own, distinct default). */
  defaultDescription: string;
  /** Already-translated "{name} — Gallery" title. */
  galleryTitle: string;
}): SeoStrings {
  const gallery = normalize(input.galleryDescription);
  if (gallery) {
    return { title: input.galleryTitle, description: gallery, isDefaulted: false };
  }
  const seo = normalize(input.seoDescription);
  if (seo) {
    return { title: input.galleryTitle, description: seo, isDefaulted: false };
  }
  return { title: input.galleryTitle, description: input.defaultDescription, isDefaulted: true };
}
