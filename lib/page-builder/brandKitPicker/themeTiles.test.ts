import { describe, it, expect } from "vitest";
import {
  buildThemeTiles,
  filterThemeTiles,
  paginate,
  brandKitsEqualForSelection,
  THEMES_PER_PAGE,
} from "./themeTiles";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";
import { BRAND_KIT_THEME_PRESETS, DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioSavedTheme } from "@/lib/page-builder/types";

const savedThemes: PortfolioSavedTheme[] = [
  { id: "a", name: "My Wedding", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" } },
  { id: "b", name: "Studio Dark", brandKit: { ...DEFAULT_BRAND_KIT, backgroundColor: "#000000" } },
];

const presetName = (id: (typeof BRAND_KIT_THEME_PRESETS)[number]) =>
  THEME_PRESET_DEFINITIONS[id].name;

describe("buildThemeTiles", () => {
  it("lists presets first, then saved themes", () => {
    const tiles = buildThemeTiles({ presetName, savedThemes });
    expect(tiles).toHaveLength(BRAND_KIT_THEME_PRESETS.length + savedThemes.length);
    expect(tiles.slice(0, BRAND_KIT_THEME_PRESETS.length).every((t) => !t.savedThemeId)).toBe(true);
    expect(tiles[0].name).toBe("Minimal");
    expect(tiles[0].key).toBe("preset:minimal");
  });

  it("marks saved tiles with their id and raw name", () => {
    const tiles = buildThemeTiles({ presetName, savedThemes });
    const saved = tiles.find((t) => t.savedThemeId === "a");
    expect(saved?.name).toBe("My Wedding");
    expect(saved?.key).toBe("saved:a");
    expect(saved?.brandKit.accentColor).toBe("#abcabc");
  });
});

describe("filterThemeTiles", () => {
  const tiles = buildThemeTiles({ presetName, savedThemes });
  it("returns all tiles for an empty query", () => {
    expect(filterThemeTiles(tiles, "  ")).toHaveLength(tiles.length);
  });
  it("matches by name, case-insensitively", () => {
    const result = filterThemeTiles(tiles, "wEdd");
    expect(result.map((t) => t.name)).toEqual(["My Wedding"]);
  });
  it("returns empty when nothing matches", () => {
    expect(filterThemeTiles(tiles, "zzz")).toEqual([]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 14 }, (_, i) => i);
  it("returns the first page of THEMES_PER_PAGE items", () => {
    const { pageItems, pageCount, page } = paginate(items, 0);
    expect(THEMES_PER_PAGE).toBe(9);
    expect(pageItems).toHaveLength(THEMES_PER_PAGE);
    expect(pageCount).toBe(Math.ceil(items.length / THEMES_PER_PAGE));
    expect(page).toBe(0);
  });
  it("returns the remainder on the last page", () => {
    expect(paginate(items, 1).pageItems).toHaveLength(items.length - THEMES_PER_PAGE);
  });
  it("clamps an out-of-range page", () => {
    const { page, pageItems } = paginate(items, 9);
    expect(page).toBe(1);
    expect(pageItems).toHaveLength(5);
  });
  it("always reports at least one page when empty", () => {
    expect(paginate([], 0).pageCount).toBe(1);
  });
});

describe("brandKitsEqualForSelection", () => {
  it("is true for identical styling fields", () => {
    expect(brandKitsEqualForSelection(DEFAULT_BRAND_KIT, { ...DEFAULT_BRAND_KIT })).toBe(true);
  });
  it("is false when a color differs", () => {
    expect(
      brandKitsEqualForSelection(DEFAULT_BRAND_KIT, { ...DEFAULT_BRAND_KIT, accentColor: "#000000" })
    ).toBe(false);
  });
  it("normalizes missing fonts via the legacy pair", () => {
    const legacy = { ...DEFAULT_BRAND_KIT, headingFont: undefined, bodyFont: undefined };
    expect(brandKitsEqualForSelection(legacy, DEFAULT_BRAND_KIT)).toBe(true);
  });
});
