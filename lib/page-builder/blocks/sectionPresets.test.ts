import { describe, it, expect } from "vitest";
import { SECTION_PRESETS } from "./sectionPresets";

describe("SECTION_PRESETS labels", () => {
  it("labels the masonry section preset 'Gallery Masonry'", () => {
    expect(SECTION_PRESETS.GalleryMasonryPreset.label).toBe("Gallery Masonry");
  });
  it("keeps the other gallery preset labels", () => {
    expect(SECTION_PRESETS.GalleryGridPreset.label).toBe("Gallery Grid");
    expect(SECTION_PRESETS.FeaturedWorkPreset.label).toBe("Featured Work");
  });
});
