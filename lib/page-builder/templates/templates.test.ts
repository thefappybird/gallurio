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
        for (const block of data.gallery?.content ?? []) {
          if (block.type.startsWith("Gallery")) {
            expect(block.props.images).toEqual([]);
            expect(block.props).not.toHaveProperty("collectionId");
            expect(block.props).not.toHaveProperty("maxItems");
          }
        }
      });

      it("has a valid default brand kit", () => {
        expect(brandKitSchema.safeParse(template.defaultBrandKit).success).toBe(true);
      });

      it("has a valid default contact config", () => {
        expect(portfolioContactConfigSchema.safeParse(template.defaultContact).success).toBe(true);
      });

      it("starts the home zone with a HeroPreset block", () => {
        // scratch is an intentionally empty canvas — exempt from this check.
        if (template.id === "scratch") return;
        // Templates use the new preset block model. The first home block is a
        // HeroPreset (a composed Container) — no longer a monolithic 'Hero' block.
        const firstBlock = data.home?.content[0];
        expect(firstBlock?.type).toBe("HeroPreset");
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
      // scratch is an intentionally empty canvas — no first block expected.
      if (template.id === "scratch") continue;
      // The first home block must still be a HeroPreset in all templates.
      expect(data.home?.content[0]?.type).toBe("HeroPreset");
    }
  });
});

describe("template theme presets", () => {
  it("minimal carries the 'minimal' theme preset", () => {
    const t = getTemplate("minimal")!;
    expect(t.defaultBrandKit.themePreset).toBe("minimal");
  });

  it("wedding-photographer carries the 'romantic' theme preset", () => {
    const t = getTemplate("wedding-photographer")!;
    expect(t.defaultBrandKit.themePreset).toBe("romantic");
  });

  it("venue-stylist carries the 'luxury' theme preset", () => {
    const t = getTemplate("venue-stylist")!;
    expect(t.defaultBrandKit.themePreset).toBe("luxury");
  });

  it("event-photographer carries the 'bold' theme preset", () => {
    const t = getTemplate("event-photographer")!;
    expect(t.defaultBrandKit.themePreset).toBe("bold");
  });

  it("planner carries the 'modern' theme preset", () => {
    const t = getTemplate("planner")!;
    expect(t.defaultBrandKit.themePreset).toBe("modern");
  });

  it("minimal brand kit exactly matches THEME_PRESET_DEFINITIONS.minimal", () => {
    const t = getTemplate("minimal")!;
    expect(t.defaultBrandKit).toEqual(THEME_PRESET_DEFINITIONS.minimal.brandKit);
  });

  it("event-photographer brand kit exactly matches THEME_PRESET_DEFINITIONS.bold", () => {
    const t = getTemplate("event-photographer")!;
    expect(t.defaultBrandKit).toEqual(THEME_PRESET_DEFINITIONS.bold.brandKit);
  });

  it("planner brand kit exactly matches THEME_PRESET_DEFINITIONS.modern", () => {
    const t = getTemplate("planner")!;
    expect(t.defaultBrandKit).toEqual(THEME_PRESET_DEFINITIONS.modern.brandKit);
  });

  it("venue-stylist brand kit exactly matches THEME_PRESET_DEFINITIONS.luxury", () => {
    const t = getTemplate("venue-stylist")!;
    expect(t.defaultBrandKit).toEqual(THEME_PRESET_DEFINITIONS.luxury.brandKit);
  });

  it("wedding-photographer brand kit exactly matches THEME_PRESET_DEFINITIONS.romantic", () => {
    const t = getTemplate("wedding-photographer")!;
    expect(t.defaultBrandKit).toEqual(THEME_PRESET_DEFINITIONS.romantic.brandKit);
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
    expect(getTemplate("planner")?.id).toBe("planner");
  });
  it("returns null for an unknown id", () => {
    expect(getTemplate("nope")).toBeNull();
  });
});

describe("getTemplateForBusinessType", () => {
  it.each([
    ["photographer", "wedding-photographer"],
    ["venue", "venue-stylist"],
    ["stylist", "venue-stylist"],
    ["planner", "planner"],
    ["catering", "planner"],
    ["entertainer", "event-photographer"],
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
