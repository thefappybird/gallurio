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

// ---------------------------------------------------------------------------
// Google Fonts — runtime, per-workspace font choice.
//
// Unlike the curated set above, these are NOT self-hosted and NOT known at
// build time (next/font/google requires a build-time-known family, which
// can't work for a per-workspace runtime choice). A selection is stored as a
// tagged string `google:<Family Name>` so it round-trips through the exact
// same fields the curated keys already use (BlockStyle.fontFamily,
// PortfolioBrandKit.headingFont/bodyFont) — no parallel storage shape.
// ---------------------------------------------------------------------------

export type PortfolioFontSelection = PortfolioFontKey | `google:${string}`;

export type GoogleFontCategory = "serif" | "sans";

export type GoogleFontShortlistEntry = { name: string; category: GoogleFontCategory };

/** Curated quick-pick shortlist shown in the Google Fonts optgroup/list. Free-text
 *  entry (any other Google Fonts family name) is always available alongside it. */
export const GOOGLE_FONT_SHORTLIST: GoogleFontShortlistEntry[] = [
  { name: "Poppins", category: "sans" },
  { name: "Raleway", category: "sans" },
  { name: "Nunito", category: "sans" },
  { name: "Work Sans", category: "sans" },
  { name: "Rubik", category: "sans" },
  { name: "Quicksand", category: "sans" },
  { name: "Karla", category: "sans" },
  { name: "Manrope", category: "sans" },
  { name: "Lato", category: "sans" },
  { name: "Open Sans", category: "sans" },
  { name: "Roboto", category: "sans" },
  { name: "Barlow", category: "sans" },
  { name: "Josefin Sans", category: "sans" },
  { name: "Space Grotesk", category: "sans" },
  { name: "Oswald", category: "sans" },
  { name: "Lora", category: "serif" },
  { name: "PT Serif", category: "serif" },
  { name: "Crimson Text", category: "serif" },
  { name: "Libre Baskerville", category: "serif" },
  { name: "EB Garamond", category: "serif" },
  { name: "Bitter", category: "serif" },
  { name: "Source Serif Pro", category: "serif" },
  { name: "Domine", category: "serif" },
  { name: "Abril Fatface", category: "serif" },
];

/** Type guard for a `google:<Family Name>` selection. */
export function isGoogleFontSelection(value: unknown): value is `google:${string}` {
  return typeof value === "string" && value.startsWith("google:") && value.length > "google:".length;
}

/** Extracts the raw family name out of a `google:<Family Name>` selection, or `undefined`. */
export function googleFontFamilyName(value: string | undefined | null): string | undefined {
  if (!value || !isGoogleFontSelection(value)) return undefined;
  return value.slice("google:".length);
}

/** Wraps a raw family name into the tagged selection format stored on BlockStyle/PortfolioBrandKit fields. */
export function toGoogleFontSelection(familyName: string): `google:${string}` {
  return `google:${familyName}`;
}

/**
 * Builds the Google Fonts CSS2 stylesheet URL for a family name (regular +
 * bold weights, swap to avoid invisible text during the fetch).
 */
export function googleFontsCssUrl(familyName: string): string {
  const encoded = encodeURIComponent(familyName.trim()).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700&display=swap`;
}

/** Sanitized slug for a family name — used as the injected <link>'s DOM id so repeat mounts dedupe. */
export function googleFontSlug(familyName: string): string {
  return familyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Recursively walks any JSON-like value (Puck block data, a brand kit, or a
 * list of selections) collecting every distinct Google Fonts family name it
 * finds. Generic over shape so it doesn't need to know each `*FontFamily`
 * prop name individually — new per-block font fields are picked up for free.
 */
export function collectGoogleFontFamilies(value: unknown, out: Set<string> = new Set()): string[] {
  if (typeof value === "string") {
    const name = googleFontFamilyName(value);
    if (name) out.add(name);
  } else if (Array.isArray(value)) {
    for (const item of value) collectGoogleFontFamilies(item, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectGoogleFontFamilies(v, out);
  }
  return Array.from(out);
}

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

/** Resolve a font selection (curated key or Google Font) to its CSS `font-family` value (or `undefined` if unresolvable). */
export function fontFamilyValue(key: PortfolioFontSelection | undefined | null): string | undefined {
  if (!key) return undefined;
  if (isPortfolioFontKey(key)) return PORTFOLIO_FONTS[key].family;
  const googleName = googleFontFamilyName(key);
  return googleName ? `"${googleName}", sans-serif` : undefined;
}

/**
 * Resolves the effective heading/body font keys for a brand kit, mirroring the
 * same fallback logic used by `resolveBrandKit` for the live page. Prefers the
 * independent `headingFont`/`bodyFont` fields; falls back to `legacyFontPairToFonts`
 * when those are absent (portfolios saved before independent fonts).
 *
 * Use this wherever the editor must display the font that actually renders on the
 * live page, so the two surfaces can't drift.
 */
export function resolveEffectiveFonts(brandKit: {
  fontPair?: string | null;
  headingFont?: string | null;
  bodyFont?: string | null;
}): { headingFont: PortfolioFontSelection; bodyFont: PortfolioFontSelection } {
  const legacy = legacyFontPairToFonts(brandKit.fontPair);
  const resolve = (value: string | null | undefined, fallback: PortfolioFontKey): PortfolioFontSelection => {
    if (isPortfolioFontKey(value)) return value;
    if (isGoogleFontSelection(value)) return value;
    return fallback;
  };
  return {
    headingFont: resolve(brandKit.headingFont, legacy.headingFont),
    bodyFont: resolve(brandKit.bodyFont, legacy.bodyFont),
  };
}
