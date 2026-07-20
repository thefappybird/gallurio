/**
 * Server-safe brand-kit resolution helpers.
 *
 * No "use client" directive — safe to import from Server Components,
 * Server Actions, and any non-React module.
 *
 * Consumer: app/(public)/w/[orgSlug]/layout.tsx
 */

import type { PortfolioBrandKit, BrandKitFontPair, BrandKitRadius } from "./types";
import { fontFamilyValue, resolveEffectiveFonts } from "./fonts";

// ---------------------------------------------------------------------------
// Font-pair → CSS family string mapping
// ---------------------------------------------------------------------------

// Each pairing resolves to the self-hosted font's CSS variable (set on the
// public/app root by lib/fonts/portfolio.ts) with a generic-family fallback so
// text is never invisible if the woff2 hasn't loaded yet.
export const FONT_PAIR_MAP: Record<BrandKitFontPair, { heading: string; body: string }> = {
  "merriweather-only": {
    heading: "var(--font-merriweather), Georgia, serif",
    body: "var(--font-merriweather), Georgia, serif",
  },
  "playfair-inter": {
    heading: "var(--font-playfair), Georgia, serif",
    body: "var(--font-inter), system-ui, sans-serif",
  },
  "dm-serif-dm-sans": {
    heading: "var(--font-dm-serif), Georgia, serif",
    body: "var(--font-dm-sans), system-ui, sans-serif",
  },
  "cormorant-montserrat": {
    heading: "var(--font-cormorant), Georgia, serif",
    body: "var(--font-montserrat), system-ui, sans-serif",
  },
  "fraunces-inter": {
    heading: "var(--font-fraunces), Georgia, serif",
    body: "var(--font-inter), system-ui, sans-serif",
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
// Background luminance → color-scheme
// ---------------------------------------------------------------------------

/**
 * Derives the native `color-scheme` hint from a brand background color so that
 * native UA control glyphs (e.g. the date/time picker indicators in the public
 * contact form) match the theme instead of staying stuck in light mode.
 */
function colorSchemeForBackground(hex: string): "dark" | "light" {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return "light";
  const h = match[1];

  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const r = toLinear(parseInt(h.slice(0, 2), 16));
  const g = toLinear(parseInt(h.slice(2, 4), 16));
  const b = toLinear(parseInt(h.slice(4, 6), 16));

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.4 ? "dark" : "light";
}

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
  // Prefer the independent heading/body families; fall back to the legacy
  // `fontPair` mapping for portfolios saved before independent fonts (no
  // migration needed). Uses the shared resolver so this logic can't drift from
  // the editor's effective-font display.
  const { headingFont: headingKey, bodyFont: bodyKey } = resolveEffectiveFonts(brandKit);

  const cssVars: Record<string, string> = {
    "--pf-color-primary": brandKit.primaryColor,
    "--pf-color-secondary": brandKit.secondaryColor,
    "--pf-color-accent": brandKit.accentColor,
    "--pf-color-bg": brandKit.backgroundColor,
    "--pf-color-fg": brandKit.foregroundColor,
    "--pf-radius": RADIUS_MAP[brandKit.radius],
    "--pf-font-heading": fontFamilyValue(headingKey) ?? "",
    "--pf-font-body": fontFamilyValue(bodyKey) ?? "",
  };

  cssVars.colorScheme = colorSchemeForBackground(brandKit.backgroundColor);

  const className = `pf-theme-${brandKit.themePreset} pf-button-${brandKit.buttonStyle}`;

  return { cssVars, className };
}
