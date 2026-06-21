import { describe, it, expect } from "vitest";
import {
  SECTION_PRESETS,
  GALLERY_GRID_PRESET,
  GALLERY_MASONRY_PRESET,
} from "./sectionPresets";

describe("SECTION_PRESETS labels", () => {
  it("labels the masonry section preset 'Gallery Masonry'", () => {
    expect(SECTION_PRESETS.GalleryMasonryPreset.label).toBe("Gallery Masonry");
  });
  it("keeps the other gallery preset labels", () => {
    expect(SECTION_PRESETS.GalleryGridPreset.label).toBe("Gallery Grid");
    expect(SECTION_PRESETS.FeaturedWorkPreset.label).toBe("Featured Work");
  });
});

describe("section preset stale props", () => {
  it("GALLERY_GRID_PRESET nested GalleryGrid child has no collectionId or maxItems", () => {
    // Find the nested GalleryGrid child in the content slot
    const gridChild = (GALLERY_GRID_PRESET.content as unknown[]).find(
      (item: unknown) => (item as { type: string }).type === "GalleryGrid"
    ) as { type: string; props: Record<string, unknown> } | undefined;
    expect(gridChild).toBeDefined();
    expect(gridChild!.props).not.toHaveProperty("collectionId");
    expect(gridChild!.props).not.toHaveProperty("maxItems");
    expect(gridChild!.props.images).toEqual([]);
  });

  it("GALLERY_MASONRY_PRESET nested GalleryMasonry child has no collectionId or maxItems", () => {
    const masonryChild = (GALLERY_MASONRY_PRESET.content as unknown[]).find(
      (item: unknown) => (item as { type: string }).type === "GalleryMasonry"
    ) as { type: string; props: Record<string, unknown> } | undefined;
    expect(masonryChild).toBeDefined();
    expect(masonryChild!.props).not.toHaveProperty("collectionId");
    expect(masonryChild!.props).not.toHaveProperty("maxItems");
    expect(masonryChild!.props.images).toEqual([]);
  });
});
