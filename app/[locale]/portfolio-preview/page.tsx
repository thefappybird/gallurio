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
  const requestedDraftId =
    typeof sp.draftId === "string" && Types.ObjectId.isValid(sp.draftId) ? sp.draftId : null;

  const { workspace, role } = await requireOrg();
  if (role !== "owner") notFound();

  const pp = workspace.publicPage;
  // A saved draft is the baseline for every preview surface, not only its
  // Puck zone data. This prevents saved draft copy from rendering with a
  // published-page brand kit after the local buffer has been retired.
  const selectedDraft = requestedDraftId
    ? await PortfolioDraft.findOne(
      { _id: requestedDraftId, workspaceId: workspace._id },
      { data: 1, brandKit: 1, contact: 1, collectionsPopup: 1, formLocale: 1, formDir: 1 },
    ).lean()
    : null;
  const resolvedDraftId = selectedDraft ? requestedDraftId : null;
  const previewBrandKit = selectedDraft?.brandKit ?? pp?.brandKit ?? DEFAULT_BRAND_KIT;
  const { cssVars, className } = resolveBrandKit(previewBrandKit);

  // A live in-editor language switch overrides the DB-resolved chrome locale —
  // pure override, not a new default (falls back to the existing resolution
  // when formLocale is absent or not a supported locale).
  const requestedFormLocale =
    typeof sp.formLocale === "string" ? sp.formLocale : undefined;
  const chromeLocale =
    requestedFormLocale &&
    (routing.locales as readonly string[]).includes(requestedFormLocale)
      ? (requestedFormLocale as (typeof routing.locales)[number])
      : (
        selectedDraft?.formLocale && (routing.locales as readonly string[]).includes(selectedDraft.formLocale)
          ? selectedDraft.formLocale as (typeof routing.locales)[number]
          : resolvePublicChromeLocale(workspace)
      );
  const effectiveDir = resolveEffectiveDir(
    typeof sp.formDir === "string"
      ? (sp.formDir as "ltr" | "rtl" | "")
      : ((selectedDraft?.formDir ?? workspace.publicPage?.formDir) as "ltr" | "rtl" | "" | undefined),
    chromeLocale,
  );
  const tNav = await getTranslations({ locale: chromeLocale, namespace: "publicPage.nav" });
  const tPopup = await getTranslations({ locale: chromeLocale, namespace: "publicPage.collectionPopup" });
  // DB fallback — PreviewPopupShell overrides with the localStorage draft on mount.
  const collectionsPopupConfig = (selectedDraft?.collectionsPopup ?? pp?.collectionsPopup ?? null) as PortfolioCollectionsPopupConfig | null;

  // Built unconditionally so PreviewContactModal can mount in home/gallery zones,
  // enabling the navbar Contact button to open the modal (mirrors public layout).
  const tForm = await getTranslations({ locale: chromeLocale, namespace: "publicPage.inquiryForm" });
  const tLocationPicker = await getTranslations({
    locale: chromeLocale,
    namespace: "app.bookings.locationPicker",
  });
  const dbContact = (selectedDraft?.contact ?? pp?.contact ?? null) as PortfolioContactConfig | null;
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
        dir={effectiveDir}
      />
    );
  } else if (zone === "popup") {
    // Dedicated popup-preview surface: mirrors the editor's CollectionsPopupPreview.
    // No page header — the popup overlays the full viewport.
    body = <PreviewPopupShell fallbackConfig={collectionsPopupConfig} dir={effectiveDir} />;
  } else {
    const t = await getTranslations({ locale: chromeLocale, namespace: "publicPage.chrome" });
    let fallbackData: PuckData =
      ((pp?.data as Record<string, unknown> | null | undefined)?.[zone] as PuckData | undefined) ??
      { content: [], root: {} };
    let resolvedCollectionsPopup = collectionsPopupConfig;
    if (selectedDraft) {
      const draftZoneData = selectedDraft.data?.[zone] as PuckData | undefined;
      if (draftZoneData) {
        fallbackData = draftZoneData;
      }
    }
    // Preview-scoped nav override — keeps the Navigation block's Home/Gallery
    // links inside this iframe instead of navigating to the live public site
    // (see blockContext.ts's `RenderWorkspace.previewNav`). formLocale/formDir
    // are re-appended so an in-editor language switch survives a Home<->Gallery
    // click inside the preview.
    const previewBasePath = `/${locale}/portfolio-preview`;
    const previewQuery =
      `formLocale=${chromeLocale}&formDir=${effectiveDir}` +
      (resolvedDraftId ? `&draftId=${encodeURIComponent(resolvedDraftId)}` : "");
    const previewHomeHref = `${previewBasePath}?zone=home&${previewQuery}`;
    const previewGalleryHref = `${previewBasePath}?zone=gallery&${previewQuery}`;
    const baseRenderWorkspace = buildRenderWorkspace(workspace);
    const renderWorkspace = {
      ...baseRenderWorkspace,
      publicPage: {
        ...(baseRenderWorkspace.publicPage ?? {}),
        collectionsPopup: resolvedCollectionsPopup,
      },
      locale: chromeLocale,
      dir: effectiveDir,
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
          featuredSelect: t("gallery.featuredSelect"),
          carouselHint: t("gallery.carouselHint"),
          carouselPrev: t("gallery.carouselPrev"),
          carouselNext: t("gallery.carouselNext"),
          lightboxAdditionalInformation: t("gallery.lightboxAdditionalInformation"),
          lightboxDate: t("gallery.lightboxDate"),
          lightboxLocation: t("gallery.lightboxLocation"),
          lightboxClient: t("gallery.lightboxClient"),
          lightboxTags: t("gallery.lightboxTags"),
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

    // Tracks which draft fallbackData actually corresponds to, so the client
    // only applies its localStorage buffer when it matches — otherwise a
    // stale buffer for a different draft would render instead of the
    // requested one.
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
        collectionPopupLabels={{
          close: tPopup("close"),
          loading: tPopup("loading"),
          failed: tPopup("failed"),
          retry: tPopup("retry"),
          empty: tPopup("empty"),
          fullSizeAlt: tPopup("fullSizeAlt"),
          openPhoto: tPopup("openPhoto"),
          photo: tPopup("photo"),
          loadMore: tPopup("loadMore"),
          loadingMore: tPopup("loadingMore"),
          loadMoreFailed: tPopup("loadMoreFailed"),
          photoCountOne: tPopup("photoCountOne"),
          photoCountOther: tPopup("photoCountOther", { count: "{count}" }),
          previousPhoto: tPopup("previousPhoto"),
          nextPhoto: tPopup("nextPhoto"),
          filmstripLabel: tPopup("filmstripLabel"),
          dateLabel: tPopup("dateLabel"),
          locationLabel: tPopup("locationLabel"),
          clientLabel: tPopup("clientLabel"),
          tagsLabel: tPopup("tagsLabel"),
          photoOf: t("gallery.lightboxPhotoOf", { current: "{current}", total: "{total}" }),
          // Reused from the Gallery blocks' own chrome — same concept, same copy.
          counter: t("gallery.lightboxCounter", { current: "{current}", total: "{total}" }),
          seeMore: t("gallery.lightboxSeeMore"),
          seeLess: t("gallery.lightboxSeeLess"),
          additionalInformation: t("gallery.lightboxAdditionalInformation"),
        }}
      />
    );
  }

  // The popup zone fills the full viewport — skip the nav header.
  const showHeader = zone !== "popup";

  return (
    <div lang={chromeLocale} dir="ltr">
      <PreviewBrandShell
        slug={workspace.slug}
        draftId={resolvedDraftId}
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
            dir={effectiveDir}
          />
        )}
      </PreviewBrandShell>
    </div>
  );
}
