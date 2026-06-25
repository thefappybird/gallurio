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
});
