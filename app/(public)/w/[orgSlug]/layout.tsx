import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import {
  findPublishedWorkspaceBySlug,
  resolveWorkspaceOwnerBySlug,
  getOwnerTimeFormat,
} from "@/lib/db/queries/publicPage";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { collectGoogleFontFamilies } from "@/lib/page-builder/fonts";
import { GoogleFontLoader } from "@/lib/page-builder/GoogleFontLoader";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import { resolveEffectiveDir } from "@/lib/i18n/rtl";
import { notFound } from "next/navigation";
import { ContactModal } from "./_components/ContactModal";
import { MotionObserver } from "@/lib/page-builder/MotionObserver.client";
import { PageViewBeacon } from "./_components/PageViewBeacon";
import { buildContactLabels } from "./_components/buildContactLabels";
import ContactTriggerDelegate from "@/lib/page-builder/contactTrigger.client";
import type { PortfolioContactConfig, PortfolioHeaderConfig } from "@/lib/page-builder/types";
import { portfolioGalleryPath, portfolioHomePath } from "@/lib/portfolio/publicUrl";
import { Render } from "@measured/puck/rsc";
import { puckConfig } from "@/lib/page-builder/config";
import { buildRenderWorkspace } from "@/lib/page-builder/serverContext";
import { normalizeSharedChromeData } from "@/lib/page-builder/sharedChrome";
import type { PuckData } from "@/lib/page-builder/types";

/**
 * Layout for the public portfolio page (`/w/[orgSlug]`).
 *
 * Responsibilities:
 * - Verifies the workspace is published (404 otherwise — mirrors page.tsx so
 *   the layout and page are always in sync).
 * - Applies brand-kit CSS custom properties to the wrapper div so every child
 *   component can reach `--pf-color-*`, `--pf-radius`, and `--pf-font-*`
 *   without prop-drilling.
 * - Sets the `lang` attribute on the wrapper span based on the workspace's
 *   country — the public page is intentionally outside the `[locale]` segment.
 *
 * The brand-kit variables are scoped to this subtree only — they never reach
 * the app chrome rendered by the authenticated `[locale]/(app)` layout.
 */
export default async function PublicPortfolioLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) notFound();

  const brandKit = workspace.publicPage?.brandKit ?? DEFAULT_BRAND_KIT;
  const { cssVars, className } = resolveBrandKit(brandKit);

  const locale = resolvePublicChromeLocale(workspace);
  const tNav = await getTranslations({ locale, namespace: "publicPage.nav" });
  const tContact = await getTranslations({ locale, namespace: "publicPage.inquiryForm" });
  const tChrome = await getTranslations({ locale, namespace: "publicPage.chrome" });
  const tLocationPicker = await getTranslations({
    locale,
    namespace: "app.bookings.locationPicker",
  });

  const contactLabels = buildContactLabels(tContact, tLocationPicker);
  const ownerUserId = await resolveWorkspaceOwnerBySlug(orgSlug);
  const timeMode = ownerUserId ? await getOwnerTimeFormat(ownerUserId) : undefined;
  const contactConfig = (workspace.publicPage?.contact ?? null) as PortfolioContactConfig | null;
  const headerConfig = (workspace.publicPage?.header ?? null) as PortfolioHeaderConfig | null;
  const sharedData = normalizeSharedChromeData(
    {
      home: workspace.publicPage?.data?.home as PuckData | null,
      gallery: workspace.publicPage?.data?.gallery as PuckData | null,
      navigation: workspace.publicPage?.data?.navigation as PuckData | null,
      footer: workspace.publicPage?.data?.footer as PuckData | null,
    },
    headerConfig,
  );

  const storedDir = workspace.publicPage?.formDir as "ltr" | "rtl" | "" | undefined;
  const effectiveDir = resolveEffectiveDir(storedDir, locale);
  const renderWorkspace = {
    ...buildRenderWorkspace(workspace),
    locale,
    brandVars: cssVars,
    chrome: {
      startingFrom: tChrome("startingFrom", { price: "{price}" }),
      socialLinkConfirm: tChrome("socialLinkConfirm", { url: "{url}" }),
      navigation: {
        labels: {
          brand: workspace.name,
          navLandmark: tNav("navLandmark"),
          home: tNav("home"),
          gallery: tNav("gallery"),
          contact: tNav("contact"),
          openMenu: tNav("openMenu"),
          closeMenu: tNav("closeMenu"),
        },
        homeHref: portfolioHomePath(workspace.slug),
        galleryHref: portfolioGalleryPath(workspace.slug),
      },
      gallery: {
        empty: tChrome("gallery.empty"),
        noCollection: tChrome("gallery.noCollection"),
        unavailable: tChrome("gallery.unavailable"),
        error: tChrome("gallery.error"),
        featuredEmpty: tChrome("gallery.featuredEmpty"),
        carouselHint: tChrome("gallery.carouselHint"),
        carouselPrev: tChrome("gallery.carouselPrev"),
        carouselNext: tChrome("gallery.carouselNext"),
      },
    },
  };

  return (
    <div
      lang={locale}
      dir={effectiveDir}
      style={{ ...cssVars, backgroundColor: "var(--pf-color-bg)", color: "var(--pf-color-fg)", fontFamily: "var(--pf-font-body)" } as React.CSSProperties}
      className={`${className} min-h-svh`}
    >
      {/* Brand kit heading/body may be a Google Font (see fonts.ts) — next/font/google
          can't be used since the choice is per-workspace runtime data, not known at
          build time. Loads via a dynamically-injected CSS2 <link>; per-block Google
          Font overrides are loaded by the page (page.tsx / gallery/page.tsx). */}
      <GoogleFontLoader families={collectGoogleFontFamilies({ brandKit, sharedData })} />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Render data={sharedData.navigation as any} config={puckConfig as any} metadata={{ workspace: renderWorkspace }} />
      {children}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Render data={sharedData.footer as any} config={puckConfig as any} metadata={{ workspace: renderWorkspace }} />
      <PageViewBeacon orgSlug={workspace.slug} />
      <MotionObserver />
      <ContactTriggerDelegate />
      <ContactModal
        workspaceSlug={workspace.slug}
        contact={contactConfig}
        labels={contactLabels}
        brandVars={cssVars}
        timeMode={timeMode}
      />
    </div>
  );
}
