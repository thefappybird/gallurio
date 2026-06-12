/**
 * Shared types for the portfolio page builder.
 *
 * These are consumed by:
 * - lib/page-builder/config.ts  (Puck config)
 * - lib/page-builder/brandKitContext.tsx  (context + CSS resolution)
 * - lib/validators/publicPage.ts  (Zod schemas)
 * - All block components (Phases 3–4)
 */

import type { PortfolioFontKey } from "./fonts";

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
// PortfolioCollectionsPopupConfig
// ---------------------------------------------------------------------------

/** Horizontal text alignment for popup title. */
export type PopupTitleAlign = "left" | "center" | "right";

export type PortfolioCollectionsPopupConfig = {
  backgroundColor?: string; // token name or hex
  borderColor?: string;     // token name or hex
  borderWidth?: number;     // px, 0 = none
  radius?: BrandKitRadius | "";
  // Title styles (global override + typography). Empty titleText -> collection name.
  titleText?: string;
  titleFontFamily?: PortfolioFontKey | "";
  titleFontSize?: number; // px
  titleColorToken?: string; // token name or hex
  titleBold?: boolean;
  titleItalic?: boolean;
  titleUnderline?: boolean;
  titleAlign?: PopupTitleAlign | ""; // moves the title across the full popup header width
  // Close-button styles
  closeButtonSize?: number; // px (button width/height)
  closeButtonRadius?: BrandKitRadius | "";
  closeButtonBorderWidth?: number; // px
  closeButtonBorderColorToken?: string;
  closeButtonOpacity?: number; // 0-100
  closeButtonBgColorToken?: string;
};

// ---------------------------------------------------------------------------
// Contact panel config (the only customizable surface of the fixed contact
// modal — title/description copy plus which brand color/style the button uses;
// the form fields themselves are NOT configurable).
// ---------------------------------------------------------------------------

/** Which brand-kit color slot the contact button / modal background is painted with. */
export const CONTACT_BUTTON_COLORS = ["primary", "secondary", "accent", "background", "foreground"] as const;
export type ContactButtonColor = (typeof CONTACT_BUTTON_COLORS)[number];

export type PortfolioContactConfig = {
  title?: string;
  description?: string;
  /** @deprecated Kept for DB compat — UI now uses individual color/radius fields. */
  buttonStyle?: BrandKitButtonStyle;
  /** Token name (e.g. "primary") or custom hex (e.g. "#ff0000"). */
  buttonColor?: string;
  buttonTextColor?: string;
  errorMessageColor?: string;
  buttonRadius?: BrandKitRadius;
  buttonBorderColor?: string;
  buttonBorderWidth?: number;
  addSessionButtonStyle?: BrandKitButtonStyle;
  addSessionButtonColor?: string;
  addSessionButtonTextColor?: string;
  addSessionButtonRadius?: BrandKitRadius;
  addSessionButtonBorderColor?: string;
  addSessionButtonBorderWidth?: number;
  backgroundColor?: string;
  textColor?: string;
  popupRadius?: BrandKitRadius;
  popupBorderColor?: string;
  popupBorderWidth?: number;
  /** @deprecated Kept for DB compat — UI now uses individual color/radius fields. */
  popupStyle?: BrandKitButtonStyle;
  // Tab styling — mirrors header link/active-link conventions
  /** Tab text font size. Empty = default (md). */
  tabFontSize?: HeaderFontSize | "";
  /** Inactive tab text color. Token or hex. */
  tabColor?: string;
  /** Active tab text color. Token or hex. */
  activeTabColor?: string;
  /** Slightly scales up the active tab. */
  activeTabScale?: boolean;
  /** Adds a background highlight behind the active tab. */
  activeTabHighlight?: boolean;
  /** Background color for the active tab highlight chip. Token or hex. */
  tabHighlightColor?: string;
  /** 0-100 opacity applied to the active-tab highlight fill. */
  tabHighlightOpacity?: number;
  /** Radius for the active-tab highlight chip. */
  activeTabRadius?: BrandKitRadius | "";
  /** Adds a bottom border to the active tab. */
  activeTabUnderline?: boolean;
  /** Border color for active-tab underline mode. Token or hex. */
  tabUnderlineColor?: string;
};

// ---------------------------------------------------------------------------
// PortfolioHeaderConfig
// ---------------------------------------------------------------------------

