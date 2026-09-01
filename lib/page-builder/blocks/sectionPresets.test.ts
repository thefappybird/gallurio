import { describe, it, expect } from "vitest";
import {
  PRESET_GROUP_IDS,
  SECTION_PRESETS,
  SECTION_PRESET_KEYS,
  NAV_PRESET_KEYS,
  CTA_PRESET,
  HERO_PRESET,
  GALLERY_GRID_PRESET,
  GALLERY_MASONRY_PRESET,
  GALLERY_LANDING_PRESET,
} from "./sectionPresets";

const SECTION_GROUND_TOKENS = new Set(["background", "primary", "accent"]);

/** The Button child of a preset's top-level content slot. */
function buttonChild(preset: { content: unknown }) {
  return (preset.content as Array<{ type: string; props: Record<string, unknown> }>).find(
    (c) => c.type === "Button"
  );
}

describe("SECTION_PRESETS labels", () => {
  it("labels the masonry section preset with its variant name 'Editorial story'", () => {
    expect(SECTION_PRESETS.GalleryMasonryPreset.label).toBe("Editorial story");
  });
  it("keeps the other gallery preset variant labels", () => {
    expect(SECTION_PRESETS.GalleryGridPreset.label).toBe("Classic grid");
    expect(SECTION_PRESETS.FeaturedWorkPreset.label).toBe("Collection overview");
  });
});

describe("SECTION_PRESETS semantic color diversity", () => {
  // The `nav` group renders through NavigationBlock (componentType: "Navigation"),
  // not ContainerBlock — it has no `_style.bgColorToken` section-ground concept
  // (Navigation uses its own `backgroundColor`/`backgroundOpacity` fields instead).
  it("grounds every Container-shaped preset in a supported active-theme section token", () => {
    for (const [key, preset] of Object.entries(SECTION_PRESETS)) {
      if (preset.componentType === "Navigation") continue;
      const style = preset.defaultProps._style as { bgColorToken?: string } | undefined;
      expect(
        SECTION_GROUND_TOKENS.has(style?.bgColorToken ?? ""),
        `${key} needs an explicit background, primary, or accent section ground`
      ).toBe(true);
    }
  });

  it("gives every three-variant Container-shaped group at least two distinct section grounds", () => {
    for (const group of PRESET_GROUP_IDS) {
      if (group === "nav") continue;
      const grounds = new Set(
        Object.values(SECTION_PRESETS)
          .filter((preset) => preset.group === group)
          .map((preset) => preset.defaultProps._style?.bgColorToken)
      );
      expect(grounds.size, `${group} presets all use the same section ground`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("componentType", () => {
  it("defaults to 'Container' for every non-nav preset", () => {
    for (const key of SECTION_PRESET_KEYS) {
      if (NAV_PRESET_KEYS.includes(key)) continue;
      expect(SECTION_PRESETS[key].componentType, key).toBe("Container");
    }
  });

  it("is 'Navigation' for exactly the 3 nav presets", () => {
    expect(NAV_PRESET_KEYS.sort()).toEqual(
      ["NavBorderedPreset", "NavScaledPreset", "NavUnderlinedPreset"].sort()
    );
    for (const key of NAV_PRESET_KEYS) {
      expect(SECTION_PRESETS[key].componentType).toBe("Navigation");
    }
  });
});

describe("nav group", () => {
  it("is first in PRESET_GROUP_IDS", () => {
    expect(PRESET_GROUP_IDS[0]).toBe("nav");
  });

  it("every nav preset carries _chrome: 'nav'", () => {
    for (const key of NAV_PRESET_KEYS) {
      expect((SECTION_PRESETS[key].defaultProps as { _chrome?: string })._chrome).toBe("nav");
    }
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
    expect(gridChild!.props.images).toBeUndefined();
    expect((gridChild!.props.content as unknown[]).every((item) => (item as { type: string }).type === "Image")).toBe(true);
  });

  it("GALLERY_MASONRY_PRESET nested GalleryMasonry child has no collectionId or maxItems", () => {
    const masonryChild = (GALLERY_MASONRY_PRESET.content as unknown[]).find(
      (item: unknown) => (item as { type: string }).type === "GalleryMasonry"
    ) as { type: string; props: Record<string, unknown> } | undefined;
    expect(masonryChild).toBeDefined();
    expect(masonryChild!.props).not.toHaveProperty("collectionId");
    expect(masonryChild!.props).not.toHaveProperty("maxItems");
    expect(masonryChild!.props.images).toBeUndefined();
    expect(masonryChild!.props.content).toBeUndefined();
    expect(masonryChild!.props.masonryLayout).toBe("columns");
    for (const lane of ["column1", "column2", "column3"]) {
      expect((masonryChild!.props[lane] as unknown[]).every(
        (item) => (item as { type: string }).type === "Image"
      )).toBe(true);
    }
  });
});

describe("buttons on a colored band", () => {
  it("CTA_PRESET's button pins an outlined foreground treatment", () => {
    const btn = buttonChild(CTA_PRESET);
    expect(btn?.props._style).toMatchObject({
      buttonStyle: "outline",
      buttonColorToken: "foreground",
      textColorToken: "foreground",
    });
  });

  it("HERO_PRESET's button pins the same foreground treatment over its scrim", () => {
    const btn = buttonChild(HERO_PRESET);
    expect(btn?.props._style).toMatchObject({
      buttonStyle: "outline",
      buttonColorToken: "foreground",
      textColorToken: "foreground",
    });
  });
});

describe("GalleryLandingPreset", () => {
  it("is registered in SECTION_PRESETS with variant label 'Slideshow cover'", () => {
    expect(SECTION_PRESETS.GalleryLandingPreset.label).toBe("Slideshow cover");
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
