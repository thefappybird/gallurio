"use client";

import { useEffect, useState, type ReactNode } from "react";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import type { PortfolioBrandKit } from "@/lib/page-builder/types";

const LOCAL_DRAFT_VERSION = 2;

type DraftShape = {
  version?: number;
  brandKit?: PortfolioBrandKit;
};

/**
 * Client shell that wraps the portfolio preview with the unsaved (localStorage)
 * brand kit when present, falling back to the DB-resolved CSS vars otherwise.
 *
 * This ensures the preview always matches the canvas — theme changes the owner
 * has NOT yet saved are still visible here. A brief flash of the DB theme before
 * the effect runs is acceptable: this is an owner-only preview surface.
 *
 * Blocks consume `var(--pf-*)` CSS variables — no React brand context is needed.
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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`gallurio:portfolio-draft:${slug}`);
      if (!raw) return;
      const draft = JSON.parse(raw) as DraftShape;
      if (draft.version !== LOCAL_DRAFT_VERSION) return;
      if (!draft.brandKit) return;
      const resolved = resolveBrandKit(draft.brandKit);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs localStorage draft (external store) into React state on mount; server fallbackCssVars is already the initial state
      setCssVars(resolved.cssVars);
      setClassName(resolved.className);
    } catch {
      // ignore malformed draft; keep DB fallback
    }
  }, [slug]);

  return (
    <div
      data-testid="preview-brand-shell"
      style={{
        ...(cssVars as React.CSSProperties),
        minHeight: "100dvh",
        backgroundColor: "var(--pf-color-bg)",
        color: "var(--pf-color-fg)",
      }}
      className={className}
    >
      {children}
    </div>
  );
}