export const HEADER_SHADOW_SIZES = ["none", "sm", "md", "lg"] as const;
export type HeaderShadowSize = (typeof HEADER_SHADOW_SIZES)[number];

export const HEADER_FONT_SIZES = ["sm", "md", "lg"] as const;
export type HeaderFontSize = (typeof HEADER_FONT_SIZES)[number];

export const HEADER_NAVBAR_SIZES = ["sleek", "balanced", "flashy"] as const;
export type HeaderNavbarSize = (typeof HEADER_NAVBAR_SIZES)[number];

export type PortfolioHeaderConfig = {
  /** Override for the workspace name shown in the navigation. Undefined = workspace name; empty = logo only. */
  brandText?: string;
  /** Cloudinary secure URL for the logo image. */
  logoUrl?: string;
  /** Cloudinary public ID for the logo image (used for transforms/deletion). */
  logoPublicId?: string;
  /** Token name (e.g. "primary") or custom hex (e.g. "#ffffff"). */
  backgroundColor?: string;
  /** 0–100. Applied to the header background only (not text). Default 100. */
  backgroundOpacity?: number;
  /** Nav link text color. Token or hex. */
  linkColor?: string;
  /** Brand heading color. Token or hex. */
  brandTextColor?: string;
  /** Active nav link text color. Token or hex. */
  activeLinkColor?: string;
  /** Bottom border width in px (0 = none). */
  borderBottomWidth?: number;
  /** Bottom border color. Token or hex. */
  borderBottomColor?: string;
  /** Drop shadow size. Empty = none. */
  shadowSize?: HeaderShadowSize | "";
  /** Nav link font size. Empty = default (md). */
  fontSize?: HeaderFontSize | "";
  /** Overall navbar density/presence. Empty = balanced. */
  navbarSize?: HeaderNavbarSize | "";
  /** Slightly scales up the active link text. */
  activeLinkScale?: boolean;
  /** Adds a background color behind the active link. */
  activeLinkHighlight?: boolean;
  /** Background color for highlight mode. Token or hex. */
  highlightColor?: string;
  /** 0-100 opacity applied to the active-link highlight fill. */
  highlightOpacity?: number;
  /** Radius for the active-link highlight chip. */
  activeLinkRadius?: BrandKitRadius | "";
  /** Adds a bottom border to the active link. */
  activeLinkUnderline?: boolean;
  /** Border color for underline mode. Token or hex. */
  underlineColor?: string;
  /** Contact CTA background color. Token or hex. */
  contactButtonColor?: string;
  /** Contact CTA text color. Token or hex. */
  contactButtonTextColor?: string;
  /** 0-100 opacity applied to the contact CTA fill. */
  contactButtonOpacity?: number;
  /** Radius for the contact CTA. */
  contactButtonRadius?: BrandKitRadius | "";
};

export const DEFAULT_HEADER_CONFIG: PortfolioHeaderConfig = {
  highlightOpacity: 100,
  contactButtonOpacity: 100,
};

// ---------------------------------------------------------------------------
// PortfolioBrandKit
// ---------------------------------------------------------------------------

export type PortfolioBrandKit = {
  themePreset: BrandKitThemePreset;
  /**
   * @deprecated Superseded by independent `headingFont` / `bodyFont`. Kept for
   * back-compat: pre-existing portfolios resolve through `legacyFontPairToFonts`
   * when `headingFont`/`bodyFont` are absent. New saves always set both fonts.
   */
  fontPair: BrandKitFontPair;
  /** Curated family key (lib/page-builder/fonts.ts) for headings. */
  headingFont?: PortfolioFontKey;
  /** Curated family key (lib/page-builder/fonts.ts) for body text. */
  bodyFont?: PortfolioFontKey;
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
  headingFont: "merriweather",
  bodyFont: "merriweather",
  primaryColor: "#111111",
  secondaryColor: "#f5f5f5",
  accentColor: "#2f5d56", // Gallurio brand teal
  backgroundColor: "#ffffff",
  foregroundColor: "#111111",
  radius: "sharp",
  buttonStyle: "solid",
};

// ---------------------------------------------------------------------------
// Saved themes — an owner's named, reusable brand kits (embedded on the
// workspace's publicPage, NOT a separate collection). Apply/save/delete in the
// Theme panel, mirroring the collections manager.
// ---------------------------------------------------------------------------

export const SAVED_THEMES_MAX = 24;

export type PortfolioSavedTheme = {
  id: string;
  name: string;
  brandKit: PortfolioBrandKit;
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
