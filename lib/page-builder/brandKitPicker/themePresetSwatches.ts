import type { BrandKitThemePreset, BrandKitFontPair } from "@/lib/page-builder/types";

// Representative swatches for each theme preset's picker card. These are preview
// hints only — selecting a preset sets `brandKit.themePreset`; the actual colors
// are edited via the color inputs (so an owner can diverge from the preset).
export const THEME_PRESET_SWATCHES: Record<
  BrandKitThemePreset,
  { bg: string; fg: string; accent: string }
> = {
  minimal: { bg: "#ffffff", fg: "#111111", accent: "#2f5d56" },
  editorial: { bg: "#fbf9f6", fg: "#161514", accent: "#7e6a52" },
  luxury: { bg: "#0e0e0e", fg: "#f3efe9", accent: "#c9a86a" },
  bold: { bg: "#ffffff", fg: "#101010", accent: "#1f3a5f" },
  romantic: { bg: "#fcf6f4", fg: "#3a2b2b", accent: "#9c6b6b" },
  modern: { bg: "#f7f7f5", fg: "#1a1a1a", accent: "#2f5d56" },
};

// Heading/body font-family CSS for each pairing's sample text in the picker.
export const FONT_PAIR_SAMPLES: Record<
  BrandKitFontPair,
  { label: string; heading: string; body: string }
> = {
  "merriweather-only": { label: "Merriweather", heading: "Merriweather, serif", body: "Merriweather, serif" },
  "playfair-inter": { label: "Playfair + Inter", heading: "'Playfair Display', serif", body: "Inter, sans-serif" },
  "dm-serif-dm-sans": { label: "DM Serif + DM Sans", heading: "'DM Serif Display', serif", body: "'DM Sans', sans-serif" },
  "cormorant-montserrat": { label: "Cormorant + Montserrat", heading: "Cormorant, serif", body: "Montserrat, sans-serif" },
  "fraunces-inter": { label: "Fraunces + Inter", heading: "Fraunces, serif", body: "Inter, sans-serif" },
};
