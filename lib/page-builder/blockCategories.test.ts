import { describe, it, expect } from "vitest";
import { PRESET_BLOCK_KEYS, MANUAL_BLOCK_KEYS } from "./blockCategories";
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

  it("has exactly 36 unique preset keys (12 groups x 3 variants)", () => {
    expect(PRESET_BLOCK_KEYS).toHaveLength(36);
    expect(new Set(PRESET_BLOCK_KEYS).size).toBe(36);
  });

  it("keeps all ten legacy preset keys for persisted-page compatibility", () => {
    for (const key of LEGACY_PRESET_KEYS) {
      expect(PRESET_BLOCK_KEYS).toContain(key);
    }
  });

  it("groups presets into exactly 12 groups of exactly 3 keys, no key in two groups", () => {
    expect(PRESET_GROUPS).toHaveLength(12);
    const seen = new Set<string>();
    for (const group of PRESET_GROUPS) {
      expect(group.keys).toHaveLength(3);
      for (const key of group.keys) {
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe(36);
  });
});
