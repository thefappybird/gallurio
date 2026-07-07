import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@measured/puck/rsc";
import { puckConfig } from "@/lib/page-builder/config";
import { buildRenderWorkspace, runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import { getTranslations } from "next-intl/server";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { normalizePublicPageData } from "@/lib/page-builder/normalizePublicPageData";
import { collectGoogleFontFamilies } from "@/lib/page-builder/fonts";
import { GoogleFontLoader } from "@/lib/page-builder/GoogleFontLoader";
import { ComingSoonFallback } from "../_components/ComingSoonFallback";
import { DEFAULT_BRAND_KIT, type PublicPageSeo } from "@/lib/page-builder/types";
import { portfolioPublicUrl } from "@/lib/portfolio/publicUrl";
import { buildGalleryJsonLd, safeJsonLd } from "@/lib/page-builder/seo/jsonLd";
import { portfolioHeaderLogoUrl, portfolioSiteIconUrl } from "@/lib/storage/portfolioAssetUrls";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) return {};

  const { publicPage, name } = workspace;
  const seo = (publicPage?.seo as PublicPageSeo | undefined) ?? {};

  const title = `${name} — Gallery`;
  const seoDescription = publicPage?.seoDescription || undefined;
  const description =
    seo.galleryDescription ||
    seoDescription ||
    `${name} — Photography Portfolio`;
  const headerLogoUrl = portfolioHeaderLogoUrl(publicPage?.header);
  const iconUrl = portfolioSiteIconUrl(publicPage?.siteIcon, headerLogoUrl) || undefined;
  const ogImageUrl = seo.ogImageUrl || undefined;
  const galleryUrl = `${portfolioPublicUrl(workspace.slug)}/gallery`;
  const locale = resolvePublicChromeLocale(workspace);

  const result: Metadata = {
    title,
    description,
    alternates: { canonical: galleryUrl },
    openGraph: {
      title,
      description,
      url: galleryUrl,
      type: "website",
      siteName: name,
      locale,
      images: ogImageUrl ? [{ url: ogImageUrl }] : undefined,
    },
    twitter: {
      card: ogImageUrl ? "summary_large_image" : "summary",
      images: ogImageUrl ? [ogImageUrl] : undefined,
    },
    icons: iconUrl ? { icon: iconUrl, shortcut: iconUrl, apple: iconUrl } : undefined,
  };
  if (seo.noindex) result.robots = { index: false, follow: false };
  return result;
}

export default async function PortfolioGalleryPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) notFound();

  // gallery data is stored as Schema.Types.Mixed; normalize before <Render> so
  // legacy/partial persisted data can't 500 the route (see the Home page note).
  const rawGallery = (workspace.publicPage?.data as { gallery?: unknown } | null | undefined)?.gallery;
  const galleryData = normalizePublicPageData(
    rawGallery,
    new Set(Object.keys(puckConfig.components)),
    "gallery"
  );

  const locale = resolvePublicChromeLocale(workspace);
  const t = await getTranslations({ locale, namespace: "publicPage.chrome" });

  // Build gallery JSON-LD — injected in both branches.
  const [galleryLd, breadcrumbLd] = buildGalleryJsonLd({
    name: workspace.name,
    slug: workspace.slug,
    businessType: workspace.businessType || undefined,
  });

  if (!galleryData) {
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(galleryLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />
        <ComingSoonFallback
          workspace={workspace}
          labels={{ comingSoon: t("comingSoon"), poweredBy: t("poweredBy") }}
        />
      </>
    );
  }

  const { cssVars: brandVars } = resolveBrandKit(workspace.publicPage?.brandKit ?? DEFAULT_BRAND_KIT);

  const renderWorkspace = {
    ...buildRenderWorkspace(workspace),
    locale,
    brandVars,
    chrome: {
      startingFrom: t("startingFrom", { price: "{price}" }),
      socialLinkConfirm: t("socialLinkConfirm", { url: "{url}" }),
      gallery: {
        empty: t("gallery.empty"),
        noCollection: t("gallery.noCollection"),
        unavailable: t("gallery.unavailable"),
        error: t("gallery.error"),
        featuredEmpty: t("gallery.featuredEmpty"),
        carouselHint: t("gallery.carouselHint"),
        carouselPrev: t("gallery.carouselPrev"),
        carouselNext: t("gallery.carouselNext"),
      },
    },
  };

  return runWithRenderWorkspace(renderWorkspace, () => (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(galleryLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />
      {/* Per-block Google Font overrides (see lib/page-builder/fonts.ts) — the brand
          kit's own heading/body Google Font is loaded by the layout. */}
      <GoogleFontLoader families={collectGoogleFontFamilies(galleryData)} />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Render data={galleryData as any} config={puckConfig as any} metadata={{ workspace: renderWorkspace }} />
    </>
  ));
}
