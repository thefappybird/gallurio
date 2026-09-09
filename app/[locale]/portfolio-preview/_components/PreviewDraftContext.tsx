"use client";

import { createContext, useContext } from "react";
import type {
  PortfolioContactConfig,
  PortfolioCollectionsPopupConfig,
} from "@/lib/page-builder/types";

/**
 * Holds the parsed localStorage draft configs for the preview surfaces that
 * are not covered by CSS vars (those live in PreviewBrandShell already).
 * null means "no draft — use DB fallback". The header is no longer plumbed
 * here — it renders inline as the page's own Navigation block.
 * cssVars: the currently-active resolved brand CSS vars (draft override or DB
 * fallback); exposed here so ContactModal (which portals to document.body) can
 * receive the correct vars without re-running resolveBrandKit.
 */
export type PreviewDraftConfigs = {
  contact: PortfolioContactConfig | null;
  collectionsPopup: PortfolioCollectionsPopupConfig | null;
  cssVars: Record<string, string>;
};

const PreviewDraftContext = createContext<PreviewDraftConfigs>({
  contact: null,
  collectionsPopup: null,
  cssVars: {},
});

export function usePreviewDraft(): PreviewDraftConfigs {
  return useContext(PreviewDraftContext);
}

export { PreviewDraftContext };
