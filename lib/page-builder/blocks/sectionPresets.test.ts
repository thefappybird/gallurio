import { describe, it, expect } from "vitest";
import {
  SECTION_PRESETS,
  CTA_PRESET,
  HERO_PRESET,
  GALLERY_GRID_PRESET,
  GALLERY_MASONRY_PRESET,
  GALLERY_LANDING_PRESET,
} from "./sectionPresets";

/** The Button child of a preset's top-level content slot. */
function buttonChild(preset: { content: unknown }) {
  return (preset.content as Array<{ type: string; props: Record<string, unknown> }>).find(
    (c) => c.type === "Button"
  );
}

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

describe("buttons on an accent band", () => {
  // ButtonBlock has no brand-kit fallback: with `buttonStyle` unset it renders a
  // transparent fill with its label and 2px border in `--pf-color-fg`. On a
  // section whose own background IS the accent, that measures 1.66:1 (Bold) to
  // 3.54:1 (Editorial) — every committed kit fails DESIGN.md's 4.5:1 bar.
  // The band's other children already pin `textColorToken: "background"`; the
  // button has to pin its own colors to match.
  it("CTA_PRESET's button pins a solid fill in the background token", () => {
    const btn = buttonChild(CTA_PRESET);
    expect(btn?.props._style).toMatchObject({
      buttonStyle: "solid",
      buttonColorToken: "background",
      textColorToken: "accent",
    });
  });

  it("HERO_PRESET's button pins the same colors over its scrimmed band", () => {
    const btn = buttonChild(HERO_PRESET);
    expect(btn?.props._style).toMatchObject({
      buttonStyle: "solid",
      buttonColorToken: "background",
      textColorToken: "accent",
    });
  });
});

describe("GalleryLandingPreset", () => {
  it("is registered in SECTION_PRESETS with label 'Gallery landing'", () => {
    expect(SECTION_PRESETS.GalleryLandingPreset.label).toBe("Gallery landing");
  });

  it("has minHeight 'medium' and no Button child", () => {
    expect(GALLERY_LANDING_PRESET.minHeight).toBe("medium");
    const children = GALLERY_LANDING_PRESET.content as Array<{ type: string }>;
    expect(children.some((c) => c.type === "Button")).toBe(false);
  });

  it("has backgroundImages: [] (multi-image slideshow capable)", () => {
    expect(GALLERY_LANDING_PRESET.backgroundImages).toEqual([]);
  });
});
