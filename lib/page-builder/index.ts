// Public surface of the page-builder library.
export { puckConfig } from "./config";
export {
  DEFAULT_BRAND_KIT,
  BRAND_KIT_THEME_PRESETS,
  BRAND_KIT_FONT_PAIRS,
  BRAND_KIT_RADII,
  BRAND_KIT_BUTTON_STYLES,
  CONTACT_BUTTON_COLORS,
  type PortfolioBrandKit,
  type PortfolioContactConfig,
  type PortfolioPuckData,
  type PuckData,
  type PuckBlockEntry,
  type BrandKitThemePreset,
  type BrandKitFontPair,
  type BrandKitRadius,
  type BrandKitButtonStyle,
  type ContactButtonColor,
} from "./types";
export {
  PORTFOLIO_TEMPLATES,
  PORTFOLIO_TEMPLATE_IDS,
  getTemplate,
  getTemplateForBusinessType,
  type PortfolioTemplate,
  type PortfolioTemplateId,
} from "./templates";
