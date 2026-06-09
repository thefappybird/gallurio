import {
  BRAND_KIT_THEME_PRESETS,
  type BrandKitThemePreset,
  type PortfolioBrandKit,
  type PortfolioSavedTheme,
} from "@/lib/page-builder/types";
import { legacyFontPairToFonts } from "@/lib/page-builder/fonts";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";

/** Max tiles per page (3x3). */
export const THEMES_PER_PAGE = 9;

export type ThemeTileModel = {
  /** Stable React key + identity, e.g. "preset:minimal" or "saved:<id>". */
  key: string;
  /** Display title - already localized for presets, raw name for saved themes. */
  name: string;
  /** Full brand kit applied on click. */
  brandKit: PortfolioBrandKit;
  /** Present (and deletable) for saved themes; undefined for built-in presets. */
  savedThemeId?: string;
};

/** Built-in presets first, saved themes after, in one flat list. */
export function buildThemeTiles(opts: {
  presetName: (id: BrandKitThemePreset) => string;
  savedThemes: PortfolioSavedTheme[];
}): ThemeTileModel[] {
  const presetTiles: ThemeTileModel[] = BRAND_KIT_THEME_PRESETS.map((id) => ({
    key: `preset:${id}`,
    name: opts.presetName(id),
    brandKit: THEME_PRESET_DEFINITIONS[id].brandKit,
  }));
  const savedTiles: ThemeTileModel[] = opts.savedThemes.map((theme) => ({
    key: `saved:${theme.id}`,
    name: theme.name,
    brandKit: theme.brandKit,
    savedThemeId: theme.id,
  }));
  return [...presetTiles, ...savedTiles];
}

/** Case-insensitive filter by tile name. Empty/whitespace query returns all. */
export function filterThemeTiles(tiles: ThemeTileModel[], query: string): ThemeTileModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return tiles;
  return tiles.filter((tile) => tile.name.toLowerCase().includes(q));
}

/** Slice into a clamped page of `perPage` items; reports the resolved page. */
export function paginate<T>(
  items: T[],
  page: number,
  perPage: number = THEMES_PER_PAGE
): { pageItems: T[]; pageCount: number; page: number } {
  const safePerPage = Math.max(1, perPage);
  const pageCount = Math.max(1, Math.ceil(items.length / safePerPage));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const start = safePage * safePerPage;
  return { pageItems: items.slice(start, start + safePerPage), pageCount, page: safePage };
}

const SELECTION_COLOR_FIELDS = [
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "backgroundColor",
  "foregroundColor",
] as const;

function normalizedFonts(bk: PortfolioBrandKit): { headingFont: string; bodyFont: string } {
  const legacy = legacyFontPairToFonts(bk.fontPair);
  return {
    headingFont: bk.headingFont ?? legacy.headingFont,
    bodyFont: bk.bodyFont ?? legacy.bodyFont,
  };
}

/**
 * True when two kits would render identically: same 5 colors, resolved fonts,
 * radius, and button style. `themePreset` (a label only) is ignored so a saved
 * theme cloned from a preset still matches.
 */
export function brandKitsEqualForSelection(a: PortfolioBrandKit, b: PortfolioBrandKit): boolean {
  for (const field of SELECTION_COLOR_FIELDS) {
    if (a[field].toLowerCase() !== b[field].toLowerCase()) return false;
  }
  const fa = normalizedFonts(a);
  const fb = normalizedFonts(b);
  return (
    fa.headingFont === fb.headingFont &&
    fa.bodyFont === fb.bodyFont &&
    a.radius === b.radius &&
    a.buttonStyle === b.buttonStyle
  );
}
