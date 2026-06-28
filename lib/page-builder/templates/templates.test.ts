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
    ["photographer", "editorial"],
    ["venue", "luxury"],
    ["stylist", "luxury"],
    ["planner", "editorial"],
    ["catering", "editorial"],
    ["entertainer", "bold"],
    ["other", "minimal"],
  ])("maps %s → %s", (businessType, expected) => {
    expect(getTemplateForBusinessType(businessType).id).toBe(expected);
  });

  it("falls back to minimal for an unknown businessType", () => {
    expect(getTemplateForBusinessType("spaceship").id).toBe("minimal");
  });

  it("falls back to minimal for null", () => {
    expect(getTemplateForBusinessType(null).id).toBe("minimal");
  });
});
