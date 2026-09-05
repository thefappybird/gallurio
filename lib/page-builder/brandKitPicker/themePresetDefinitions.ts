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
      primaryColor: "#ece5d8",
      secondaryColor: "#f5f1e8",
      accentColor: "#ddd0ba",
      // Warm near-white, never pure white — the ground reads as paper, not screen.
      backgroundColor: "#fcfaf6",
      foregroundColor: "#1f1c16",
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
      primaryColor: "#e4e2dc",
      secondaryColor: "#efeee9",
      accentColor: "#c9cfd8",
      backgroundColor: "#f7f6f3",
      foregroundColor: "#1b1a18",
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
      primaryColor: "#1e2431",
      secondaryColor: "#262b38",
      accentColor: "#2f3a52",
      backgroundColor: "#0a0c11",
      foregroundColor: "#eceef4",
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
      primaryColor: "#c4ead8",
      secondaryColor: "#ffd5cb",
      accentColor: "#f6e27a",
      // Near-white with a faint green cast behind the mint, coral, and lemon surfaces.
      backgroundColor: "#fbfdfc",
      foregroundColor: "#0e1a16",
      radius: "sharp",
      buttonStyle: "solid",
    },
  },
  // The only warm dark kit. `buttonStyle: "soft"` renders as a 16% wash over a
  // near-black ground here, not over blush — check it before changing the palette.
  romantic: {
    name: "Romantic",
    brandKit: {
      themePreset: "romantic",
      fontPair: "cormorant-montserrat", // deprecated/no-op; headingFont/bodyFont are authoritative (no cormorant+dm-sans pair exists)
      headingFont: "cormorant",
      bodyFont: "dm-sans",
      primaryColor: "#2c1a1d",
      secondaryColor: "#241a1b",
      // Deep burgundy surface; the ivory foreground stays readable over it.
      accentColor: "#4a2027",
      backgroundColor: "#100c0d",
      foregroundColor: "#f4e9e7",
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
      primaryColor: "#e3ded2",
      secondaryColor: "#eee6dd",
      // Muted clay keeps the greige surfaces from flattening into one tone.
      accentColor: "#cfc0a6",
      backgroundColor: "#f9f8f5",
      foregroundColor: "#1c1b16",
      radius: "subtle",
      buttonStyle: "solid",
    },
  },
};
