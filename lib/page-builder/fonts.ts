/**
 * Curated portfolio font registry.
 *
 * The single source of truth for the brand-kit font selectors (independent
 * heading + body) and the per-text `fontFamily` override. Every family here is
 * SELF-HOSTED (woff2 via lib/fonts/portfolio.ts) and its CSS var is present on
 * both the authenticated app root and the public portfolio root, so a chosen
 * family resolves identically in the editor preview and on the live page.
 *
 * No "use client", no server-only imports — safe on both sides.
 *
 * To add more families later: bundle the woff2 in app/fonts/, register a
 * `localFont` in lib/fonts/portfolio.ts (append its var to
 * `portfolioFontVariables`), then add an entry here. See RELEASE-CHECKLIST.
 */

export const PORTFOLIO_FONT_KEYS = [
  "merriweather",
  "playfair",
  "fraunces",
  "cormorant",
  "dm-serif",
  "inter",
  "montserrat",
  "dm-sans",
] as const;

export type PortfolioFontKey = (typeof PORTFOLIO_FONT_KEYS)[number];

type FontEntry = {
  label: string;
  /** Full CSS `font-family` value, incl. a generic fallback. */
  family: string;
  category: "serif" | "sans";
};

export const PORTFOLIO_FONTS: Record<PortfolioFontKey, FontEntry> = {
  merriweather: { label: "Merriweather", family: "var(--font-merriweather), Georgia, serif", category: "serif" },
  playfair: { label: "Playfair Display", family: "var(--font-playfair), Georgia, serif", category: "serif" },
  fraunces: { label: "Fraunces", family: "var(--font-fraunces), Georgia, serif", category: "serif" },
  cormorant: { label: "Cormorant Garamond", family: "var(--font-cormorant), Georgia, serif", category: "serif" },
  "dm-serif": { label: "DM Serif Display", family: "var(--font-dm-serif), Georgia, serif", category: "serif" },
  inter: { label: "Inter", family: "var(--font-inter), system-ui, sans-serif", category: "sans" },
  montserrat: { label: "Montserrat", family: "var(--font-montserrat), system-ui, sans-serif", category: "sans" },
  "dm-sans": { label: "DM Sans", family: "var(--font-dm-sans), system-ui, sans-serif", category: "sans" },
};

export const DEFAULT_HEADING_FONT: PortfolioFontKey = "merriweather";
export const DEFAULT_BODY_FONT: PortfolioFontKey = "merriweather";

// Maps a legacy `fontPair` (pre-independent-fonts brand kits) to the new
// heading/body family keys, so existing saved portfolios resolve identically
// with zero DB migration. Used as the fallback in resolveBrandKit + as the
// picker's initial selection when headingFont/bodyFont aren't set yet.
const LEGACY_FONT_PAIRS: Record<string, { headingFont: PortfolioFontKey; bodyFont: PortfolioFontKey }> = {
  "merriweather-only": { headingFont: "merriweather", bodyFont: "merriweather" },
  "playfair-inter": { headingFont: "playfair", bodyFont: "inter" },
  "dm-serif-dm-sans": { headingFont: "dm-serif", bodyFont: "dm-sans" },
  "cormorant-montserrat": { headingFont: "cormorant", bodyFont: "montserrat" },
  "fraunces-inter": { headingFont: "fraunces", bodyFont: "inter" },
};

export function legacyFontPairToFonts(
  fontPair: string | undefined | null
): { headingFont: PortfolioFontKey; bodyFont: PortfolioFontKey } {
  const mapped = fontPair ? LEGACY_FONT_PAIRS[fontPair] : undefined;
  return mapped ?? { headingFont: DEFAULT_HEADING_FONT, bodyFont: DEFAULT_BODY_FONT };
}

export function isPortfolioFontKey(value: unknown): value is PortfolioFontKey {
  return typeof value === "string" && (PORTFOLIO_FONT_KEYS as readonly string[]).includes(value);
}

/** Resolve a family key to its CSS `font-family` value (or `undefined` if unknown). */
export function fontFamilyValue(key: PortfolioFontKey | undefined | null): string | undefined {
  if (!key || !isPortfolioFontKey(key)) return undefined;
  return PORTFOLIO_FONTS[key].family;
}
