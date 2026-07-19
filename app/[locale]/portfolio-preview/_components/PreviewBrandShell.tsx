"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MotionObserver } from "@/lib/page-builder/MotionObserver.client";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import type {
  PortfolioBrandKit,
  PortfolioHeaderConfig,
  PortfolioContactConfig,
  PortfolioCollectionsPopupConfig,
} from "@/lib/page-builder/types";
import {
  PreviewDraftContext,
  type PreviewDraftConfigs,
} from "./PreviewDraftContext";

const LOCAL_DRAFT_VERSION = 2;

type DraftShape = {
  version?: number;
  brandKit?: PortfolioBrandKit;
  headerConfig?: PortfolioHeaderConfig;
  contact?: PortfolioContactConfig;
  collectionsPopup?: PortfolioCollectionsPopupConfig;
};

const EMPTY_DRAFT_CONFIGS: PreviewDraftConfigs = {
  headerConfig: null,
  contact: null,
  collectionsPopup: null,
  cssVars: {},
};

/**
 * Client shell that wraps the portfolio preview with the unsaved (localStorage)
 * brand kit when present, falling back to the DB-resolved CSS vars otherwise.
 *
 * Also reads headerConfig, contact, and collectionsPopup from the draft and
 * provides them via PreviewDraftContext so child components can override
 * DB-resolved fallbacks. A brief flash of the DB fallback before the effect
 * runs is acceptable: this is an owner-only preview surface.
 *
 * Blocks consume `var(--pf-*)` CSS variables — no React brand context is needed.
 *
 * Also mounts `MotionObserver` (mirrors the public layout mount) so
 * entrance-animated (`[data-anim]`) blocks reveal on scroll here too — the
 * preview iframe is its own document/browsing context, so the observer's
 * default (viewport) root already resolves to the iframe's own viewport.
 * Without this, preview showed those blocks permanently at `opacity: 0`.
 */
export function PreviewBrandShell({
  slug,
  fallbackCssVars,
  fallbackClassName,
  children,
}: {
  slug: string;
  fallbackCssVars: Record<string, string>;
  fallbackClassName: string;
  children: ReactNode;
}) {
  const [cssVars, setCssVars] = useState<Record<string, string>>(fallbackCssVars);
  const [className, setClassName] = useState<string>(fallbackClassName);
  const [draftConfigs, setDraftConfigs] = useState<PreviewDraftConfigs>(EMPTY_DRAFT_CONFIGS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`gallurio:portfolio-draft:${slug}`);
      if (!raw) return;
      const draft = JSON.parse(raw) as DraftShape;
      if (draft.version !== LOCAL_DRAFT_VERSION) return;

      // --- brandKit ---
      if (draft.brandKit) {
        // Shallow-validate required primitive fields before calling resolveBrandKit.
        // A structurally-present but malformed brandKit (e.g. {}) would produce
        // broken styles like pf-theme-undefined / var(--font-undefined) instead of
        // falling back gracefully. fontPair/headingFont/bodyFont are excluded —
        // resolveBrandKit already handles them defensively.
        const bk = draft.brandKit;
        const requiredStrings = [
          "primaryColor",
          "secondaryColor",
          "accentColor",
          "backgroundColor",
          "foregroundColor",
          "radius",
          "themePreset",
          "buttonStyle",
        ] as const satisfies (keyof PortfolioBrandKit)[];
        const isValid = requiredStrings.every(
          (k) => typeof bk[k] === "string" && (bk[k] as string).length > 0,
        );
        if (isValid) {
          const resolved = resolveBrandKit(bk);
          // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs localStorage draft (external store) into React state on mount; server fallbackCssVars is already the initial state
          setCssVars(resolved.cssVars);
          setClassName(resolved.className);
        }
      }

      // --- headerConfig ---
      if (draft.headerConfig != null && typeof draft.headerConfig === "object") {
        setDraftConfigs((prev) => ({ ...prev, headerConfig: draft.headerConfig! }));
      }
      // --- contact ---
      if (draft.contact != null && typeof draft.contact === "object") {
        setDraftConfigs((prev) => ({ ...prev, contact: draft.contact! }));
      }
      // --- collectionsPopup ---
      if (draft.collectionsPopup != null && typeof draft.collectionsPopup === "object") {
        setDraftConfigs((prev) => ({ ...prev, collectionsPopup: draft.collectionsPopup! }));
      }
    } catch {
      // ignore malformed draft; keep DB fallback
    }
  }, [slug]);

  return (
    // ponytail: merge cssVars into context at render rather than a second state or effect
    <PreviewDraftContext value={{ ...draftConfigs, cssVars }}>
      <div
        style={{
          ...(cssVars as React.CSSProperties),
          minHeight: "100dvh",
          backgroundColor: "var(--pf-color-bg)",
          color: "var(--pf-color-fg)",
        }}
        className={className}
      >
        {children}
        <MotionObserver />
      </div>
    </PreviewDraftContext>
  );
}
