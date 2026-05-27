/**
 * Barrel re-export for lib/page-builder.
 *
 * This is one of the two allowed barrel files in the codebase
 * (the other is lib/db/models/index.ts).
 *
 * Import from this file when you need multiple page-builder symbols.
 * For single-symbol imports, prefer the direct file to keep bundles lean.
 */

// Config
export { puckConfig } from "./config";

// Brand-kit context (client) + server helper
export {
  BrandKitProvider,
  useBrandKit,
  resolveBrandKit,
} from "./brandKitContext";
export type { BrandKitProviderProps, ResolvedBrandKit } from "./brandKitContext";

// Types
export {
  BRAND_KIT_THEME_PRESETS,
  BRAND_KIT_FONT_PAIRS,
  BRAND_KIT_RADII,
  BRAND_KIT_BUTTON_STYLES,
  DEFAULT_BRAND_KIT,
} from "./types";
export type {
  BrandKitThemePreset,
  BrandKitFontPair,
  BrandKitRadius,
  BrandKitButtonStyle,
  PortfolioBrandKit,
  PuckBlockEntry,
  PuckData,
  PortfolioPuckData,
  PortfolioBlockProps,
} from "./types";
