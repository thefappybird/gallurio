import { describe, it, expect } from "vitest";
import { editorPuckConfig } from "./editorConfig";
import { puckConfig } from "./config";
import { SECTION_PRESETS } from "./blocks/sectionPresets";
import { galleryGridDefaultProps } from "./blocks/GalleryGridBlock";
import { galleryMasonryDefaultProps } from "./blocks/GalleryMasonryBlock";
import { galleryCarouselDefaultProps } from "./blocks/GalleryCarouselBlock";
import { featuredWorkDefaultProps } from "./blocks/FeaturedWorkBlock";
import { videoDefaultProps } from "./blocks/VideoBlock";
import { contactDetailsDefaultProps } from "./blocks/ContactDetailsBlock";
import {
  headingDefaultProps,
  textDefaultProps,
  imageDefaultProps,
  buttonDefaultProps,
  spacerDefaultProps,
  dividerDefaultProps,
  columnsDefaultProps,
  containerDefaultProps,
} from "./blocks/manualBlocks";

// The editor config mirrors the production blocks for client-safe previews. If a
// block's component keys or defaultProps drift from the editor's, saved data
// won't round-trip. This guards that parity.

describe("editorPuckConfig parity with production puckConfig", () => {
  it("registers exactly the same component types", () => {
    expect(Object.keys(editorPuckConfig.components).sort()).toEqual(
      Object.keys(puckConfig.components).sort()
    );
  });

  const defaults: Record<string, unknown> = {
    HeroPreset: SECTION_PRESETS.HeroPreset.defaultProps,
    AboutPreset: SECTION_PRESETS.AboutPreset.defaultProps,
    ServicesPreset: SECTION_PRESETS.ServicesPreset.defaultProps,
    CtaPreset: SECTION_PRESETS.CtaPreset.defaultProps,
    ContactPreset: SECTION_PRESETS.ContactPreset.defaultProps,
    GalleryGridPreset: SECTION_PRESETS.GalleryGridPreset.defaultProps,
    GalleryMasonryPreset: SECTION_PRESETS.GalleryMasonryPreset.defaultProps,
    FeaturedWorkPreset: SECTION_PRESETS.FeaturedWorkPreset.defaultProps,
    GalleryGrid: galleryGridDefaultProps,
    GalleryMasonry: galleryMasonryDefaultProps,
    GalleryCarousel: galleryCarouselDefaultProps,
    FeaturedWork: featuredWorkDefaultProps,
    Video: videoDefaultProps,
    ContactDetails: contactDetailsDefaultProps,
    Heading: headingDefaultProps,
    Text: textDefaultProps,
    Image: imageDefaultProps,
    Button: buttonDefaultProps,
    Spacer: spacerDefaultProps,
    Divider: dividerDefaultProps,
    Columns: columnsDefaultProps,
    Container: containerDefaultProps,
  };

  for (const [type, blockDefaults] of Object.entries(defaults)) {
    it(`${type}: editor defaultProps match the block's defaultProps`, () => {
      const editorDefaults = (
        editorPuckConfig.components as Record<string, { defaultProps?: unknown }>
      )[type]?.defaultProps;
      expect(editorDefaults).toEqual(blockDefaults);
    });

    it(`${type}: editor field keys match the production block's field keys`, () => {
      const editorFields = Object.keys(
        (editorPuckConfig.components as Record<string, { fields?: object }>)[type]?.fields ?? {}
      ).sort();
      const prodFields = Object.keys(
        (puckConfig.components as Record<string, { fields?: object }>)[type]?.fields ?? {}
      ).sort();
      expect(editorFields).toEqual(prodFields);
    });
  }

  it("removes footer from GalleryCarousel defaultProps and field keys", () => {
    expect(galleryCarouselDefaultProps).not.toHaveProperty("footer");
    const editorFields = Object.keys(editorPuckConfig.components.GalleryCarousel.fields ?? {});
    const prodFields = Object.keys(puckConfig.components.GalleryCarousel.fields ?? {});
    expect(editorFields).not.toContain("footer");
    expect(prodFields).not.toContain("footer");
  });

  it("removes gallery copy inputs from GalleryGrid field keys", () => {
    const editorFields = Object.keys(editorPuckConfig.components.GalleryGrid.fields ?? {});
    const prodFields = Object.keys(puckConfig.components.GalleryGrid.fields ?? {});
    expect(editorFields).not.toEqual(expect.arrayContaining(["heading", "description", "footer"]));
    expect(prodFields).not.toEqual(expect.arrayContaining(["heading", "description", "footer"]));
  });

  it("removes gallery copy inputs from GalleryMasonry field keys", () => {
    const editorFields = Object.keys(editorPuckConfig.components.GalleryMasonry.fields ?? {});
    const prodFields = Object.keys(puckConfig.components.GalleryMasonry.fields ?? {});
    expect(editorFields).not.toEqual(expect.arrayContaining(["heading", "description", "footer"]));
    expect(prodFields).not.toEqual(expect.arrayContaining(["heading", "description", "footer"]));
  });

  it("removes copy inputs from FeaturedWork field keys", () => {
    const editorFields = Object.keys(editorPuckConfig.components.FeaturedWork.fields ?? {});
    const prodFields = Object.keys(puckConfig.components.FeaturedWork.fields ?? {});
    expect(editorFields).not.toEqual(expect.arrayContaining(["heading", "subheading"]));
    expect(prodFields).not.toEqual(expect.arrayContaining(["heading", "subheading"]));
  });

  it("registers the new gallery preset section blocks", () => {
    expect(editorPuckConfig.components).toHaveProperty("GalleryGridPreset");
    expect(editorPuckConfig.components).toHaveProperty("GalleryMasonryPreset");
    expect(editorPuckConfig.components).toHaveProperty("FeaturedWorkPreset");
    expect(puckConfig.components).toHaveProperty("GalleryGridPreset");
    expect(puckConfig.components).toHaveProperty("GalleryMasonryPreset");
    expect(puckConfig.components).toHaveProperty("FeaturedWorkPreset");
  });

  it("Container exposes bgAnimation + bgSpeed and drops the legacy bg-publicId field", () => {
    const editorFields = Object.keys(editorPuckConfig.components.Container.fields ?? {});
    const prodFields = Object.keys(puckConfig.components.Container.fields ?? {});
    expect(editorFields).toContain("bgAnimation");
    expect(editorFields).toContain("bgSpeed");
    expect(editorFields).not.toContain("backgroundImagePublicId");
    expect(prodFields).toContain("bgAnimation");
    expect(prodFields).toContain("bgSpeed");
    expect(prodFields).not.toContain("backgroundImagePublicId");
  });

  it("Hero preset inherits the container background animation fields", () => {
    const heroFields = Object.keys(editorPuckConfig.components.HeroPreset.fields ?? {});
    expect(heroFields).toEqual(expect.arrayContaining(["bgAnimation", "bgSpeed"]));
  });
});

describe("block label renames", () => {
  const label = (cfg: { components: Record<string, { label?: string }> }, key: string) =>
    cfg.components[key]?.label;

  it("renames the gallery/featured preset labels", () => {
    expect(SECTION_PRESETS.GalleryGridPreset.label).toBe("Gallery Grid");
    expect(SECTION_PRESETS.GalleryMasonryPreset.label).toBe("Masonry");
    expect(SECTION_PRESETS.FeaturedWorkPreset.label).toBe("Featured Work");
  });

  it("renames the manual gallery/featured labels in both configs", () => {
    for (const cfg of [editorPuckConfig, puckConfig] as const) {
      expect(label(cfg as never, "GalleryGrid")).toBe("Photo Grid");
      expect(label(cfg as never, "GalleryMasonry")).toBe("Masonry");
      expect(label(cfg as never, "FeaturedWork")).toBe("Highlights");
      expect(label(cfg as never, "GalleryCarousel")).toBe("Gallery Carousel");
    }
  });
});
