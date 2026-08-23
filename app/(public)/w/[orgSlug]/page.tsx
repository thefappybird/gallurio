import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@measured/puck/rsc";
import { puckConfig } from "@/lib/page-builder/config";
import { buildRenderWorkspace, runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import { getTranslations } from "next-intl/server";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { normalizePublicPageData } from "@/lib/page-builder/normalizePublicPageData";
import { collectGoogleFontFamilies } from "@/lib/page-builder/fonts";
import { GoogleFontLoader } from "@/lib/page-builder/GoogleFontLoader";
import { ComingSoonFallback } from "./_components/ComingSoonFallback";
import { PoweredByGallurio } from "./_components/PoweredByGallurio";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { DEFAULT_BRAND_KIT, type PublicPageSeo } from "@/lib/page-builder/types";
import { portfolioPublicUrl } from "@/lib/portfolio/publicUrl";
import { buildHomeJsonLd, safeJsonLd } from "@/lib/page-builder/seo/jsonLd";
import { portfolioHeaderLogoUrl, portfolioSiteIconUrl } from "@/lib/storage/portfolioAssetUrls";
import { resolveHomeSeo, SEO_DEFAULT_KEYS } from "@/lib/portfolio/seoDefaults";
import { BUSINESS_TYPE_VALUES } from "@/lib/validators/workspace";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) return {};

  const { publicPage, name } = workspace;
  const seo = (publicPage?.seo as PublicPageSeo | undefined) ?? {};
  const locale = resolvePublicChromeLocale(workspace);
  const t = await getTranslations({ locale, namespace: "publicPage.seoDefaults" });

  // Home's default description is only ever built from facts already on the
  // workspace (name + the business type the owner picked) — never invented.
  const businessType = workspace.businessType || undefined;
  const isKnownBusinessType =
    !!businessType && businessType !== "other" && (BUSINESS_TYPE_VALUES as readonly string[]).includes(businessType);
  const businessTypeLabelKey = isKnownBusinessType
    ? SEO_DEFAULT_KEYS.businessType[businessType as keyof typeof SEO_DEFAULT_KEYS.businessType]
    : undefined;
  const businessTypeLabel = businessTypeLabelKey ? t(businessTypeLabelKey) : null;
  const defaultDescription = businessTypeLabel
    ? t(SEO_DEFAULT_KEYS.homeDescription, { name, businessType: businessTypeLabel })
    : t(SEO_DEFAULT_KEYS.homeDescriptionGeneric, { name });

  const { title, description } = resolveHomeSeo({
    name,
    seoTitle: publicPage?.seoTitle,
    seoDescription: publicPage?.seoDescription,
    businessTypeLabel,
    defaultDescription,
  });

  const ogImageUrl = seo.ogImageUrl || undefined;
  const headerLogoUrl = portfolioHeaderLogoUrl(publicPage?.header);
  const iconUrl = portfolioSiteIconUrl(publicPage?.siteIcon, headerLogoUrl) || undefined;
  const canonical = portfolioPublicUrl(orgSlug);

  const result: Metadata = {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      siteName: name,
      locale,
      images: ogImageUrl ? [{ url: ogImageUrl }] : undefined,
    },
    twitter: {
      card: ogImageUrl ? "summary_large_image" : "summary",
      images: ogImageUrl ? [ogImageUrl] : undefined,
    },
  };
  // Only set `icons` when the workspace has a custom one — an explicit
  // `icons: undefined` here still counts as "set" during Next's metadata
  // merge and blanks out the layout's default favicon instead of inheriting
  // it, so the key must be omitted entirely to fall back correctly.
  if (iconUrl) result.icons = { icon: iconUrl, shortcut: iconUrl, apple: iconUrl };
  if (seo.noindex) result.robots = { index: false, follow: false };
  return result;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PortfolioHomePage({ params }: PageProps) {
  const { orgSlug } = await params;

  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) notFound();

  // publicPage is guaranteed non-null here — the query filters on publishedAt != null.
  // homeData is stored as Schema.Types.Mixed (raw `unknown` from the lean doc).
  // Normalize it before <Render>: Puck's RSC renderer assumes a well-formed Data
  // object (it does `'props' in data.root` with no defaulting), so legacy/partial
  // persisted data would 500 the whole route. null -> show the ComingSoon fallback.
  const rawHome = (workspace.publicPage?.data as { home?: unknown } | null | undefined)?.home;

  const homeData = normalizePublicPageData(
    rawHome,
    new Set(Object.keys(puckConfig.components)),
    "home"
  );

  // Derive chrome locale from workspace country and resolve translated strings
  // at the page boundary so blocks stay synchronous and unit-testable.
  const locale = resolvePublicChromeLocale(workspace);
  const t = await getTranslations({ locale, namespace: "publicPage.chrome" });
  const tPopup = await getTranslations({ locale, namespace: "publicPage.collectionPopup" });

  // Build JSON-LD once — injected in both the ComingSoon branch and the main render.
  const socials = workspace.contact?.socials;
  const sameAs: string[] = [];
  if (socials?.instagram) sameAs.push(`https://www.instagram.com/${socials.instagram}`);
  if (socials?.facebook) sameAs.push(`https://www.facebook.com/${socials.facebook}`);
  if (socials?.tiktok) sameAs.push(`https://www.tiktok.com/@${socials.tiktok}`);
  if (socials?.website) sameAs.push(socials.website);

  const [businessLd, websiteLd, webpageLd] = buildHomeJsonLd({
    name: workspace.name,
    slug: workspace.slug,
    businessType: workspace.businessType || undefined,
    description: workspace.publicPage?.seoDescription || undefined,
    image:
      (workspace.publicPage?.seo as { ogImageUrl?: string } | undefined)?.ogImageUrl ||
      workspace.publicPage?.siteIcon?.url ||
      undefined,
    email: workspace.contact?.email || undefined,
    phone: workspace.contact?.phone || undefined,
    address: workspace.contact?.address || undefined,
    sameAs,
    keywords: (workspace.publicPage?.seo as { keywords?: string[] } | undefined)?.keywords,
  });

  // ComingSoonFallback does not need workspace block context — only <Render>
  // (and the blocks it invokes) reads the AsyncLocalStorage store.
  if (!homeData) {
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(businessLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(webpageLd) }} />
        <ComingSoonFallback
          workspace={workspace}
          labels={{ comingSoon: t("comingSoon"), poweredBy: t("poweredBy") }}
        />
      </>
    );
  }

  const { cssVars: brandVars } = resolveBrandKit(workspace.publicPage?.brandKit ?? DEFAULT_BRAND_KIT);

  // buildRenderWorkspace copies workspace-level fields (contact, etc.).
  const renderWorkspace = {
    ...buildRenderWorkspace(workspace),
    locale,
    brandVars,
    // Pass the ICU template with "{price}" preserved for per-item substitution
    // in ServicesListBlock — ICU substitutes price: "{price}" → literal token.
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

  const renderMetadata = {
    workspace: renderWorkspace,
    collectionPopupLabels: {
      close: tPopup("close"),
      loading: tPopup("loading"),
      failed: tPopup("failed"),
      retry: tPopup("retry"),
      empty: tPopup("empty"),
      fullSizeAlt: tPopup("fullSizeAlt"),
    },
  };

  // runWithRenderWorkspace gives every server block rendered inside this tree
  // an isolated, request-scoped store. Concurrent requests cannot clobber
  // each other's workspace context (unlike a module-level singleton).
  return runWithRenderWorkspace(renderWorkspace, () => (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(businessLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(webpageLd) }} />
      {/* Per-block Google Font overrides (see lib/page-builder/fonts.ts) — the brand
          kit's own heading/body Google Font is loaded by the layout. */}
      <GoogleFontLoader families={collectGoogleFontFamilies(homeData)} />
      {/* metadata threads workspace context to every block via props.puck.metadata —
          the RSC-safe path (AsyncLocalStorage doesn't survive into async block render). */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Render data={homeData as any} config={puckConfig as any} metadata={renderMetadata} />
      <PoweredByGallurio label={t("poweredBy")} />
    </>
  ));
}
