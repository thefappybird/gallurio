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
import { columns, navigationBlock } from "./_blocks";
import { collectBlocks } from "@/lib/page-builder/blockTree";

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
        // scratch's canvas is otherwise empty, but it still seeds the pinned
        // Navigation block — no template opens header-less anymore.
        expect(data.home?.content.length ?? 0).toBeGreaterThan(0);
        expect(data.gallery?.content.length ?? 0).toBeGreaterThan(0);
      });

      it("seeds the pinned Navigation's brand Heading with the real workspace name in both zones", () => {
        for (const zone of [data.home, data.gallery]) {
          const nav = zone?.content.find(
            (b) => (b.props as { _chrome?: string })._chrome === "nav"
          ) as { props: { content?: unknown[] } } | undefined;
          expect(nav, `Template '${template.id}' has no pinned Navigation block`).toBeDefined();
          const heading = nav?.props.content?.find(
            (c) => (c as { type?: string }).type === "Heading"
          ) as { props?: { text?: string } } | undefined;
          expect(heading?.props?.text).toBe("Studio Aurora");
        }
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
        // carry images[]. The type check excludes the *Preset suffix. Data blocks
        // may live nested inside a PageBody/preset's content slot, not just at
        // the zone's top level, so this walks recursively. An omitted `images`
        // key is equivalent to `[]` here — fillBlockDefaults re-injects the
        // block's own default ([]) on apply.
        const GALLERY_DATA_TYPES = new Set(["GalleryGrid", "GalleryMasonry", "GalleryCarousel"]);
        function walk(blocks: { type: string; props: Record<string, unknown> }[]) {
          for (const block of blocks) {
            if (GALLERY_DATA_TYPES.has(block.type)) {
              expect(block.props.images ?? []).toEqual([]);
              expect(block.props).not.toHaveProperty("collectionId");
            }
            if (Array.isArray(block.props.content)) {
              walk(block.props.content as typeof blocks);
            }
          }
        }
        walk(data.gallery?.content ?? []);
      });

      it("has a valid default brand kit", () => {
        expect(brandKitSchema.safeParse(template.defaultBrandKit).success).toBe(true);
      });

      it("has a valid default contact config", () => {
        expect(portfolioContactConfigSchema.safeParse(template.defaultContact).success).toBe(true);
      });

      it("seeds a Navigation block first in both zones, carrying _chrome: 'nav'", () => {
        for (const zoneData of [data.home, data.gallery]) {
          const first = zoneData?.content[0];
          expect(first?.type, `${template.id}: first block must be Navigation`).toBe("Navigation");
          expect((first?.props as { _chrome?: string })._chrome).toBe("nav");
        }
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
        // Type-agnostic on purpose: any block carrying both tokens (container or
        // preset, current or future naming) must keep them distinct for legibility.
        function walk(blocks: { type: string; props?: Record<string, unknown> }[]) {
          for (const block of blocks) {
            const style = block.props?._style as
              | { bgColorToken?: string; textColorToken?: string }
              | undefined;
            if (style?.bgColorToken && style?.textColorToken) {
              expect(
                style.textColorToken,
                `${template.id} ${block.type} ${block.props?.id}: container text must remain legible`,
              ).not.toBe(style.bgColorToken);
            }
            if (Array.isArray(block.props?.content)) {
              walk(block.props.content as typeof blocks);
            }
          }
        }
        walk([...(data.home?.content ?? []), ...(data.gallery?.content ?? [])]);
      });

      it("follows the pinned Navigation with a PageBody, HeroPreset, or Columns block", () => {
        // scratch is an intentionally empty canvas (Navigation only) — exempt.
        if (template.id === "scratch") return;
        const secondBlock = data.home?.content[1];
        // Current templates wrap their sections in a single PageBody container;
        // legacy shapes (Columns mosaic embedding HeroPreset, or a bare HeroPreset)
        // stay accepted so this doesn't churn on the next content-model change.
        expect(["PageBody", "HeroPreset", "Columns"], `Expected second home block to be PageBody, HeroPreset, or Columns, got '${secondBlock?.type}'`)
          .toContain(secondBlock?.type);
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

  it("normalizes stale Directory footer copies to a full shell with page-fit direct children", () => {
    for (const template of PORTFOLIO_TEMPLATES) {
      const data = template.seedData(mockCtx);
      const footer = [
        ...(data.home ? collectBlocks(data.home) : []),
        ...(data.gallery ? collectBlocks(data.gallery) : []),
      ].find((block) => block.type === "FooterDirectoryPreset");
      if (!footer) continue;

      const content = footer.props.content as Array<{ type: string; props: Record<string, unknown> }>;
      expect(footer.props.overallWidth, `${template.id} footer outer width`).toBe("full");
      expect(content.map((block) => block.type)).toEqual(["Divider", "Container", "Divider", "Container"]);
      expect(content[1]?.props.overallWidth).toBe("page-fit");
      const columns = content[1]?.props.content as Array<{ type: string; props: Record<string, unknown> }>;
      expect(columns[0]?.type).toBe("Columns");
      expect(columns[0]?.props.overallWidth, template.id).toBe("full");
      expect(content[3]?.props.overallWidth).toBe("page-fit");
    }
  });

  it("normalizes Luxury's stale Lead collections copy to the current full/page-fit shell", () => {
    const luxury = getTemplate("luxury")!;
    const data = luxury.seedData(mockCtx);
    const lead = [
      ...(data.home ? collectBlocks(data.home) : []),
      ...(data.gallery ? collectBlocks(data.gallery) : []),
    ].find((block) => block.type === "FeaturedWorkLeadPreset");
    expect(lead).toBeDefined();
    const content = lead!.props.content as Array<{ type: string; props: Record<string, unknown> }>;
    expect(lead!.props.overallWidth).toBe("full");
    expect(content).toHaveLength(2);
    const [band, columnsShell] = content;
    expect(band.type).toBe("Container");
    expect(band.props.overallWidth).toBe("full");
    expect((band.props._style as Record<string, unknown>).bgColorToken).toBe("accent");
    const bandInner = (band.props.content as Array<{ type: string; props: Record<string, unknown> }>)[0];
    expect(bandInner.type).toBe("Container");
    expect(bandInner.props.overallWidth).toBe("page-fit");
    expect(columnsShell.type).toBe("Container");
    expect(columnsShell.props.overallWidth).toBe("page-fit");
    const cards = columnsShell.props.content as Array<{ type: string; props: Record<string, unknown> }>;
    expect(cards[0]?.type).toBe("Columns");
    expect(cards[0]?.props.overallWidth).toBe("full");
  });
});

