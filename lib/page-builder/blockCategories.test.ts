import { describe, it, expect } from "vitest";
import {
  PRESET_BLOCK_KEYS,
  MANUAL_BLOCK_KEYS,
  MANUAL_BLOCK_DESCRIPTION_KEYS,
} from "./blockCategories";
import { PRESET_GROUPS } from "./blocks/sectionPresets";

const LEGACY_PRESET_KEYS = [
  "HeroPreset",
  "AboutPreset",
  "ServicesPreset",
  "CtaPreset",
  "ContactPreset",
  "GalleryGridPreset",
  "GalleryMasonryPreset",
  "FeaturedWorkPreset",
  "GalleryLandingPreset",
  "VideoPreset",
];

describe("blockCategories", () => {
  it("groups GalleryLandingPreset under Preset blocks, not Manual", () => {
    expect(PRESET_BLOCK_KEYS).toContain("GalleryLandingPreset");
    expect(MANUAL_BLOCK_KEYS).not.toContain("GalleryLandingPreset");
  });

  it("keeps gallery layouts insertable but phases Highlights out of Manual", () => {
    for (const key of ["GalleryGrid", "GalleryMasonry"]) {
      expect(MANUAL_BLOCK_KEYS).toContain(key);
    }
    expect(MANUAL_BLOCK_KEYS).not.toContain("FeaturedWork");
  });

  // CollectionCard is the single-collection primitive: FeaturedWork owns a whole
  // grid at a hardcoded 7/9 tile, so a preset cannot place one collection beside
  // copy or crop it landscape without it.
  it("registers CollectionCard as a manual block", () => {
    expect(MANUAL_BLOCK_KEYS).toContain("CollectionCard");
    expect(PRESET_BLOCK_KEYS).not.toContain("CollectionCard");
  });

  it("provides one localized description key for every manual drawer block", () => {
    expect(Object.keys(MANUAL_BLOCK_DESCRIPTION_KEYS).sort()).toEqual(
      [...MANUAL_BLOCK_KEYS].sort(),
    );
    for (const key of MANUAL_BLOCK_KEYS) {
      expect(MANUAL_BLOCK_DESCRIPTION_KEYS[key]).toMatch(/^puckConfig\.manualDescriptions\./);
    }
  });

  it("has exactly 34 unique preset keys (one Navigation plus 11 groups x 3 variants)", () => {
    expect(PRESET_BLOCK_KEYS).toHaveLength(34);
    expect(new Set(PRESET_BLOCK_KEYS).size).toBe(34);
  });

  it("keeps all ten legacy preset keys for persisted-page compatibility", () => {
    for (const key of LEGACY_PRESET_KEYS) {
      expect(PRESET_BLOCK_KEYS).toContain(key);
    }
  });

  it("groups one Navigation and 11 three-variant groups without duplicates", () => {
    expect(PRESET_GROUPS).toHaveLength(12);
    const seen = new Set<string>();
    for (const group of PRESET_GROUPS) {
      expect(group.keys).toHaveLength(group.id === "nav" ? 1 : 3);
      for (const key of group.keys) {
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe(34);
  });
});
