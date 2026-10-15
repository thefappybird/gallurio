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

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = toLinear(parseInt(h.slice(0, 2), 16));
  const g = toLinear(parseInt(h.slice(2, 4), 16));
  const b = toLinear(parseInt(h.slice(4, 6), 16));
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

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const validHex = (v: unknown): v is string => typeof v === "string" && HEX6.test(v);

/**
 * Normalizes a stored theme on read. Current presets pass through; legacy ids
 * (classic/slate/navyGold/forest) become a `custom` theme keeping their colors;
 * any other unknown id falls back to the default preset.
 */
export function normalizeInvoiceTheme(theme: InvoiceTheme): InvoiceTheme {
  const id = theme.preset as string;
  if (id === "portfolio" || id === "saved" || id === "custom") return theme;
  if ((BRAND_KIT_THEME_PRESETS as readonly string[]).includes(id)) return theme;
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

export function resolveInvoiceTheme(
  rawTheme: InvoiceTheme | null | undefined,
  brandKit?: BrandKitColors | null
): InvoiceColors {
  const theme = rawTheme ? normalizeInvoiceTheme(rawTheme) : rawTheme;
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
