import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { collectGoogleFontFamilies } from "@/lib/page-builder/fonts";
import { GoogleFontLoader } from "@/lib/page-builder/GoogleFontLoader";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import { resolveEffectiveDir } from "@/lib/i18n/rtl";
import { notFound } from "next/navigation";
import { PortfolioHeader } from "./_components/PortfolioHeader";
import { ContactModal } from "./_components/ContactModal";
import { SyncDocumentLang } from "./_components/SyncDocumentLang";
import { MotionObserver } from "@/lib/page-builder/MotionObserver.client";
import { PageViewBeacon } from "./_components/PageViewBeacon";
import { buildContactLabels } from "./_components/buildContactLabels";
import ContactTriggerDelegate from "@/lib/page-builder/contactTrigger.client";
import type { PortfolioContactConfig, PortfolioHeaderConfig } from "@/lib/page-builder/types";

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
  const tLocationPicker = await getTranslations({
    locale,
    namespace: "app.bookings.locationPicker",
  });

  const contactLabels = buildContactLabels(tContact, tLocationPicker);
  const contactConfig = (workspace.publicPage?.contact ?? null) as PortfolioContactConfig | null;
  const headerConfig = (workspace.publicPage?.header ?? null) as PortfolioHeaderConfig | null;

  const storedDir = workspace.publicPage?.formDir as "ltr" | "rtl" | "" | undefined;
  const effectiveDir = resolveEffectiveDir(storedDir, locale);

  return (
    <div
      lang={locale}
      dir={effectiveDir}
      style={{ ...cssVars, color: "var(--pf-color-fg)", fontFamily: "var(--pf-font-body)" } as React.CSSProperties}
      className={`${className} min-h-svh`}
    >
      <SyncDocumentLang locale={locale} />
      {/* Brand kit heading/body may be a Google Font (see fonts.ts) — next/font/google
          can't be used since the choice is per-workspace runtime data, not known at
          build time. Loads via a dynamically-injected CSS2 <link>; per-block Google
          Font overrides are loaded by the page (page.tsx / gallery/page.tsx). */}
      <GoogleFontLoader families={collectGoogleFontFamilies(brandKit)} />
      <PortfolioHeader
        slug={workspace.slug}
        labels={{
          brand: workspace.name,
          navLandmark: tNav("navLandmark"),
          home: tNav("home"),
          gallery: tNav("gallery"),
          contact: tNav("contact"),
          openMenu: tNav("openMenu"),
          closeMenu: tNav("closeMenu"),
        }}
        config={headerConfig}
      />
      {children}
      <PageViewBeacon orgSlug={workspace.slug} />
      <MotionObserver />
      <ContactTriggerDelegate />
      <ContactModal
        workspaceSlug={workspace.slug}
        contact={contactConfig}
        labels={contactLabels}
        brandVars={cssVars}
      />
    </div>
  );
}
