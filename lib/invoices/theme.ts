import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import {
  BRAND_KIT_THEME_PRESETS,
  type BrandKitThemePreset,
  type PortfolioBrandKit,
} from "@/lib/page-builder/types";

export type InvoiceColors = { main: string; accent: string; text: string };

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const validHex = (v: unknown): v is string => typeof v === "string" && HEX6.test(v);

/** "#rrggbb" -> [r, g, b], or null when not a valid 6-digit hex. */
export function hexToRgb(hex: string): [number, number, number] | null {
  if (!validHex(hex)) return null;
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two 6-digit hex colors (1..21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = luminance(hexA);
  const b = luminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function betterText(main: string, candidates: [string, string]): string {
  return contrastRatio(main, candidates[0]) >= contrastRatio(main, candidates[1]) ? candidates[0] : candidates[1];
}

type BrandKitColors = Pick<PortfolioBrandKit, "primaryColor" | "accentColor" | "foregroundColor" | "backgroundColor">;

/** Band colors from a brand kit; text = foreground/background, whichever reads better on primary. */
export function invoiceColorsFromBrandKit(kit: BrandKitColors): InvoiceColors {
  return {
    main: kit.primaryColor,
    accent: kit.accentColor,
    text: betterText(kit.primaryColor, [kit.foregroundColor, kit.backgroundColor]),
  };
}

export const INVOICE_THEME_PRESETS: Record<BrandKitThemePreset, InvoiceColors> = Object.fromEntries(
  BRAND_KIT_THEME_PRESETS.map((id) => [id, invoiceColorsFromBrandKit(THEME_PRESET_DEFINITIONS[id].brandKit)])
) as Record<BrandKitThemePreset, InvoiceColors>;

export type InvoiceThemePresetId = BrandKitThemePreset;
export const INVOICE_THEME_DEFAULT_PRESET: InvoiceThemePresetId = "minimal";

export type InvoiceTheme = {
  preset: InvoiceThemePresetId | "portfolio" | "saved" | "custom";
  savedThemeId?: string | null;
  main: string;
  accent: string;
  text?: string | null;
};
export type InvoiceThemePreviewBusiness = {
  name: string;
  logoUrl: string;
  address: string;
  email: string;
  currency: string;
};

/** The portfolio's brand kit, but only once published; a draft-only kit must not leak into documents. */
export function publishedBrandKit<K extends BrandKitColors>(
  publicPage: { brandKit?: K | null; publishedAt?: Date | string | null } | null | undefined
): K | null {
  return publicPage?.publishedAt && publicPage.brandKit ? publicPage.brandKit : null;
}

/** Plain-white vs near-black text, whichever reads better on `main` (for stored colors lacking `text`). */
export function readableTextOn(main: string): string {
  return betterText(main, ["#FFFFFF", "#111111"]);
}

/** Palettes of the retired preset ids, used when a stored legacy theme has no valid colors. */
const LEGACY_PALETTES: Record<string, { main: string; accent: string }> = {
  classic: { main: "#1A1A1A", accent: "#FFFFFF" },
  slate: { main: "#1E293B", accent: "#0EA5A4" },
  navyGold: { main: "#0F1B33", accent: "#C9A24B" },
  forest: { main: "#1F3D2B", accent: "#E8E2D0" },
};

export const LEGACY_INVOICE_PRESET_IDS = Object.keys(LEGACY_PALETTES) as ["classic", "slate", "navyGold", "forest"];

/** A theme as stored: may still carry a retired preset id until normalized. */
export type StoredInvoiceTheme = Omit<InvoiceTheme, "preset"> & {
  preset: InvoiceTheme["preset"] | (typeof LEGACY_INVOICE_PRESET_IDS)[number];
};

/**
 * Normalizes a stored theme on read. Current presets pass through; legacy ids
 * (classic/slate/navyGold/forest) become a `custom` theme keeping their colors;
 * any other unknown id falls back to the default preset.
 */
export function normalizeInvoiceTheme(theme: StoredInvoiceTheme): InvoiceTheme {
  const id = theme.preset as string;
  if (id === "portfolio" || id === "saved" || id === "custom") return theme as InvoiceTheme;
  if ((BRAND_KIT_THEME_PRESETS as readonly string[]).includes(id)) return theme as InvoiceTheme;
  const legacy = Object.hasOwn(LEGACY_PALETTES, id) ? LEGACY_PALETTES[id] : null;
  if (!legacy) return { preset: INVOICE_THEME_DEFAULT_PRESET, ...INVOICE_THEME_PRESETS[INVOICE_THEME_DEFAULT_PRESET] };
  const main = validHex(theme.main) ? theme.main : legacy.main;
  const accent = validHex(theme.accent) ? theme.accent : legacy.accent;
  return {
    preset: "custom",
    savedThemeId: null,
    main,
    accent,
    text: validHex(theme.text) ? theme.text : readableTextOn(main),
  };
}

/** Theme for a workspace with no stored invoiceTheme (pre-feature): keeps the original classic dark look. */
export const LEGACY_DEFAULT_INVOICE_THEME: InvoiceTheme = {
  preset: "custom",
  savedThemeId: null,
  ...LEGACY_PALETTES.classic,
  text: readableTextOn(LEGACY_PALETTES.classic.main),
};

export function resolveInvoiceTheme(
  rawTheme: StoredInvoiceTheme | null | undefined,
  brandKit?: BrandKitColors | null
): InvoiceColors {
  const theme = normalizeInvoiceTheme(rawTheme ?? LEGACY_DEFAULT_INVOICE_THEME);
  if (theme?.preset === "portfolio" && brandKit) return invoiceColorsFromBrandKit(brandKit);
  // "portfolio" with no (published) kit degrades to its stored snapshot.
  if (theme && (theme.preset === "saved" || theme.preset === "custom" || theme.preset === "portfolio")) {
    return { main: theme.main, accent: theme.accent, text: theme.text || readableTextOn(theme.main) };
  }
  if (theme && (BRAND_KIT_THEME_PRESETS as readonly string[]).includes(theme.preset)) {
    return INVOICE_THEME_PRESETS[theme.preset as InvoiceThemePresetId];
  }
  return INVOICE_THEME_PRESETS[INVOICE_THEME_DEFAULT_PRESET];
}
