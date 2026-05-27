"use client";

/**
 * Brand-kit React context for portfolio public pages.
 *
 * - BrandKitProvider  — wraps the public-page subtree; injects the kit.
 * - useBrandKit       — hook for blocks to read kit values.
 * - resolveBrandKit   — pure, server-callable helper that converts a
 *                       PortfolioBrandKit into CSS variables + a className string.
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { PortfolioBrandKit, BrandKitFontPair, BrandKitRadius } from "./types";
import { DEFAULT_BRAND_KIT } from "./types";

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
// resolveBrandKit — server-callable (no React import required)
// ---------------------------------------------------------------------------

export type ResolvedBrandKit = {
  /** Map of CSS custom property name → value to apply inline to the page wrapper. */
  cssVars: Record<string, string>;
  /** Space-separated class string: "pf-theme-<preset> pf-button-<style>" */
  className: string;
};

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

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const BrandKitContext = createContext<PortfolioBrandKit | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export type BrandKitProviderProps = {
  brandKit?: PortfolioBrandKit;
  children: ReactNode;
};

/**
 * Wraps the public-page subtree and injects the workspace's brand kit.
 * Falls back to DEFAULT_BRAND_KIT when no kit is provided.
 */
export function BrandKitProvider({ brandKit = DEFAULT_BRAND_KIT, children }: BrandKitProviderProps) {
  return (
    <BrandKitContext.Provider value={brandKit}>
      {children}
    </BrandKitContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current workspace's PortfolioBrandKit.
 * Throws if called outside a <BrandKitProvider>.
 */
export function useBrandKit(): PortfolioBrandKit {
  const kit = useContext(BrandKitContext);
  if (kit === null) {
    throw new Error(
      "useBrandKit must be used inside a <BrandKitProvider>. " +
        "Wrap your public page root with <BrandKitProvider brandKit={...}>."
    );
  }
  return kit;
}
