/**
 * Integration tests: verifies that all six Phase 3 blocks are correctly
 * registered in puckConfig and render without errors given fixture props.
 *
 * Two concerns are tested separately:
 *
 * 1. **Registry shape** — each block name is present in puckConfig.components
 *    and has a render function + defaultProps. This ensures the editor and
 *    public renderer can find every block.
 *
 * 2. **Render output** — synchronous blocks (Hero, About, ServicesList,
 *    CTABanner, ContactCard) are rendered directly with fixture props and
 *    assertions are made on the DOM. GalleryGridBlock is async (DB query) and
 *    is covered by its own dedicated test file (GalleryGridBlock.test.tsx).
 *
 * Note: Puck's <Render> component uses React hooks and in Vitest+happy-dom
 * the content area rendered by DropZoneRender is only populated when React
 * resolves async components. Since GalleryGridBlock is async, we avoid routing
 * through Puck's Render wrapper in these integration tests and instead render
 * each sync block directly — which is what the public renderer does at the
 * component level anyway. The registry check guarantees Puck wiring is correct.
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { puckConfig } from "./config";
import { homeDataFixture } from "./__fixtures__/homeData";
import { runWithRenderWorkspace } from "./serverContext";
import { HeroBlock } from "./blocks/HeroBlock";
import { AboutBlock } from "./blocks/AboutBlock";
import { ServicesListBlock } from "./blocks/ServicesListBlock";
import { CTABannerBlock } from "./blocks/CTABannerBlock";
import { ContactCardBlock } from "./blocks/ContactCardBlock";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: vi.fn(
    (publicId: string) => `https://res.cloudinary.com/test/image/upload/${publicId}`
  ),
}));

// ---------------------------------------------------------------------------
// Fixture workspace context (used by ContactCardBlock tests)
// ---------------------------------------------------------------------------

const fixtureWorkspace = {
  _id: "fixture-workspace-001",
  name: "Fixture Studio",
  branding: {
    tagline: "Test tagline",
  },
  contact: {
    email: "test@fixture.com",
    phone: "+63 900 000 0000",
    address: "Test City",
    socials: {
      instagram: "fixture_ig",
    },
  },
};

// Extract fixture props per block type
function getFixtureProps(type: string) {
  const entry = homeDataFixture.content.find((b) => b.type === type);
  if (!entry) throw new Error(`No fixture entry for block type '${type}'`);
  return entry.props;
}

// ---------------------------------------------------------------------------
// 1. Registry shape checks
// ---------------------------------------------------------------------------

describe("puckConfig — registry shape", () => {
  it("has all six Phase 3 blocks registered", () => {
    const names = Object.keys(puckConfig.components);
    expect(names).toContain("Hero");
    expect(names).toContain("About");
    expect(names).toContain("GalleryGrid");
    expect(names).toContain("ServicesList");
    expect(names).toContain("CTABanner");
    expect(names).toContain("ContactCard");
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
    // The fixture is a realistic sample home page; it need not exercise every
    // optional primitive (Video, manual blocks have their own test files). What
    // matters is that the fixture never references an unregistered/renamed block.
    const registeredNames = new Set(Object.keys(puckConfig.components));
    for (const block of homeDataFixture.content) {
      expect(registeredNames.has(block.type), `Fixture references unregistered block '${block.type}'`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Sync block render checks
// ---------------------------------------------------------------------------

describe("blockShapes integration — HeroBlock renders from fixture", () => {
  it("renders without crashing", () => {
    const props = getFixtureProps("Hero") as Parameters<typeof HeroBlock>[0];
    expect(() => render(React.createElement(HeroBlock, props))).not.toThrow();
  });

  it("renders data-block=hero marker", () => {
    const props = getFixtureProps("Hero") as Parameters<typeof HeroBlock>[0];
    const { container } = render(React.createElement(HeroBlock, props));
    expect(container.querySelector("[data-block='hero']")).not.toBeNull();
  });

  it("renders FIXTURE_HERO_HEADLINE text", () => {
    const props = getFixtureProps("Hero") as Parameters<typeof HeroBlock>[0];
    const { container } = render(React.createElement(HeroBlock, props));
    expect(container.textContent).toContain("FIXTURE_HERO_HEADLINE");
  });
});

describe("blockShapes integration — AboutBlock renders from fixture", () => {
  it("renders without crashing", () => {
    const props = getFixtureProps("About") as Parameters<typeof AboutBlock>[0];
    expect(() => render(React.createElement(AboutBlock, props))).not.toThrow();
  });

  it("renders data-block=about marker", () => {
    const props = getFixtureProps("About") as Parameters<typeof AboutBlock>[0];
    const { container } = render(React.createElement(AboutBlock, props));
    expect(container.querySelector("[data-block='about']")).not.toBeNull();
  });

  it("renders FIXTURE_ABOUT_HEADING text", () => {
    const props = getFixtureProps("About") as Parameters<typeof AboutBlock>[0];
    const { container } = render(React.createElement(AboutBlock, props));
    expect(container.textContent).toContain("FIXTURE_ABOUT_HEADING");
  });
});

describe("blockShapes integration — GalleryGridBlock registered (async; see GalleryGridBlock.test.tsx)", () => {
  it("GalleryGrid render function is defined in puckConfig", () => {
    expect(typeof puckConfig.components.GalleryGrid.render).toBe("function");
  });

  it("GalleryGrid defaultProps has collectionId field", () => {
    expect(puckConfig.components.GalleryGrid.defaultProps).toHaveProperty("collectionId");
  });
});

describe("blockShapes integration — ServicesListBlock renders from fixture", () => {
  it("renders without crashing", () => {
    const props = getFixtureProps("ServicesList") as Parameters<typeof ServicesListBlock>[0];
    expect(() => render(React.createElement(ServicesListBlock, props))).not.toThrow();
  });

  it("renders data-block=services-list marker", () => {
    const props = getFixtureProps("ServicesList") as Parameters<typeof ServicesListBlock>[0];
    const { container } = render(React.createElement(ServicesListBlock, props));
    expect(container.querySelector("[data-block='services-list']")).not.toBeNull();
  });

  it("renders FIXTURE_SERVICES_HEADING text", () => {
    const props = getFixtureProps("ServicesList") as Parameters<typeof ServicesListBlock>[0];
    const { container } = render(React.createElement(ServicesListBlock, props));
    expect(container.textContent).toContain("FIXTURE_SERVICES_HEADING");
  });
});

describe("blockShapes integration — CTABannerBlock renders from fixture", () => {
  it("renders without crashing", () => {
    const props = getFixtureProps("CTABanner") as Parameters<typeof CTABannerBlock>[0];
    expect(() => render(React.createElement(CTABannerBlock, props))).not.toThrow();
  });

  it("renders data-block=cta-banner marker", () => {
    const props = getFixtureProps("CTABanner") as Parameters<typeof CTABannerBlock>[0];
    const { container } = render(React.createElement(CTABannerBlock, props));
    expect(container.querySelector("[data-block='cta-banner']")).not.toBeNull();
  });

  it("renders FIXTURE_CTA_HEADLINE text", () => {
    const props = getFixtureProps("CTABanner") as Parameters<typeof CTABannerBlock>[0];
    const { container } = render(React.createElement(CTABannerBlock, props));
    expect(container.textContent).toContain("FIXTURE_CTA_HEADLINE");
  });
});

describe("blockShapes integration — ContactCardBlock renders from fixture", () => {
  it("renders without crashing", () => {
    const props = getFixtureProps("ContactCard") as Parameters<typeof ContactCardBlock>[0];
    expect(() =>
      runWithRenderWorkspace(fixtureWorkspace, () =>
        render(React.createElement(ContactCardBlock, props))
      )
    ).not.toThrow();
  });

  it("renders data-block=contact-card marker", () => {
    const props = getFixtureProps("ContactCard") as Parameters<typeof ContactCardBlock>[0];
    const { container } = runWithRenderWorkspace(fixtureWorkspace, () =>
      render(React.createElement(ContactCardBlock, props))
    );
    expect(container.querySelector("[data-block='contact-card']")).not.toBeNull();
  });

  it("renders FIXTURE_CONTACT_HEADING text", () => {
    const props = getFixtureProps("ContactCard") as Parameters<typeof ContactCardBlock>[0];
    const { container } = runWithRenderWorkspace(fixtureWorkspace, () =>
      render(React.createElement(ContactCardBlock, props))
    );
    expect(container.textContent).toContain("FIXTURE_CONTACT_HEADING");
  });
});
