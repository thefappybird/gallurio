import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { buildRenderWorkspace } from "@/lib/page-builder/serverContext";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import { resolveEffectiveDir } from "@/lib/i18n/rtl";
import { routing } from "@/lib/i18n/routing";
import { reconcileGalleryImages, reconcileFeaturedCollections } from "@/lib/page-builder/reconcile";
import { PortfolioDraft } from "@/lib/db/models";
import {
  DEFAULT_BRAND_KIT,
  type PortfolioContactConfig,
  type PortfolioCollectionsPopupConfig,
  type PuckData,
} from "@/lib/page-builder/types";
import { buildContactLabels } from "@/app/(public)/w/[orgSlug]/_components/buildContactLabels";
import {
  resolveAddSessionAppearance,
  resolveSubmitAppearance,
} from "@/app/(public)/w/[orgSlug]/_components/contactButtonAppearance";
import { PreviewContactCard } from "./_components/PreviewContactCard";
import { PreviewContactModal } from "./_components/PreviewContactModal";
import { PreviewClient } from "./_components/PreviewClient";
import { PreviewBrandShell } from "./_components/PreviewBrandShell";
import { PreviewPopupShell } from "./_components/PreviewPopupShell";

// Owner-only draft preview — never indexed, always rendered fresh from the
// current (possibly unpublished) draft.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

type PreviewZone = "home" | "gallery" | "contact" | "popup";

function parseZone(value: string | string[] | undefined): PreviewZone {
  if (value === "gallery") return "gallery";
  if (value === "contact") return "contact";
  if (value === "popup") return "popup";
  return "home";
}

/**
 * Chrome-less live preview of the portfolio draft, loaded in an iframe by the
 * page-builder editor. Lives directly under `[locale]` (not `(app)`) so it
 * inherits the providers + brand fonts but NOT the app sidebar — the iframe
 * shows only the rendered page. Reads the draft (no `publishedAt` gate) so the
 * owner previews unpublished work; gated to the workspace owner.
 *
 * HOME/GALLERY zones: rendered client-side via <PreviewClient> which reads the
 * unsaved draft from localStorage — avoids HTTP 431 from large URL params.
 * CONTACT zone: rendered server-side from DB (last-saved contact config).
 * POPUP zone: dedicated collections-popup preview surface that mirrors the
 *   editor's CollectionsPopupPreview; driven by the localStorage draft config
 *   (via PreviewBrandShell → PreviewDraftContext) with DB fallback.
 *
 * Brand-kit CSS vars, contact config, and collectionsPopup config are initially
 * sourced from DB; PreviewBrandShell and the Preview*Shell client components
 * override each with the localStorage draft on mount, so unsaved edits are
 * visible in preview without saving. The header is no longer a separate
 * shell — it renders inline as the page's own Navigation block, same as the
 * public site.
 */
