/**
 * Integration tests: verifies that all registered blocks are correctly
 * registered in puckConfig and render without errors given fixture props.
 *
 * Two concerns are tested separately:
 *
 * 1. **Registry shape** — each block name is present in puckConfig.components
 *    and has a render function + defaultProps + ≥1 field. Ensures the editor
 *    and public renderer can find every block.
 *
 * 2. **Render output** — sync blocks (Heading, HeroPreset, ServicesPreset) are
 *    rendered via Puck's <Render> component with fixture-shaped data and
 *    assertions are made on the DOM. Async data blocks (GalleryGrid etc.) are
 *    covered by their own dedicated test files.
 *
 * Note: Puck's <Render> resolves slot components synchronously when the
 * data is plain JSON (no async DB calls). Preset blocks are Container-based
 * compositions whose `content` slots are pre-filled with child block entries —
 * Puck renders those synchronously in the happy-dom environment.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Render } from "@measured/puck";
import React from "react";
import { puckConfig } from "./config";
import { homeDataFixture, FIXTURE_HEADING_TEXT, FIXTURE_HERO_HEADLINE } from "./__fixtures__/homeData";
import { HERO_PRESET, SERVICES_PRESET } from "./blocks/sectionPresets";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: vi.fn(
    (publicId: string) => `https://res.cloudinary.com/test/image/upload/${publicId}`
  ),
}));

// ---------------------------------------------------------------------------
// 1. Registry shape checks
// ---------------------------------------------------------------------------

describe("puckConfig — registry shape", () => {
  it("has all preset blocks registered", () => {
    const names = Object.keys(puckConfig.components);
    expect(names).toContain("HeroPreset");
    expect(names).toContain("AboutPreset");
    expect(names).toContain("ServicesPreset");
    expect(names).toContain("CtaPreset");
    expect(names).toContain("ContactPreset");
  });

  it("has all data blocks registered", () => {
    const names = Object.keys(puckConfig.components);
    expect(names).toContain("GalleryGrid");
    expect(names).toContain("GalleryMasonry");
    expect(names).toContain("GalleryCarousel");
    expect(names).toContain("FeaturedWork");
    expect(names).toContain("Video");
    expect(names).toContain("ContactDetails");
  });

  it("has all manual primitive blocks registered", () => {
    const names = Object.keys(puckConfig.components);
    expect(names).toContain("Heading");
    expect(names).toContain("Text");
    expect(names).toContain("Image");
    expect(names).toContain("Button");
    expect(names).toContain("Spacer");
    expect(names).toContain("Divider");
    expect(names).toContain("Columns");
    expect(names).toContain("Container");
  });

  it("does NOT contain deleted blocks", () => {
    const names = Object.keys(puckConfig.components);
    expect(names).not.toContain("Hero");
    expect(names).not.toContain("About");
    expect(names).not.toContain("ServicesList");
    expect(names).not.toContain("CTABanner");
    expect(names).not.toContain("ContactCard");
  });

  it("each registered block has a render function", () => {
    for (const [name, block] of Object.entries(puckConfig.components)) {
      expect(typeof block.render, `${name}.render must be a function`).toBe("function");
    }
  });

  it("each registered block has defaultProps", () => {
    for (const [name, block] of Object.entries(puckConfig.components)) {
      expect(block.defaultProps, `${name} must have defaultProps`).toBeDefined();
    }
  });

  it("each registered block has at least one field definition", () => {
    for (const [name, block] of Object.entries(puckConfig.components)) {
      const fieldCount = Object.keys(block.fields ?? {}).length;
      expect(fieldCount, `${name} must have at least one field`).toBeGreaterThan(0);
    }
  });

  it("every block type used in homeDataFixture is registered", () => {
    const registeredNames = new Set(Object.keys(puckConfig.components));
    for (const block of homeDataFixture.content) {
      expect(registeredNames.has(block.type), `Fixture references unregistered block '${block.type}'`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Sync block render checks via Puck <Render>
// ---------------------------------------------------------------------------

describe("blockShapes integration — Heading renders from fixture", () => {
  it("renders without crashing via Puck <Render>", () => {
    const headingEntry = homeDataFixture.content.find((b) => b.type === "Heading")!;
    expect(() =>
      render(
        React.createElement(Render, {
          config: puckConfig,
          data: { root: {}, content: [headingEntry] },
        })
      )
    ).not.toThrow();
  });

  it("renders FIXTURE_HEADING_TEXT text via Puck", () => {
    const headingEntry = homeDataFixture.content.find((b) => b.type === "Heading")!;
    render(
      <Render
        config={puckConfig}
        data={{ root: {}, content: [headingEntry] }}
      />
    );
    expect(screen.getByText(FIXTURE_HEADING_TEXT)).toBeTruthy();
  });
});

describe("blockShapes integration — HeroPreset renders composed children", () => {
  it("renders without crashing via Puck <Render>", () => {
    expect(() =>
      render(
        <Render
          config={puckConfig}
          data={{ root: {}, content: [{ type: "HeroPreset", props: { id: "hero-1", ...HERO_PRESET } }] }}
        />
      )
    ).not.toThrow();
  });

  it("renders FIXTURE_HERO_HEADLINE text", () => {
    render(
      <Render
        config={puckConfig}
        data={{ root: {}, content: [{ type: "HeroPreset", props: { id: "hero-1", ...HERO_PRESET } }] }}
      />
    );
    expect(screen.getByText(FIXTURE_HERO_HEADLINE)).toBeTruthy();
  });

  it("renders the CTA button text", () => {
    render(
      <Render
        config={puckConfig}
        data={{ root: {}, content: [{ type: "HeroPreset", props: { id: "hero-1", ...HERO_PRESET } }] }}
      />
    );
    expect(screen.getByText("Get in Touch")).toBeTruthy();
  });

  it("renders the section element (Container data-block attribute)", () => {
    const { container } = render(
      <Render
        config={puckConfig}
        data={{ root: {}, content: [{ type: "HeroPreset", props: { id: "hero-1", ...HERO_PRESET } }] }}
      />
    );
    expect(container.querySelector("[data-block='container']")).not.toBeNull();
  });
});

describe("blockShapes integration — GalleryGrid registered (async; see GalleryGridBlock.test.tsx)", () => {
  it("GalleryGrid render function is defined in puckConfig", () => {
    expect(typeof puckConfig.components.GalleryGrid.render).toBe("function");
  });

  it("GalleryGrid defaultProps has collectionId field", () => {
    expect(puckConfig.components.GalleryGrid.defaultProps).toHaveProperty("collectionId");
  });
});

describe("blockShapes integration — ServicesPreset renders nested Columns", () => {
  it("renders without crashing via Puck <Render>", () => {
    expect(() =>
      render(
        <Render
          config={puckConfig}
          data={{ root: {}, content: [{ type: "ServicesPreset", props: { id: "svc-1", ...SERVICES_PRESET } }] }}
        />
      )
    ).not.toThrow();
  });

  it("renders service category names", () => {
    render(
      <Render
        config={puckConfig}
        data={{ root: {}, content: [{ type: "ServicesPreset", props: { id: "svc-1", ...SERVICES_PRESET } }] }}
      />
    );
    expect(screen.getByText("Wedding Photography")).toBeTruthy();
    expect(screen.getByText("Portrait Sessions")).toBeTruthy();
  });

  it("renders pricing text", () => {
    render(
      <Render
        config={puckConfig}
        data={{ root: {}, content: [{ type: "ServicesPreset", props: { id: "svc-1", ...SERVICES_PRESET } }] }}
      />
    );
    expect(screen.getByText(/From ₱30,000/)).toBeTruthy();
  });
});
