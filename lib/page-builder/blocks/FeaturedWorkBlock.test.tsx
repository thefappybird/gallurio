/**
 * FeaturedWorkBlock — isomorphic (client-safe) unit tests.
 *
 * These tests mirror GalleryGridBlock.test.tsx: no in-memory Mongo, no server
 * context, just rendering from props with NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH set.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { puckConfig } from "@/lib/page-builder/config";
import { FeaturedWorkBlock, featuredWorkDefaultProps, type FeaturedCollectionRef } from "./FeaturedWorkBlock";
import type { GalleryImage } from "./GalleryGridBlock";

// ---------------------------------------------------------------------------
// CF Images env
// ---------------------------------------------------------------------------

beforeEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash";
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCollection(overrides: Partial<FeaturedCollectionRef> = {}): FeaturedCollectionRef {
  return {
    id: "col-1",
    name: "Weddings",
    coverPublicId: "gallurio/weddings/cover.jpg",
    itemCount: 12,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

it("is registered in puckConfig", () => {
  expect(puckConfig.components.FeaturedWork).toBeDefined();
});

it("FeaturedWorkBlock is NOT a Promise (sync render)", () => {
  const result = FeaturedWorkBlock({ ...featuredWorkDefaultProps });
  // A sync component returns a React element, not a Promise
  expect(result).not.toBeInstanceOf(Promise);
  expect(result).not.toBeNull();
});

describe("FeaturedWorkBlock — empty state", () => {
  it("renders data-empty=true with empty collections", () => {
    const { container } = render(
      <FeaturedWorkBlock {...featuredWorkDefaultProps} collections={[]} />
    );
    const section = container.querySelector("[data-block='featured-work']");
    expect(section).not.toBeNull();
    expect(section!.getAttribute("data-empty")).toBe("true");
  });

  it("renders the empty label (English default)", () => {
    render(<FeaturedWorkBlock {...featuredWorkDefaultProps} collections={[]} />);
    expect(screen.getByText(/no featured photos selected yet/i)).toBeTruthy();
  });
});

describe("FeaturedWorkBlock — tiles render", () => {
  it("renders one tile per collection", () => {
    const collections = [
      makeCollection({ id: "c1", name: "Weddings", itemCount: 5, coverPublicId: "w/cover.jpg" }),
      makeCollection({ id: "c2", name: "Portraits", itemCount: 3, coverPublicId: "p/cover.jpg" }),
    ];
    const { container } = render(
      <FeaturedWorkBlock {...featuredWorkDefaultProps} collections={collections} />
    );
    // 2 tile buttons rendered
    const tiles = container.querySelectorAll("[data-featured-tile]");
    expect(tiles).toHaveLength(2);
  });

  it("renders collection names", () => {
    const collections = [
      makeCollection({ id: "c1", name: "Weddings", itemCount: 2 }),
      makeCollection({ id: "c2", name: "Portraits", itemCount: 1 }),
    ];
    render(
      <FeaturedWorkBlock {...featuredWorkDefaultProps} collections={collections} />
    );
    expect(screen.getByText("Weddings")).toBeTruthy();
    expect(screen.getByText("Portraits")).toBeTruthy();
  });

  it("renders pluralized count text — 1 photo", () => {
    render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ itemCount: 1 })]}
      />
    );
    expect(screen.getByText("1 photo")).toBeTruthy();
  });

  it("renders pluralized count text — 0 photos", () => {
    render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ itemCount: 0 })]}
      />
    );
    expect(screen.getByText("No photos")).toBeTruthy();
  });

  it("renders pluralized count text — many photos", () => {
    render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ itemCount: 12 })]}
      />
    );
    expect(screen.getByText("12 photos")).toBeTruthy();
  });

  it("renders cover image for a collection with coverPublicId", () => {
    const { container } = render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ coverPublicId: "gallery/cover.jpg" })]}
      />
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs[0].src).toContain("imagedelivery.net");
    expect(imgs[0].src).toContain("gallery/cover.jpg");
  });

  it("renders a placeholder when coverPublicId is empty", () => {
    const { container } = render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ coverPublicId: "" })]}
      />
    );
    // No img when publicId is blank (imageDeliveryUrl returns "")
    const placeholders = container.querySelectorAll("[data-cover-placeholder]");
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it("section has no data-empty when collections are present", () => {
    const { container } = render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection()]}
      />
    );
    const section = container.querySelector("[data-block='featured-work']");
    expect(section!.getAttribute("data-empty")).toBeNull();
  });
});

describe("FeaturedWorkBlock — columns", () => {
  it("sets responsive gridColsVar for _style.galleryColumns=2", () => {
    const { container } = render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ id: "c1" }), makeCollection({ id: "c2" })]}
        _style={{ galleryColumns: 2 }}
      />
    );
    const grid = container.querySelector(".pf-featured-grid");
    expect(grid).not.toBeNull();
    expect((grid as HTMLElement).style.gridTemplateColumns).toBe("var(--pf-grid-cols, repeat(2, 1fr))");
  });

  it("sets responsive gridColsVar for _style.galleryColumns=4", () => {
    const { container } = render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ id: "c1" })]}
        _style={{ galleryColumns: 4 }}
      />
    );
    const grid = container.querySelector(".pf-featured-grid");
    expect((grid as HTMLElement).style.gridTemplateColumns).toBe("var(--pf-grid-cols, repeat(4, 1fr))");
  });

  it("defaults to 3 columns when _style.galleryColumns is unset", () => {
    const { container } = render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ id: "c1" })]}
      />
    );
    const grid = container.querySelector(".pf-featured-grid");
    expect((grid as HTMLElement).style.gridTemplateColumns).toBe("var(--pf-grid-cols, repeat(3, 1fr))");
  });
});

describe("FeaturedWorkBlock — client safety", () => {
  it("produces CF Images URLs using NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH", () => {
    const { container } = render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ coverPublicId: "some/image.jpg" })]}
      />
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.src).toContain("imagedelivery.net/test-hash");
    expect(img!.src).not.toContain("undefined");
  });

  it("renders without crashing when NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH is absent", () => {
    const prev = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
    delete process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
    try {
      const { container } = render(
        <FeaturedWorkBlock
          {...featuredWorkDefaultProps}
          collections={[makeCollection({ coverPublicId: "some/image.jpg" })]}
        />
      );
      // No img (imageDeliveryUrl returns "" when account hash unset) → placeholder rendered
      const placeholders = container.querySelectorAll("[data-cover-placeholder]");
      expect(placeholders.length).toBeGreaterThan(0);
    } finally {
      process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = prev;
    }
  });
});

describe("FeaturedWorkBlock — defaultProps", () => {
  it("featuredWorkDefaultProps has minHeight === 'medium'", () => {
    expect(featuredWorkDefaultProps.minHeight).toBe("medium");
  });
});

describe("FeaturedWorkBlock — brand vars reach the popup (portal fix)", () => {
  it("threads puck.metadata.workspace.brandVars onto the opened popup's portaled shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], nextCursor: null }),
        })
      )
    );

    render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection()]}
        puck={{
          metadata: {
            workspace: {
              _id: "ws1",
              name: "Studio",
              slug: "studio",
              publicPage: { collectionsPopup: {} },
              brandVars: { "--pf-color-bg": "#ff00aa" },
            },
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Weddings/i }));

    const shell = await screen.findByRole("heading", { level: 2 }).then((h) => h.closest("[data-popup-shell]"));
    expect(shell).not.toBeNull();
    expect((shell as HTMLElement).style.getPropertyValue("--pf-color-bg")).toBe("#ff00aa");

    vi.unstubAllGlobals();
  });
});

describe("FeaturedWorkBlock — banner/container props", () => {
  it("renders a background image when backgroundImages has one entry", () => {
    const bgImages: GalleryImage[] = [{ id: "bg1", publicId: "bg-pid1" }];
    const { container } = render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection()]}
        backgroundImages={bgImages}
      />
    );
    const bgImg = container.querySelector("img[aria-hidden='true']");
    expect(bgImg).toBeTruthy();
    expect(bgImg?.getAttribute("src")).toContain("bg-pid1");
  });
});
