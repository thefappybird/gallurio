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
      primaryColor: "#dde7e4",
      secondaryColor: "#f0ede7",
      accentColor: "#b7d2ca",
      // Near-white, not pure white — the gallery ground still reads white-cube.
      backgroundColor: "#fcfcfb",
      foregroundColor: "#18201f",
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
      primaryColor: "#d8c3aa",
      secondaryColor: "#e8d7c8",
      accentColor: "#c4a27a",
      backgroundColor: "#fbf7f0",
      foregroundColor: "#261c16",
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
      primaryColor: "#352a23",
      secondaryColor: "#24262d",
      accentColor: "#5a452a",
      backgroundColor: "#0e0e10",
      foregroundColor: "#f5f0e8",
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
      primaryColor: "#b8d1ff",
      secondaryColor: "#ffd0b5",
      accentColor: "#f3bc41",
      // Near-white with a faint cool cast behind the blue, peach, and gold surfaces.
      backgroundColor: "#fbfcff",
      foregroundColor: "#101a2b",
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
      primaryColor: "#e8c8cf",
      secondaryColor: "#f4dfd9",
      // Dusty rose surface; the plum foreground remains readable over it.
      accentColor: "#d8a8b3",
      backgroundColor: "#fff8f7",
      foregroundColor: "#3a2228",
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
      primaryColor: "#bcd4c6",
      secondaryColor: "#d6d2e5",
      // Muted gold keeps the sage and lavender surfaces from feeling monochrome.
      accentColor: "#d5b96f",
      backgroundColor: "#f7f8f6",
      foregroundColor: "#18221e",
      radius: "subtle",
      buttonStyle: "solid",
    },
  },
};
