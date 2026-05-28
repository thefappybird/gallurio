import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import { localeForCountry } from "@/lib/i18n/localeForCountry";
import { notFound } from "next/navigation";
import { PortfolioHeader } from "./_components/PortfolioHeader";

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

  const locale = localeForCountry(workspace.country);
  const tNav = await getTranslations({ locale, namespace: "publicPage.nav" });

  return (
    <div
      lang={locale}
      style={cssVars as React.CSSProperties}
      className={className}
    >
      <PortfolioHeader
        slug={workspace.slug}
        labels={{
          brand: workspace.name,
          home: tNav("home"),
          gallery: tNav("gallery"),
          contact: tNav("contact"),
          openMenu: tNav("openMenu"),
          closeMenu: tNav("closeMenu"),
        }}
      />
      {children}
    </div>
  );
}
