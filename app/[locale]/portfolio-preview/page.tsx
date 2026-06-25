import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { buildRenderWorkspace } from "@/lib/page-builder/serverContext";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import {
  DEFAULT_BRAND_KIT,
  type PortfolioContactConfig,
  type PortfolioCollectionsPopupConfig,
  type PortfolioHeaderConfig,
  type PuckData,
} from "@/lib/page-builder/types";
import { buildContactLabels } from "@/app/(public)/w/[orgSlug]/_components/buildContactLabels";
import {
  resolveAddSessionAppearance,
  resolveSubmitAppearance,
} from "@/app/(public)/w/[orgSlug]/_components/contactButtonAppearance";
import { PreviewContactCard } from "./_components/PreviewContactCard";
import { PreviewClient } from "./_components/PreviewClient";
import { PreviewBrandShell } from "./_components/PreviewBrandShell";
import { PreviewHeaderShell } from "./_components/PreviewHeaderShell";
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
 * Brand-kit CSS vars, header config, contact config, and collectionsPopup config
 * are initially sourced from DB; PreviewBrandShell and the Preview*Shell client
 * components override each with the localStorage draft on mount, so unsaved
 * edits are visible in preview without saving.
 */
export default async function PortfolioPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ zone?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const zone = parseZone(sp.zone);

  const { workspace, role } = await requireOrg();
  if (role !== "owner") notFound();

  const pp = workspace.publicPage;
  const { cssVars, className } = resolveBrandKit(pp?.brandKit ?? DEFAULT_BRAND_KIT);

  const chromeLocale = resolvePublicChromeLocale(workspace);
  const tNav = await getTranslations({ locale: chromeLocale, namespace: "publicPage.nav" });
  // DB fallback — PreviewHeaderShell overrides with the localStorage draft on mount.
  const headerConfig = (pp?.header ?? null) as PortfolioHeaderConfig | null;
  // DB fallback — PreviewPopupShell overrides with the localStorage draft on mount.
  const collectionsPopupConfig = (pp?.collectionsPopup ?? null) as PortfolioCollectionsPopupConfig | null;
  const activePath = zone === "gallery" ? `/w/${workspace.slug}/gallery` : `/w/${workspace.slug}`;
  // Keep the logo + Home link within the preview iframe; do not navigate to the
  // published public site.
  const previewHomeHref = `/${locale}/portfolio-preview`;

  let body: React.ReactNode;

  if (zone === "contact") {
    const tForm = await getTranslations({ locale: chromeLocale, namespace: "publicPage.inquiryForm" });
    const tLocationPicker = await getTranslations({
      locale: chromeLocale,
      namespace: "app.bookings.locationPicker",
    });
    const contact = (pp?.contact ?? null) as PortfolioContactConfig | null;
    const labels = buildContactLabels(tForm, tLocationPicker);
    body = (
      <PreviewContactCard
        workspaceSlug={workspace.slug}
        title={contact?.title?.trim() || labels.title}
        description={contact?.description?.trim() || labels.description}
        labels={labels.form}
        submitAppearance={resolveSubmitAppearance(contact)}
        addSessionAppearance={resolveAddSessionAppearance(contact)}
      />
    );
  } else if (zone === "popup") {
    // Dedicated popup-preview surface: mirrors the editor's CollectionsPopupPreview.
    // No page header — the popup overlays the full viewport.
    body = <PreviewPopupShell fallbackConfig={collectionsPopupConfig} />;
  } else {
    const t = await getTranslations({ locale: chromeLocale, namespace: "publicPage.chrome" });
    const renderWorkspace = {
      ...buildRenderWorkspace(workspace),
      locale: chromeLocale,
      chrome: {
        startingFrom: t("startingFrom", { price: "{price}" }),
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

    const fallbackData: PuckData =
      ((pp?.data as Record<string, unknown> | null | undefined)?.[zone] as PuckData | undefined) ??
      { content: [], root: {} };

    body = (
      <PreviewClient
        slug={workspace.slug}
        zone={zone}
        workspace={renderWorkspace}
        fallbackData={fallbackData}
      />
    );
  }

  // The popup zone fills the full viewport — skip the nav header.
  const showHeader = zone !== "popup";

  return (
    <PreviewBrandShell
      slug={workspace.slug}
      fallbackCssVars={cssVars}
      fallbackClassName={className}
    >
      {showHeader && (
        <PreviewHeaderShell
          slug={workspace.slug}
          fallbackConfig={headerConfig}
          activePath={activePath}
          homeHref={previewHomeHref}
          labels={{
            brand: workspace.name,
            navLandmark: tNav("navLandmark"),
            home: tNav("home"),
            gallery: tNav("gallery"),
            contact: tNav("contact"),
            openMenu: tNav("openMenu"),
            closeMenu: tNav("closeMenu"),
          }}
        />
      )}
      {body}
    </PreviewBrandShell>
  );
}
