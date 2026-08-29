import {
  type BrandKitThemePreset,
  type PortfolioBrandKit,
} from "@/lib/page-builder/types";

/**
 * Concrete brand kit per built-in preset. Selecting a preset applies this full
 * snapshot (all 5 colors + both fonts + radius + button style) via the same
 * `onChange(brandKit)` path as a saved theme, so the preview updates instantly.
 * `themePreset` is retained on each kit for back-compat/metadata only — the
 * `pf-theme-*` class it produces defines no CSS.
 */
export const THEME_PRESET_DEFINITIONS: Record<
  BrandKitThemePreset,
  { name: string; brandKit: PortfolioBrandKit }
> = {
  minimal: {
    name: "Minimal",
    brandKit: {
      themePreset: "minimal",
      fontPair: "merriweather-only",
      headingFont: "merriweather",
      bodyFont: "merriweather",
      primaryColor: "#111111",
      secondaryColor: "#f5f5f5",
      accentColor: "#2f5d56",
      // Near-white, not pure white — the gallery ground still reads white-cube.
      backgroundColor: "#fcfcfb",
      foregroundColor: "#111111",
      radius: "sharp",
      buttonStyle: "solid",
    },
  },
  editorial: {
    name: "Editorial",
    brandKit: {
      themePreset: "editorial",
      fontPair: "playfair-inter",
      headingFont: "playfair",
      bodyFont: "inter",
      primaryColor: "#161514",
      secondaryColor: "#ece5db",
      accentColor: "#7e6a52",
      backgroundColor: "#fbf9f6",
      foregroundColor: "#161514",
      radius: "sharp",
      buttonStyle: "solid",
    },
  },
  luxury: {
    name: "Luxury",
    brandKit: {
      themePreset: "luxury",
      fontPair: "cormorant-montserrat",
      headingFont: "cormorant",
      bodyFont: "montserrat",
      primaryColor: "#f3efe9",
      secondaryColor: "#1a1a1a",
      accentColor: "#c9a86a",
      backgroundColor: "#0e0e0e",
      foregroundColor: "#f3efe9",
      radius: "sharp",
      buttonStyle: "outline",
    },
  },
  bold: {
    name: "Bold",
    brandKit: {
      themePreset: "bold",
      fontPair: "playfair-inter", // deprecated/no-op; headingFont/bodyFont are authoritative (no montserrat pair exists)
      headingFont: "montserrat",
      bodyFont: "inter",
      primaryColor: "#101010",
      secondaryColor: "#f0f0f0",
      accentColor: "#1f3a5f",
      // Near-white with a faint cool cast, sitting with the navy accent.
      backgroundColor: "#fbfbfc",
      foregroundColor: "#101010",
      radius: "sharp",
      buttonStyle: "solid",
    },
  },
  romantic: {
    name: "Romantic",
    brandKit: {
      themePreset: "romantic",
      fontPair: "cormorant-montserrat", // deprecated/no-op; headingFont/bodyFont are authoritative (no cormorant+dm-sans pair exists)
      headingFont: "cormorant",
      bodyFont: "dm-sans",
      primaryColor: "#3a2b2b",
      secondaryColor: "#f3e6e2",
      // Deepened dusty rose — the lighter #9c6b6b read at only 4.15:1 on the
      // blush ground.
      accentColor: "#8a5555",
      backgroundColor: "#fcf6f4",
      foregroundColor: "#3a2b2b",
      radius: "subtle",
      buttonStyle: "soft",
    },
  },
  modern: {
    name: "Modern",
    brandKit: {
      themePreset: "modern",
      fontPair: "dm-serif-dm-sans",
      headingFont: "dm-serif",
      bodyFont: "dm-sans",
      primaryColor: "#1a1a1a",
      secondaryColor: "#ebebe8",
      // Deep aubergine — the one hue not already claimed by another preset
      // (Minimal owns the pine-teal that mirrors the default brand kit).
      accentColor: "#4a3a5c",
      backgroundColor: "#f7f7f5",
      foregroundColor: "#1a1a1a",
      radius: "subtle",
      buttonStyle: "solid",
    },
  },
};
