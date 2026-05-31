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

const REGISTERED_BLOCKS = new Set(Object.keys(puckConfig.components));

const mockCtx = {
  workspace: {
    name: "Studio Aurora",
    branding: { tagline: "Light & shadow", description: "We chase good light." },
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
        expect(data.home?.content.length ?? 0).toBeGreaterThan(0);
        expect(data.gallery?.content.length ?? 0).toBeGreaterThan(0);
      });

      it("only references blocks that exist in the Puck registry", () => {
        const allBlocks = [
          ...(data.home?.content ?? []),
          ...(data.gallery?.content ?? []),
        ];
        for (const block of allBlocks) {
          expect(REGISTERED_BLOCKS.has(block.type)).toBe(true);
        }
      });

      it("seeds gallery blocks with an empty collectionId (filled at save time)", () => {
        for (const block of data.gallery?.content ?? []) {
          if (block.type.startsWith("Gallery")) {
            expect(block.props.collectionId).toBe("");
          }
        }
      });

      it("has a valid default brand kit", () => {
        expect(brandKitSchema.safeParse(template.defaultBrandKit).success).toBe(true);
      });

      it("has a valid default contact config", () => {
        expect(portfolioContactConfigSchema.safeParse(template.defaultContact).success).toBe(true);
      });

      it("personalizes the hero headline with the workspace name", () => {
        const hero = data.home?.content.find((b) => b.type === "Hero");
        expect(hero?.props.headline).toBe("Studio Aurora");
      });
    });
  }

  it("falls back to workspace name + sensible copy when branding is missing", () => {
    const bare = { workspace: { name: "Bare Co" } };
    for (const template of PORTFOLIO_TEMPLATES) {
      const data = template.seedData(bare);
      expect(portfolioPuckDataSchema.safeParse(data).success).toBe(true);
      const hero = data.home?.content.find((b) => b.type === "Hero");
      expect(hero?.props.headline).toBe("Bare Co");
    }
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