export default async function PortfolioPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    zone?: string | string[];
    formLocale?: string | string[];
    formDir?: string | string[];
    draftId?: string | string[];
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const zone = parseZone(sp.zone);

  const { workspace, role } = await requireOrg();
  if (role !== "owner") notFound();

  const pp = workspace.publicPage;
  const { cssVars, className } = resolveBrandKit(pp?.brandKit ?? DEFAULT_BRAND_KIT);

  // A live in-editor language switch overrides the DB-resolved chrome locale —
  // pure override, not a new default (falls back to the existing resolution
  // when formLocale is absent or not a supported locale).
  const requestedFormLocale =
    typeof sp.formLocale === "string" ? sp.formLocale : undefined;
  const chromeLocale =
    requestedFormLocale &&
    (routing.locales as readonly string[]).includes(requestedFormLocale)
      ? (requestedFormLocale as (typeof routing.locales)[number])
      : resolvePublicChromeLocale(workspace);
  const effectiveDir = resolveEffectiveDir(
    typeof sp.formDir === "string" ? (sp.formDir as "ltr" | "rtl" | "") : (workspace.publicPage?.formDir as "ltr" | "rtl" | "" | undefined),
    chromeLocale,
  );
  const tNav = await getTranslations({ locale: chromeLocale, namespace: "publicPage.nav" });
  // DB fallback — PreviewPopupShell overrides with the localStorage draft on mount.
  const collectionsPopupConfig = (pp?.collectionsPopup ?? null) as PortfolioCollectionsPopupConfig | null;

  // Built unconditionally so PreviewContactModal can mount in home/gallery zones,
  // enabling the navbar Contact button to open the modal (mirrors public layout).
  const tForm = await getTranslations({ locale: chromeLocale, namespace: "publicPage.inquiryForm" });
  const tLocationPicker = await getTranslations({
    locale: chromeLocale,
    namespace: "app.bookings.locationPicker",
  });
  const dbContact = (pp?.contact ?? null) as PortfolioContactConfig | null;
  const contactLabels = buildContactLabels(tForm, tLocationPicker);

  let body: React.ReactNode;

  if (zone === "contact") {
    body = (
      <PreviewContactCard
        workspaceSlug={workspace.slug}
        title={dbContact?.title?.trim() || contactLabels.title}
        description={dbContact?.description?.trim() || contactLabels.description}
        labels={contactLabels.form}
        submitAppearance={resolveSubmitAppearance(dbContact)}
        addSessionAppearance={resolveAddSessionAppearance(dbContact)}
      />
    );
  } else if (zone === "popup") {
    // Dedicated popup-preview surface: mirrors the editor's CollectionsPopupPreview.
    // No page header — the popup overlays the full viewport.
    body = <PreviewPopupShell fallbackConfig={collectionsPopupConfig} />;
  } else {
    const t = await getTranslations({ locale: chromeLocale, namespace: "publicPage.chrome" });
    // Preview-scoped nav override — keeps the Navigation block's Home/Gallery
    // links inside this iframe instead of navigating to the live public site
    // (see blockContext.ts's `RenderWorkspace.previewNav`). formLocale/formDir
    // are re-appended so an in-editor language switch survives a Home<->Gallery
    // click inside the preview.
    const previewBasePath = `/${locale}/portfolio-preview`;
    const previewQuery = `formLocale=${chromeLocale}&formDir=${effectiveDir}`;
    const previewHomeHref = `${previewBasePath}?zone=home&${previewQuery}`;
    const previewGalleryHref = `${previewBasePath}?zone=gallery&${previewQuery}`;
    const renderWorkspace = {
      ...buildRenderWorkspace(workspace),
      locale: chromeLocale,
      brandVars: cssVars,
      previewNav: {
        homeHref: previewHomeHref,
        galleryHref: previewGalleryHref,
        activePath: zone === "gallery" ? previewGalleryHref : previewHomeHref,
      },
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

    let fallbackData: PuckData =
      ((pp?.data as Record<string, unknown> | null | undefined)?.[zone] as PuckData | undefined) ??
      { content: [], root: {} };

    const draftIdParam = typeof sp.draftId === "string" ? sp.draftId : undefined;
    // Tracks which draft fallbackData actually corresponds to, so the client
    // only applies its localStorage buffer when it matches — otherwise a
    // stale buffer for a different draft would render instead of the
    // requested one.
    let resolvedDraftId: string | null = null;
    if (draftIdParam && Types.ObjectId.isValid(draftIdParam)) {
      const draftDoc = await PortfolioDraft.findOne(
        { _id: draftIdParam, workspaceId: workspace._id },
        { data: 1 },
      ).lean();
      const draftZoneData = draftDoc?.data?.[zone] as PuckData | undefined;
      if (draftZoneData) {
        fallbackData = draftZoneData;
        resolvedDraftId = draftIdParam;
      }
    }

    // Same rebuild the editor canvas applies (see app/[locale]/(app)/portfolio/page.tsx's
    // reconcileZone) — keeps the preview's image cache/collections in sync with live
    // GalleryItems/GalleryCollections instead of showing what was baked at save time.
    const workspaceId = String(workspace._id);
    fallbackData = await reconcileFeaturedCollections(
      workspaceId,
      await reconcileGalleryImages(workspaceId, fallbackData),
    );

    body = (
      <PreviewClient
        slug={workspace.slug}
        zone={zone}
        workspace={renderWorkspace}
        fallbackData={fallbackData}
        draftId={resolvedDraftId}
      />
    );
  }

  // The popup zone fills the full viewport — skip the nav header.
  const showHeader = zone !== "popup";

  return (
    <div lang={chromeLocale} dir={effectiveDir}>
      <PreviewBrandShell
        slug={workspace.slug}
        fallbackCssVars={cssVars}
        fallbackClassName={className}
      >
        {/* The header now renders inline as the page's own Navigation block —
            see PreviewClient's <Render> — not as a separate shell here. */}
        {body}
        {/* Mount contact modal only when the header is visible (home/gallery zones).
            The contact zone shows PreviewContactCard instead; popup zone has no header.
            This mirrors the public layout's ContactModal mount. */}
        {showHeader && zone !== "contact" && (
          <PreviewContactModal
            workspaceSlug={workspace.slug}
            dbContact={dbContact}
            labels={contactLabels}
          />
        )}
      </PreviewBrandShell>
    </div>
  );
}