describe("template theme presets", () => {
  it("minimal carries the 'minimal' theme preset", () => {
    const t = getTemplate("minimal")!;
    expect(t.defaultBrandKit.themePreset).toBe("minimal");
  });

  it("romantic carries the 'romantic' theme preset", () => {
    const t = getTemplate("romantic")!;
    expect(t.defaultBrandKit.themePreset).toBe("romantic");
  });

  it("modern carries the 'modern' theme preset", () => {
    const t = getTemplate("modern")!;
    expect(t.defaultBrandKit.themePreset).toBe("modern");
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

  it("romantic brand kit exactly matches THEME_PRESET_DEFINITIONS.romantic", () => {
    const t = getTemplate("romantic")!;
    expect(t.defaultBrandKit).toEqual(THEME_PRESET_DEFINITIONS.romantic.brandKit);
  });

  it("modern brand kit exactly matches THEME_PRESET_DEFINITIONS.modern", () => {
    const t = getTemplate("modern")!;
    expect(t.defaultBrandKit).toEqual(THEME_PRESET_DEFINITIONS.modern.brandKit);
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
    function walk(blocks: { type: string; props?: Record<string, unknown> }[], templateId: string) {
      for (const block of blocks) {
        expect(
          (block.props as Record<string, unknown> | undefined)?.collectionId,
          `${templateId} gallery block '${block.type}' has collectionId`,
        ).toBeFalsy();
        if (Array.isArray(block.props?.content)) {
          walk(block.props.content as typeof blocks, templateId);
        }
      }
    }
    for (const template of PORTFOLIO_TEMPLATES) {
      if (template.id === "scratch") continue;
      const data = template.seedData({ workspace: { name: "Test" } });
      walk(data.gallery?.content ?? [], template.id);
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

  it("navigationBlock() produces a Navigation block entry with defaults + _chrome + the given id", () => {
    const block = navigationBlock("nav-1");
    expect(block.type).toBe("Navigation");
    expect(block.props.id).toBe("nav-1");
    expect(block.props._chrome).toBe("nav");
    expect(block.props.highlightOpacity).toBe(100);
    expect(block.props.content).toBeDefined();
  });

  it("navigationBlock() overrides config fields while keeping the id + _chrome", () => {
    const block = navigationBlock("nav-2", { fontSize: "sm", contactButtonColor: "accent" });
    expect(block.props.id).toBe("nav-2");
    expect(block.props._chrome).toBe("nav");
    expect(block.props.fontSize).toBe("sm");
    expect(block.props.contactButtonColor).toBe("accent");
  });

  it("navigationBlock() seeds the content Heading from the given workspace name", () => {
    const block = navigationBlock("nav-3", {}, "Studio Aurora");
    expect(block.props.content).toEqual([
      { type: "Heading", props: { level: "h3", text: "Studio Aurora" } },
    ]);
  });
});

describe("getTemplate", () => {
  it("returns a template by id", () => {
    expect(getTemplate("minimal")?.id).toBe("minimal");
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
