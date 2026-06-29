import { describe, it, expect } from "vitest";
import { editorPuckConfig, createEditorConfig } from "./editorConfig";
import { puckConfig } from "./config";
import { SECTION_PRESETS } from "./blocks/sectionPresets";
import { galleryGridDefaultProps } from "./blocks/GalleryGridBlock";
import { galleryMasonryDefaultProps } from "./blocks/GalleryMasonryBlock";
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
    GalleryLandingPreset: SECTION_PRESETS.GalleryLandingPreset.defaultProps,
    GalleryGrid: galleryGridDefaultProps,
    GalleryMasonry: galleryMasonryDefaultProps,
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

  it("enables contentEditable inline editing on the visible text fields", () => {
    const fieldOf = (type: string, key: string) =>
      (editorPuckConfig.components as Record<string, { fields?: Record<string, { contentEditable?: boolean }> }>)
        [type]?.fields?.[key];
    expect(fieldOf("Heading", "text")?.contentEditable).toBe(true);
    expect(fieldOf("Text", "text")?.contentEditable).toBe(true);
    expect(fieldOf("Button", "label")?.contentEditable).toBe(true);
    expect(fieldOf("Video", "description")?.contentEditable).toBe(true);
    expect(fieldOf("Video", "footer")?.contentEditable).toBe(true);
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

  it("registers GalleryLandingPreset in editorPuckConfig", () => {
    expect(editorPuckConfig.components).toHaveProperty("GalleryLandingPreset");
  });
});

describe("GalleryLandingPreset carousel hint", () => {
  it("GalleryLandingPreset carries a backgroundImages carousel hint accessible via component metadata", () => {
    const cfg = editorPuckConfig.components.GalleryLandingPreset as Record<string, unknown>;
    const meta = cfg?.metadata as Record<string, unknown> | undefined;
    // metadata.backgroundImagesHint must mention multiple images and carousel or slideshow
    // so editor tooling (e.g. a help popover) can surface the hint without polluting
    // Puck field keys (which must stay in sync with the production config).
    expect(meta?.backgroundImagesHint).toBeDefined();
    const hint = String(meta?.backgroundImagesHint ?? "").toLowerCase();
    expect(hint).toMatch(/multiple/i);
    expect(hint).toMatch(/carousel|slideshow/i);
  });
});

describe("preset section blocks are inline so grid placement applies", () => {
  // Preset sections render via ContainerBlock, whose root carries the resolved
  // colSpan/rowSpan (grid-column/grid-row: span N). For that to take effect when
  // the section is a child of a Columns grid in the EDITOR canvas, Puck must treat
  // the block as `inline` — otherwise Puck wraps it in its own drag <div> which
  // becomes the grid child, and the span lands on the inner section (ignored).
  // Plain Container and Columns are already inline; the presets must match.
  const PRESET_KEYS = [
    "HeroPreset",
    "AboutPreset",
    "ServicesPreset",
    "CtaPreset",
    "ContactPreset",
    "GalleryGridPreset",
    "GalleryMasonryPreset",
    "FeaturedWorkPreset",
    "GalleryLandingPreset",
  ] as const;

  for (const key of PRESET_KEYS) {
    it(`${key} is inline: true`, () => {
      const cfg = (editorPuckConfig.components as Record<string, { inline?: boolean }>)[key];
      expect(cfg?.inline).toBe(true);
    });
  }
});

describe("createEditorConfig factory", () => {
  it("uses translated block labels when called with a custom translator", () => {
    const mockT = (key: string) => `[${key}]`;
    const cfg = createEditorConfig(mockT);
    const components = cfg.components as Record<string, { label?: string }>;
    expect(components.GalleryGrid?.label).toBe("[puckConfig.blocks.galleryGrid]");
    expect(components.HeroPreset?.label).toBe("[puckConfig.blocks.heroPreset]");
    expect(components.Container?.label).toBe("[puckConfig.blocks.container]");
  });
});

describe("block label renames", () => {
  const label = (cfg: { components: Record<string, { label?: string }> }, key: string) =>
    cfg.components[key]?.label;

  it("renames the gallery/featured preset labels", () => {
    expect(SECTION_PRESETS.GalleryGridPreset.label).toBe("Gallery Grid");
    expect(SECTION_PRESETS.GalleryMasonryPreset.label).toBe("Gallery Masonry");
    expect(SECTION_PRESETS.FeaturedWorkPreset.label).toBe("Featured Work");
  });

  it("renames the manual gallery/featured labels in both configs", () => {
    for (const cfg of [editorPuckConfig, puckConfig] as const) {
      expect(label(cfg as never, "GalleryGrid")).toBe("Photo Grid");
      expect(label(cfg as never, "GalleryMasonry")).toBe("Masonry");
      expect(label(cfg as never, "FeaturedWork")).toBe("Highlights");
      expect(label(cfg as never, "GalleryLandingPreset")).toBe("Gallery landing");
    }
  });
});
