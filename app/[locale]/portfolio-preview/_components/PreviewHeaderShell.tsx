"use client";

import { PortfolioHeader, type PortfolioHeaderLabels } from "@/app/(public)/w/[orgSlug]/_components/PortfolioHeader";
import type { PortfolioHeaderConfig } from "@/lib/page-builder/types";
import { usePreviewDraft } from "./PreviewDraftContext";

/**
 * Preview wrapper for PortfolioHeader — renders the header in the portfolio
 * preview iframe. Reads the unsaved draft headerConfig from PreviewDraftContext
 * (provided by PreviewBrandShell) and overrides the server-supplied DB fallback
 * config so unsaved header style edits are visible in preview before saving.
 */
export function PreviewHeaderShell({
  slug,
  fallbackConfig,
  activePath,
  homeHref,
  galleryHref,
  labels,
}: {
  slug: string;
  fallbackConfig: PortfolioHeaderConfig | null;
  activePath: string;
  homeHref: string;
  /** Override for the Gallery nav href so clicking it stays within the
   * draft-aware preview iframe instead of navigating to the published site. */
  galleryHref?: string;
  labels: PortfolioHeaderLabels;
}) {
  const { headerConfig } = usePreviewDraft();
  const config = headerConfig ?? fallbackConfig;

  return (
    <PortfolioHeader
      slug={slug}
      config={config}
      activePath={activePath}
      homeHref={homeHref}
      galleryHref={galleryHref}
      labels={labels}
    />
  );
}
