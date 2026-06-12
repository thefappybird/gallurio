import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryGridBlock, galleryGridDefaultProps } from "./GalleryGridBlock";
import type { GalleryGridProps, GalleryImage } from "./GalleryGridBlock";
import { puckConfig } from "@/lib/page-builder/config";

const OLD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
beforeEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = OLD;
});

function imgs(n: number): GalleryImage[] {
  return Array.from({ length: n }, (_, i) => ({ id: `id${i}`, publicId: `pid${i}`, alt: `Alt ${i}` }));
}

const base: GalleryGridProps = { ...galleryGridDefaultProps };

describe("GalleryGridBlock — isomorphic render", () => {
  it("is a synchronous (non-async) component", () => {
    const out = GalleryGridBlock({ ...base, images: imgs(2) });
    expect(out).not.toBeInstanceOf(Promise);
  });

  it("renders one <img> per image with a client cloudinary URL + alt", () => {
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(3) }));
    const els = container.querySelectorAll("img");
    expect(els.length).toBe(3);
    expect(els[0].getAttribute("src")).toContain("res.cloudinary.com/test-cloud/image/upload/");
    expect(els[0].getAttribute("src")).toContain("/pid0");
    expect(els[0].getAttribute("alt")).toBe("Alt 0");
  });

  it("renders the empty state when images is empty", () => {
    render(GalleryGridBlock({ ...base, images: [] }));
    expect(screen.getByText(/no photos in this collection yet/i)).toBeInTheDocument();
    expect(document.querySelector("[data-block='gallery-grid'][data-empty='true']")).toBeInTheDocument();
  });

  it.each([2, 3, 4] as const)("columns=%i sets grid-template-columns", (cols) => {
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(2), columns: cols }));
    const grid = container.querySelector("[data-block='gallery-grid'] > div > div") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe(`repeat(${cols}, 1fr)`);
  });

  it("applies the gap value", () => {
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(1), gap: "loose" }));
    const grid = container.querySelector("[data-block='gallery-grid'] > div > div") as HTMLElement;
    expect(grid.style.gap).toBe("16px");
  });

  it("does not import server-only cloudinary (no SDK access in client bundle)", () => {
    // The block must NOT call the server cloudinaryThumbnailUrl; this test renders
    // without any vi.mock of @/lib/storage/cloudinary and still produces URLs.
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(1) }));
    expect(container.querySelector("img")?.getAttribute("src")).toContain("test-cloud");
  });

  it("registers default props with images:[] and no collectionId/maxItems", () => {
    expect(galleryGridDefaultProps.images).toEqual([]);
    expect(galleryGridDefaultProps).not.toHaveProperty("collectionId");
    expect(galleryGridDefaultProps).not.toHaveProperty("maxItems");
    expect(puckConfig.components.GalleryGrid.defaultProps).toHaveProperty("images");
  });
});
