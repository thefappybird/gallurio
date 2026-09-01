import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@measured/puck/rsc";
import { puckConfig } from "@/lib/page-builder/config";
import { buildRenderWorkspace, runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import { getTranslations } from "next-intl/server";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { hasRenderableBlocks, normalizePublicPageData } from "@/lib/page-builder/normalizePublicPageData";
import { collectGoogleFontFamilies } from "@/lib/page-builder/fonts";
import { GoogleFontLoader } from "@/lib/page-builder/GoogleFontLoader";
import { ComingSoonFallback } from "../_components/ComingSoonFallback";
import { PoweredByGallurio } from "../_components/PoweredByGallurio";
import { DEFAULT_BRAND_KIT, type PublicPageSeo } from "@/lib/page-builder/types";
import { portfolioGalleryUrl } from "@/lib/portfolio/publicUrl";
import { buildGalleryJsonLd, buildPortfolioEntityNodes, buildPortfolioJsonLdInput, safeJsonLd } from "@/lib/page-builder/seo/jsonLd";
import { portfolioSiteIconUrl } from "@/lib/storage/portfolioAssetUrls";
import { resolveGallerySeo, SEO_DEFAULT_KEYS } from "@/lib/portfolio/seoDefaults";
import { collectGalleryPublishedImages } from "@/lib/page-builder/seo/publishedImages.server";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) return {};

  const { publicPage, name } = workspace;
  const seo = (publicPage?.seo as PublicPageSeo | undefined) ?? {};
  const locale = resolvePublicChromeLocale(workspace);
  const t = await getTranslations({ locale, namespace: "publicPage.seoDefaults" });

  const galleryTitle = `${name} — Gallery`;
  const defaultDescription = t(SEO_DEFAULT_KEYS.galleryDescription, { name });
  const { title, description } = resolveGallerySeo({
    name,
    galleryDescription: seo.galleryDescription,
    seoDescription: publicPage?.seoDescription,
    defaultDescription,
    galleryTitle,
  });

  const iconUrl = portfolioSiteIconUrl(publicPage?.siteIcon) || undefined;
  const ogImageUrl = seo.ogImageUrl || undefined;
  const galleryUrl = portfolioGalleryUrl(workspace.slug);

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
  };
  // Only set `icons` when the workspace has a custom one — see the same
  // note in ../page.tsx: an explicit `icons: undefined` still blanks the
  // layout's default favicon during Next's metadata merge instead of
  // inheriting it.
  if (iconUrl) result.icons = { icon: iconUrl, shortcut: iconUrl, apple: iconUrl };
  const rawGallery = (publicPage?.data as { gallery?: unknown } | null | undefined)?.gallery;
  if (seo.noindex) result.robots = { index: false, follow: false };
  else if (!hasRenderableBlocks(rawGallery)) result.robots = { index: false, follow: true };
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
  const tNav = await getTranslations({ locale, namespace: "publicPage.nav" });

  // Published-image collection only makes sense once real gallery content
  // exists — the ComingSoon branch has no images by definition.
  const images = galleryData
    ? await collectGalleryPublishedImages({ workspaceId: String(workspace._id), galleryData })
    : [];

  // Build JSON-LD — injected in both branches. business/website nodes reuse
  // the same shared-entity mapping as the Home page (buildPortfolioJsonLdInput)
  // so this page's @id references to #business/#website resolve to nodes
  // defined in this page's own markup, not just the Home page's.
  const sharedJsonLdInput = buildPortfolioJsonLdInput(workspace);
  const [businessLd, websiteLd] = buildPortfolioEntityNodes(sharedJsonLdInput);
  const [galleryLd, breadcrumbLd] = buildGalleryJsonLd({ ...sharedJsonLdInput, images });

  if (!galleryData) {
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(businessLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteLd) }} />
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
      nav: {
        navLandmark: tNav("navLandmark"),
        home: tNav("home"),
        gallery: tNav("gallery"),
        contact: tNav("contact"),
        openMenu: tNav("openMenu"),
        closeMenu: tNav("closeMenu"),
      },
    },
  };

  return runWithRenderWorkspace(renderWorkspace, () => (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(businessLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(galleryLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />
      {/* Per-block Google Font overrides (see lib/page-builder/fonts.ts) — the brand
          kit's own heading/body Google Font is loaded by the layout. */}
      <GoogleFontLoader families={collectGoogleFontFamilies(galleryData)} />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Render data={galleryData as any} config={puckConfig as any} metadata={{ workspace: renderWorkspace }} />
      <PoweredByGallurio label={t("poweredBy")} />
    </>
  ));
}
