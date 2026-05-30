/**
 * Shared types for the portfolio page builder.
 *
 * These are consumed by:
 * - lib/page-builder/config.ts  (Puck config)
 * - lib/page-builder/brandKitContext.tsx  (context + CSS resolution)
 * - lib/validators/publicPage.ts  (Zod schemas)
 * - All block components (Phases 3–4)
 */

// ---------------------------------------------------------------------------
// Theme preset
// ---------------------------------------------------------------------------

export const BRAND_KIT_THEME_PRESETS = [
  "minimal",
  "editorial",
  "luxury",
  "bold",
  "romantic",
  "modern",
] as const;
export type BrandKitThemePreset = (typeof BRAND_KIT_THEME_PRESETS)[number];

// ---------------------------------------------------------------------------
// Font pair
// ---------------------------------------------------------------------------

export const BRAND_KIT_FONT_PAIRS = [
  "merriweather-only",
  "playfair-inter",
  "dm-serif-dm-sans",
  "cormorant-montserrat",
  "fraunces-inter",
] as const;
export type BrandKitFontPair = (typeof BRAND_KIT_FONT_PAIRS)[number];

// ---------------------------------------------------------------------------
// Radius + button style
// ---------------------------------------------------------------------------

export const BRAND_KIT_RADII = ["sharp", "subtle", "rounded"] as const;
export type BrandKitRadius = (typeof BRAND_KIT_RADII)[number];

export const BRAND_KIT_BUTTON_STYLES = ["solid", "outline", "soft"] as const;
export type BrandKitButtonStyle = (typeof BRAND_KIT_BUTTON_STYLES)[number];

// ---------------------------------------------------------------------------
// Contact panel config (the only customizable surface of the fixed contact
// modal — title/description copy plus which brand color/style the button uses;
// the form fields themselves are NOT configurable).
// ---------------------------------------------------------------------------

/** Which brand-kit color slot the contact button is painted with. */
export const CONTACT_BUTTON_COLORS = ["primary", "secondary", "accent", "foreground"] as const;
export type ContactButtonColor = (typeof CONTACT_BUTTON_COLORS)[number];

export type PortfolioContactConfig = {
  title?: string;
  description?: string;
  buttonStyle?: BrandKitButtonStyle;
  buttonColor?: ContactButtonColor;
};

// ---------------------------------------------------------------------------
// PortfolioBrandKit
// ---------------------------------------------------------------------------

export type PortfolioBrandKit = {
  themePreset: BrandKitThemePreset;
  fontPair: BrandKitFontPair;
  /** 6-digit hex, e.g. "#111111" */
  primaryColor: string;
  /** 6-digit hex */
  secondaryColor: string;
  /** 6-digit hex */
  accentColor: string;
  /** 6-digit hex */
  backgroundColor: string;
  /** 6-digit hex */
  foregroundColor: string;
  radius: BrandKitRadius;
  buttonStyle: BrandKitButtonStyle;
};

export const DEFAULT_BRAND_KIT: PortfolioBrandKit = {
  themePreset: "minimal",
  fontPair: "merriweather-only",
  primaryColor: "#111111",
  secondaryColor: "#f5f5f5",
  accentColor: "#2f5d56", // Gallurio brand teal
  backgroundColor: "#ffffff",
  foregroundColor: "#111111",
  radius: "sharp",
  buttonStyle: "solid",
};

// ---------------------------------------------------------------------------
// Puck data shapes
// ---------------------------------------------------------------------------

/** A single Puck block entry inside a zone's content array. */
export type PuckBlockEntry = {
  type: string;
  props: Record<string, unknown>;
};

/** The raw Puck Data object that the editor round-trips. */
export type PuckData = {
  root?: { props?: Record<string, unknown> };
  content: PuckBlockEntry[];
  zones?: Record<string, PuckBlockEntry[]>;
};

/** The two named zones Gallurio portfolios support. */
export type PortfolioPuckData = {
  home: PuckData | null;
  gallery: PuckData | null;
};

// ---------------------------------------------------------------------------
// Block props helper
// ---------------------------------------------------------------------------

/**
 * Base props injected into every portfolio block.
 * `TName` is the block's string literal name in the Components union.
 *
 * Usage:
 *   type HeroBlockProps = PortfolioBlockProps<"Hero"> & { headline: string; ... };
 */
export type PortfolioBlockProps<TName extends string> = {
  /** Discriminates the block in generic handlers. */
  _blockType: TName;
};
