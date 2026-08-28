import { describe, it, expect } from "vitest";
import { PRESET_BLOCK_KEYS, MANUAL_BLOCK_KEYS } from "./blockCategories";

describe("blockCategories", () => {
  it("groups GalleryLandingPreset under Preset blocks, not Manual", () => {
    expect(PRESET_BLOCK_KEYS).toContain("GalleryLandingPreset");
    expect(MANUAL_BLOCK_KEYS).not.toContain("GalleryLandingPreset");
  });

  it("keeps the manual gallery/featured primitives under Manual", () => {
    for (const key of ["GalleryGrid", "GalleryMasonry", "FeaturedWork"]) {
      expect(MANUAL_BLOCK_KEYS).toContain(key);
    }
  });

  // CollectionCard is the single-collection primitive: FeaturedWork owns a whole
  // grid at a hardcoded 7/9 tile, so a preset cannot place one collection beside
  // copy or crop it landscape without it.
  it("registers CollectionCard as a manual block", () => {
    expect(MANUAL_BLOCK_KEYS).toContain("CollectionCard");
    expect(PRESET_BLOCK_KEYS).not.toContain("CollectionCard");
  });
});
