export type BundledSeoFields = {
  seoTitle: string;
  seoDescription: string;
  siteIconUrl: string;
  siteIconAssetId: string;
  seo: {
    keywords: string[];
    ogImageUrl: string;
    ogImageAssetId: string;
    galleryDescription: string;
    noindex: boolean;
  };
};

export type SettingsSeoFields = {
  seoTitle: string;
  seoDescription: string;
  siteIconUrl: string;
  siteIconAssetId: string;
  seo: {
    keywords: string[];
    ogImageUrl: string;
    ogImageAssetId: string;
    galleryDescription: string;
    noindex: boolean;
  };
};

type SeoFieldsSource = {
  seoTitle?: string | null;
  seoDescription?: string | null;
  siteIcon?: { url?: string | null; assetId?: string | null } | null;
  seo?: {
    ogImageUrl?: string | null;
    ogImageAssetId?: string | null;
    galleryDescription?: string | null;
    noindex?: boolean | null;
    keywords?: string[] | null;
  } | null;
} | null | undefined;

type SettingsSeoFieldsSource = {
  seoTitle?: string | null;
  seoDescription?: string | null;
  siteIcon?: { url?: string | null; assetId?: string | null } | null;
  seo?: {
    keywords?: string[] | null;
    ogImageUrl?: string | null;
    ogImageAssetId?: string | null;
    galleryDescription?: string | null;
    noindex?: boolean | null;
  } | null;
} | null | undefined;

/** Normalizes a PortfolioDraft's SEO-related fields into a comparable, defaulted shape. */
export function normalizeDraftSeoFields(draft: SeoFieldsSource): BundledSeoFields {
  return {
    seoTitle: draft?.seoTitle ?? "",
    seoDescription: draft?.seoDescription ?? "",
    siteIconUrl: draft?.siteIcon?.url ?? "",
    siteIconAssetId: draft?.siteIcon?.assetId ?? "",
    seo: {
      keywords: draft?.seo?.keywords ?? [],
      ogImageUrl: draft?.seo?.ogImageUrl ?? "",
      ogImageAssetId: draft?.seo?.ogImageAssetId ?? "",
      galleryDescription: draft?.seo?.galleryDescription ?? "",
      noindex: draft?.seo?.noindex ?? false,
    },
  };
}

/** Same normalization as {@link normalizeDraftSeoFields}, named for the published-side call site. */
export const normalizePublishedSeoFields = normalizeDraftSeoFields;

export function normalizeSettingsSeoFields(
  source: SettingsSeoFieldsSource
): SettingsSeoFields {
  return {
    seoTitle: source?.seoTitle ?? "",
    seoDescription: source?.seoDescription ?? "",
    siteIconUrl: source?.siteIcon?.url ?? "",
    siteIconAssetId: source?.siteIcon?.assetId ?? "",
    seo: {
      keywords: source?.seo?.keywords ?? [],
      ogImageUrl: source?.seo?.ogImageUrl ?? "",
      ogImageAssetId: source?.seo?.ogImageAssetId ?? "",
      galleryDescription: source?.seo?.galleryDescription ?? "",
      noindex: source?.seo?.noindex ?? false,
    },
  };
}

/** True if any SEO-bundled field differs between two normalized snapshots. */
export function hasPendingSeoChanges(a: BundledSeoFields, b: BundledSeoFields): boolean {
  return (
    a.seoTitle !== b.seoTitle ||
    a.seoDescription !== b.seoDescription ||
    a.siteIconUrl !== b.siteIconUrl ||
    a.siteIconAssetId !== b.siteIconAssetId ||
    a.seo.ogImageUrl !== b.seo.ogImageUrl ||
    a.seo.ogImageAssetId !== b.seo.ogImageAssetId ||
    a.seo.galleryDescription !== b.seo.galleryDescription ||
    a.seo.noindex !== b.seo.noindex ||
    JSON.stringify(a.seo.keywords) !== JSON.stringify(b.seo.keywords)
  );
}

export function hasPendingSettingsSeoChanges(
  a: SettingsSeoFields,
  b: SettingsSeoFields
): boolean {
  return (
    a.seoTitle !== b.seoTitle ||
    a.seoDescription !== b.seoDescription ||
    a.siteIconUrl !== b.siteIconUrl ||
    a.siteIconAssetId !== b.siteIconAssetId ||
    JSON.stringify(a.seo.keywords) !== JSON.stringify(b.seo.keywords) ||
    a.seo.ogImageUrl !== b.seo.ogImageUrl ||
    a.seo.ogImageAssetId !== b.seo.ogImageAssetId ||
    a.seo.galleryDescription !== b.seo.galleryDescription ||
    a.seo.noindex !== b.seo.noindex
  );
}
