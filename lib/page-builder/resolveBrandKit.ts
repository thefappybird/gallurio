/**
 * Server-safe brand-kit resolution helpers.
 *
 * No "use client" directive — safe to import from Server Components,
 * Server Actions, and any non-React module.
 *
 * Consumer: app/(public)/w/[orgSlug]/layout.tsx
 */

import type { PortfolioBrandKit, BrandKitFontPair, BrandKitRadius } from "./types";

// ---------------------------------------------------------------------------
// Font-pair → CSS family string mapping
// ---------------------------------------------------------------------------

const FONT_PAIR_MAP: Record<BrandKitFontPair, { heading: string; body: string }> = {
  "merriweather-only": {
    heading: "'Merriweather', serif",
    body: "'Merriweather', serif",
  },
  "playfair-inter": {
    heading: "'Playfair Display', serif",
    body: "'Inter', sans-serif",
  },
  "dm-serif-dm-sans": {
    heading: "'DM Serif Display', serif",
    body: "'DM Sans', sans-serif",
  },
  "cormorant-montserrat": {
    heading: "'Cormorant Garamond', serif",
    body: "'Montserrat', sans-serif",
  },
  "fraunces-inter": {
    heading: "'Fraunces', serif",
    body: "'Inter', sans-serif",
  },
};

// ---------------------------------------------------------------------------
// Radius → CSS value mapping
// ---------------------------------------------------------------------------

const RADIUS_MAP: Record<BrandKitRadius, string> = {
  sharp: "0",
  subtle: "0.25rem",
  rounded: "0.5rem",
};

// ---------------------------------------------------------------------------
// ResolvedBrandKit type
// ---------------------------------------------------------------------------

export type ResolvedBrandKit = {
  /** Map of CSS custom property name → value to apply inline to the page wrapper. */
  cssVars: Record<string, string>;
  /** Space-separated class string: "pf-theme-<preset> pf-button-<style>" */
  className: string;
};

// ---------------------------------------------------------------------------
// resolveBrandKit — server-callable (no React deps)
// ---------------------------------------------------------------------------

/**
 * Converts a PortfolioBrandKit into a resolved CSS vars map + utility className.
 *
 * Safe to call on the server — no React deps.
 */
export function resolveBrandKit(brandKit: PortfolioBrandKit): ResolvedBrandKit {
  const fonts = FONT_PAIR_MAP[brandKit.fontPair];

  const cssVars: Record<string, string> = {
    "--pf-color-primary": brandKit.primaryColor,
    "--pf-color-secondary": brandKit.secondaryColor,
    "--pf-color-accent": brandKit.accentColor,
    "--pf-color-bg": brandKit.backgroundColor,
    "--pf-color-fg": brandKit.foregroundColor,
    "--pf-radius": RADIUS_MAP[brandKit.radius],
    "--pf-font-heading": fonts.heading,
    "--pf-font-body": fonts.body,
  };

  const className = `pf-theme-${brandKit.themePreset} pf-button-${brandKit.buttonStyle}`;

  return { cssVars, className };
}
