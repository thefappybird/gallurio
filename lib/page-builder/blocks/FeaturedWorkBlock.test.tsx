/**
 * FeaturedWorkBlock — isomorphic (client-safe) unit tests.
 *
 * These tests mirror GalleryGridBlock.test.tsx: no in-memory Mongo, no server
 * context, just rendering from props with NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME set.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { puckConfig } from "@/lib/page-builder/config";
import { FeaturedWorkBlock, featuredWorkDefaultProps, type FeaturedCollectionRef } from "./FeaturedWorkBlock";

// ---------------------------------------------------------------------------
// Cloudinary env
// ---------------------------------------------------------------------------

beforeEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud";
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
      <FeaturedWorkBlock {...featuredWorkDefaultProps} collections={collections} columns={3} />
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
    expect(imgs[0].src).toContain("test-cloud");
    expect(imgs[0].src).toContain("gallery/cover.jpg");
  });

  it("renders a placeholder when coverPublicId is empty", () => {
    const { container } = render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ coverPublicId: "" })]}
      />
    );
    // No img when publicId is blank (cloudinaryImageUrl returns "")
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
  it("sets repeat(2, 1fr) for columns=2", () => {
    const { container } = render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ id: "c1" }), makeCollection({ id: "c2" })]}
        columns={2}
      />
    );
    const grid = container.querySelector(".pf-featured-grid");
    expect(grid).not.toBeNull();
    expect((grid as HTMLElement).style.gridTemplateColumns).toBe("repeat(2, 1fr)");
  });

  it("sets repeat(4, 1fr) for columns=4", () => {
    const { container } = render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ id: "c1" })]}
        columns={4}
      />
    );
    const grid = container.querySelector(".pf-featured-grid");
    expect((grid as HTMLElement).style.gridTemplateColumns).toBe("repeat(4, 1fr)");
  });
});

describe("FeaturedWorkBlock — client safety", () => {
  it("produces cloudinary URLs using only NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", () => {
    const { container } = render(
      <FeaturedWorkBlock
        {...featuredWorkDefaultProps}
        collections={[makeCollection({ coverPublicId: "some/image.jpg" })]}
      />
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.src).toContain("res.cloudinary.com/test-cloud");
    expect(img!.src).not.toContain("undefined");
  });

  it("renders without crashing when NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is absent", () => {
    const prev = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    try {
      const { container } = render(
        <FeaturedWorkBlock
          {...featuredWorkDefaultProps}
          collections={[makeCollection({ coverPublicId: "some/image.jpg" })]}
        />
      );
      // No img (cloudinaryImageUrl returns "" when no cloud name) → placeholder rendered
      const placeholders = container.querySelectorAll("[data-cover-placeholder]");
      expect(placeholders.length).toBeGreaterThan(0);
    } finally {
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = prev;
    }
  });
});
