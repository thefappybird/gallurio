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
// Uses the self-hosted font CSS variables (lib/fonts/portfolio.ts) so the
// preview renders in the actual pairing, not a system fallback.
export const FONT_PAIR_SAMPLES: Record<
  BrandKitFontPair,
  { label: string; heading: string; body: string }
> = {
  "merriweather-only": { label: "Merriweather", heading: "var(--font-merriweather), serif", body: "var(--font-merriweather), serif" },
  "playfair-inter": { label: "Playfair + Inter", heading: "var(--font-playfair), serif", body: "var(--font-inter), sans-serif" },
  "dm-serif-dm-sans": { label: "DM Serif + DM Sans", heading: "var(--font-dm-serif), serif", body: "var(--font-dm-sans), sans-serif" },
  "cormorant-montserrat": { label: "Cormorant + Montserrat", heading: "var(--font-cormorant), serif", body: "var(--font-montserrat), sans-serif" },
  "fraunces-inter": { label: "Fraunces + Inter", heading: "var(--font-fraunces), serif", body: "var(--font-inter), sans-serif" },
};
