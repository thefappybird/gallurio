import { describe, it, expect } from "vitest";
import { PRESET_BLOCK_KEYS, MANUAL_BLOCK_KEYS } from "./blockCategories";

describe("blockCategories", () => {
  it("groups GalleryCarousel under Preset blocks, not Manual", () => {
    expect(PRESET_BLOCK_KEYS).toContain("GalleryCarousel");
    expect(MANUAL_BLOCK_KEYS).not.toContain("GalleryCarousel");
  });

  it("keeps the manual gallery/featured primitives under Manual", () => {
    for (const key of ["GalleryGrid", "GalleryMasonry", "FeaturedWork"]) {
      expect(MANUAL_BLOCK_KEYS).toContain(key);
    }
  });
});
