"use client";

/**
 * Brand palette colors for the editor's style swatches.
 *
 * The `--pf-color-*` CSS vars are scoped to the `.gallurio-editor` wrapper, but
 * the toolkit's color popovers render in a PORTAL (outside that wrapper), so a
 * swatch styled with `var(--pf-color-primary)` resolves to nothing there. React
 * Context, however, flows through portals (they're React-tree children) — so we
 * thread the RESOLVED hex colors down and the swatches use those directly.
 *
 * Outside the editor (no provider) the defaults fall back to the CSS vars, which
 * resolve fine when rendered inside the brand-kit scope.
 */

import { createContext, useContext } from "react";
import type { StyleColorToken } from "./styleToolkit";
import type { BrandKitRadius } from "./types";

export type BrandColorMap = Record<StyleColorToken, string> & {
  /** The brand kit's radius token, used to show the effective preset in
   *  RadiusButtons when the block's own radius prop is unset. Display-only. */
  brandRadius?: BrandKitRadius;
};

const DEFAULT_BRAND_COLORS: BrandColorMap = {
  primary: "var(--pf-color-primary)",
  secondary: "var(--pf-color-secondary)",
  accent: "var(--pf-color-accent)",
  background: "var(--pf-color-bg)",
  foreground: "var(--pf-color-fg)",
};

export const BrandColorsContext = createContext<BrandColorMap>(DEFAULT_BRAND_COLORS);

export function useBrandColors(): BrandColorMap {
  return useContext(BrandColorsContext);
}

/** Returns the brand kit's radius token, or undefined when outside the editor. */
export function useBrandRadius(): BrandKitRadius | undefined {
  return useContext(BrandColorsContext).brandRadius;
}
