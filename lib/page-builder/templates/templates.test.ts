import { describe, it, expect } from "vitest";
import {
  PORTFOLIO_TEMPLATES,
  PORTFOLIO_TEMPLATE_IDS,
  getTemplate,
  getTemplateForBusinessType,
} from "./index";
import { portfolioPuckDataSchema } from "@/lib/validators/publicPage";
import { brandKitSchema, portfolioContactConfigSchema } from "@/lib/validators/publicPage";
import { puckConfig } from "@/lib/page-builder/config";
import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import { columns } from "./_blocks";

const REGISTERED_BLOCKS = new Set(Object.keys(puckConfig.components));

const mockCtx = {
  workspace: {
    name: "Studio Aurora",
  },
};

describe("portfolio template registry", () => {
  it("registers exactly the canonical template ids", () => {
    expect(PORTFOLIO_TEMPLATES.map((t) => t.id).sort()).toEqual(
      [...PORTFOLIO_TEMPLATE_IDS].sort()
    );
  });

  it("has unique ids", () => {
    const ids = PORTFOLIO_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const template of PORTFOLIO_TEMPLATES) {
    describe(template.id, () => {
      const data = template.seedData(mockCtx);

      it("produces structurally valid Puck data for both zones", () => {
        const parsed = portfolioPuckDataSchema.safeParse(data);
        expect(parsed.success).toBe(true);
      });

      it("seeds non-empty home and gallery zones", () => {
        // scratch is an intentionally empty canvas — exempt from this check.
        if (template.id === "scratch") return;
        expect(data.home?.content.length ?? 0).toBeGreaterThan(0);
        expect(data.gallery?.content.length ?? 0).toBeGreaterThan(0);
      });

      it("only references blocks that exist in the Puck registry", () => {
        const allBlocks = [
          ...(data.home?.content ?? []),
          ...(data.gallery?.content ?? []),
        ];
        for (const block of allBlocks) {
          expect(REGISTERED_BLOCKS.has(block.type), `Template '${template.id}' references unregistered block '${block.type}'`).toBe(true);
        }
      });

      it("only references registered block types when recursively walking nested props.content", () => {
        // Walks every block including those nested inside Columns/Container props.content slots.
        // The existing registry test above only walks top-level blocks — this one catches
        // type mismatches in nested content (e.g. CTAPreset → CtaPreset inside a Columns block).
        function walkBlocks(blocks: { type: string; props?: Record<string, unknown> }[]) {
          for (const block of blocks) {
            expect(
              REGISTERED_BLOCKS.has(block.type),
              `Template '${template.id}': nested block type '${block.type}' is not in the Puck registry`
            ).toBe(true);
            const nested = block.props?.content;
            if (Array.isArray(nested)) walkBlocks(nested as typeof blocks);
          }
        }
        walkBlocks([
          ...(data.home?.content ?? []),
          ...(data.gallery?.content ?? []),
        ]);
      });

      it("seeds gallery blocks with empty images[] (owner picks photos)", () => {
        // Preset blocks (e.g. GalleryLandingPreset) are Container-based and have
        // no images prop — only data gallery blocks (GalleryGrid, GalleryMasonry)
        // carry images[]. The type check excludes the *Preset suffix.
        const GALLERY_DATA_TYPES = new Set(["GalleryGrid", "GalleryMasonry", "GalleryCarousel", "FeaturedWork"]);
        for (const block of data.gallery?.content ?? []) {
          if (GALLERY_DATA_TYPES.has(block.type)) {
            expect(block.props.images).toEqual([]);
            expect(block.props).not.toHaveProperty("collectionId");
          }
        }
      });

      it("has a valid default brand kit", () => {
        expect(brandKitSchema.safeParse(template.defaultBrandKit).success).toBe(true);
      });

      it("has a valid default contact config", () => {
        expect(portfolioContactConfigSchema.safeParse(template.defaultContact).success).toBe(true);
      });

      it("has a defaultHeader field", () => {
        expect(template.defaultHeader).toBeDefined();
        expect(typeof template.defaultHeader).toBe("object");
      });

      it("has a defaultCollectionsPopup field", () => {
        expect(template.defaultCollectionsPopup).toBeDefined();
        expect(typeof template.defaultCollectionsPopup).toBe("object");
      });

      it("explicitly paints both page roots with the theme background token", () => {
        for (const zoneData of [data.home, data.gallery]) {
          expect(
            (zoneData?.root?.props as { _rootStyle?: { bgColorToken?: string } } | undefined)
              ?._rootStyle?.bgColorToken,
          ).toBe("background");
        }
      });

      it("does not seed a container text token identical to its background", () => {
        const containerTypes = new Set([
          "Container",
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
        ]);
        function walk(blocks: { type: string; props?: Record<string, unknown> }[]) {
          for (const block of blocks) {
            const style = block.props?._style as
              | { bgColorToken?: string; textColorToken?: string }
              | undefined;
            if (containerTypes.has(block.type) && style?.textColorToken) {
              expect(
                style.textColorToken,
                `${template.id} ${block.props?.id}: container text must remain legible`,
              ).not.toBe(style.bgColorToken);
            }
            if (Array.isArray(block.props?.content)) {
              walk(block.props.content as typeof blocks);
            }
          }
        }
        walk([...(data.home?.content ?? []), ...(data.gallery?.content ?? [])]);
      });

      it("starts the home zone with a HeroPreset or Columns block", () => {
        // scratch is an intentionally empty canvas — exempt from this check.
        if (template.id === "scratch") return;
        const firstBlock = data.home?.content[0];
        // bold/luxury/editorial open with a Columns mosaic that embeds HeroPreset;
        // minimal/romantic-style templates open directly with HeroPreset.
        expect(["HeroPreset", "Columns"], `Expected first home block to be HeroPreset or Columns, got '${firstBlock?.type}'`)
          .toContain(firstBlock?.type);
      });

      it("every top-level home and gallery block has a stable id", () => {
        const allBlocks = [
          ...(data.home?.content ?? []),
          ...(data.gallery?.content ?? []),
        ];
        for (const block of allBlocks) {
          expect(block.props?.id, `Block of type '${block.type}' must have a stable id`).toBeTruthy();
        }
      });
    });
  }

  it("produces valid Puck data for all templates", () => {
    const ctx = { workspace: { name: "Bare Co" } };
    for (const template of PORTFOLIO_TEMPLATES) {
      const data = template.seedData(ctx);
      expect(portfolioPuckDataSchema.safeParse(data).success).toBe(true);
    }
  });
});

describe("template theme presets", () => {
  it("minimal carries the 'minimal' theme preset", () => {
    const t = getTemplate("minimal")!;
    expect(t.defaultBrandKit.themePreset).toBe("minimal");
  });

  it("bold carries the 'bold' theme preset", () => {
    const t = getTemplate("bold")!;
    expect(t.defaultBrandKit.themePreset).toBe("bold");
  });

  it("luxury carries the 'luxury' theme preset", () => {
    const t = getTemplate("luxury")!;
    expect(t.defaultBrandKit.themePreset).toBe("luxury");
  });

  it("editorial carries the 'editorial' theme preset", () => {
    const t = getTemplate("editorial")!;
    expect(t.defaultBrandKit.themePreset).toBe("editorial");
  });

  it("minimal brand kit exactly matches THEME_PRESET_DEFINITIONS.minimal", () => {
    const t = getTemplate("minimal")!;
    expect(t.defaultBrandKit).toEqual(THEME_PRESET_DEFINITIONS.minimal.brandKit);
  });

  it("bold brand kit exactly matches THEME_PRESET_DEFINITIONS.bold", () => {
    const t = getTemplate("bold")!;
    expect(t.defaultBrandKit).toEqual(THEME_PRESET_DEFINITIONS.bold.brandKit);
  });

  it("luxury brand kit exactly matches THEME_PRESET_DEFINITIONS.luxury", () => {
    const t = getTemplate("luxury")!;
    expect(t.defaultBrandKit).toEqual(THEME_PRESET_DEFINITIONS.luxury.brandKit);
  });

  it("editorial brand kit exactly matches THEME_PRESET_DEFINITIONS.editorial", () => {
    const t = getTemplate("editorial")!;
    expect(t.defaultBrandKit).toEqual(THEME_PRESET_DEFINITIONS.editorial.brandKit);
  });

  it("luxury's plain (non-feature-band) preset sections pin their own background", () => {
    // ServicesPreset/FeaturedWorkPreset have no explicit text color on their
    // children, so they default to the theme foreground — the light pole of the
    // Luxury palette. Without an explicit bgColorToken here they render on an
    // unstyled (white) surface and their default-foreground text is illegible.
    const data = getTemplate("luxury")!.seedData(mockCtx);
    const services = data.home?.content?.find((b) => b.type === "ServicesPreset");
    const featuredWork = data.gallery?.content?.find((b) => b.type === "FeaturedWorkPreset");
    expect((services?.props as { _style?: { bgColorToken?: string } })?._style?.bgColorToken).toBe("background");
    expect((featuredWork?.props as { _style?: { bgColorToken?: string } })?._style?.bgColorToken).toBe("background");
  });

  it("gallery collectionId is absent from all non-scratch templates", () => {
    for (const template of PORTFOLIO_TEMPLATES) {
      if (template.id === "scratch") continue;
      const data = template.seedData({ workspace: { name: "Test" } });
      for (const block of data.gallery?.content ?? []) {
        expect((block.props as Record<string, unknown>).collectionId, `${template.id} gallery block '${block.type}' has collectionId`).toBeFalsy();
      }
    }
  });
});

describe("_blocks factory helpers", () => {
  it("columns() produces a Columns block entry with the given column count", () => {
    const block = columns("c-1", { columns: 3 });
    expect(block.type).toBe("Columns");
    expect(block.props.id).toBe("c-1");
    expect(block.props.columns).toBe(3);
    expect(block.props.content).toEqual([]);
  });
});

describe("getTemplate", () => {
  it("returns a template by id", () => {
    expect(getTemplate("bold")?.id).toBe("bold");
  });
  it("returns null for an unknown id", () => {
    expect(getTemplate("nope")).toBeNull();
  });
});

describe("getTemplateForBusinessType", () => {
  it.each([
    ["photographer", "scratch"],
    ["venue", "scratch"],
    ["stylist", "scratch"],
    ["planner", "scratch"],
    ["catering", "scratch"],
    ["entertainer", "scratch"],
    ["other", "scratch"],
  ])("maps %s → %s", (businessType, expected) => {
    expect(getTemplateForBusinessType(businessType).id).toBe(expected);
  });

  it("falls back to scratch for an unknown businessType", () => {
    expect(getTemplateForBusinessType("spaceship").id).toBe("scratch");
  });

  it("falls back to scratch for null", () => {
    expect(getTemplateForBusinessType(null).id).toBe("scratch");
  });
});
