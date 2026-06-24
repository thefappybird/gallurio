"use client";

import { createContext, useContext } from "react";
import type {
  PortfolioHeaderConfig,
  PortfolioContactConfig,
  PortfolioCollectionsPopupConfig,
} from "@/lib/page-builder/types";

/**
 * Holds the parsed localStorage draft configs for the three preview surfaces
 * that are not covered by CSS vars (those live in PreviewBrandShell already).
 * null means "no draft — use DB fallback".
 */
export type PreviewDraftConfigs = {
  headerConfig: PortfolioHeaderConfig | null;
  contact: PortfolioContactConfig | null;
  collectionsPopup: PortfolioCollectionsPopupConfig | null;
};

const PreviewDraftContext = createContext<PreviewDraftConfigs>({
  headerConfig: null,
  contact: null,
  collectionsPopup: null,
});

export function usePreviewDraft(): PreviewDraftConfigs {
  return useContext(PreviewDraftContext);
}

export { PreviewDraftContext };
