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

/**
 * Maps the brand kit radius token to its corresponding RADIUS_PRESETS number.
 * Returns undefined when the token is absent, "" (empty string runtime value
 * that PortfolioBrandKit fields can produce), or any unrecognised value.
 * Display-only — does not write to block props.
 */
const BRAND_RADIUS_MAP: Record<string, number> = { sharp: 0, subtle: 4, rounded: 8 };

export function useEffectiveBrandRadius(): number | undefined {
  const brandRadius = useContext(BrandColorsContext).brandRadius;
  if (!brandRadius) return undefined;
  const mapped = BRAND_RADIUS_MAP[brandRadius];
  return mapped !== undefined ? mapped : undefined;
}
