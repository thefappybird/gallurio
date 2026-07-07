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
