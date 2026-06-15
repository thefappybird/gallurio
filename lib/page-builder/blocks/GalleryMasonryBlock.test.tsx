import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryMasonryBlock, galleryMasonryDefaultProps } from "./GalleryMasonryBlock";
import type { GalleryMasonryProps } from "./GalleryMasonryBlock";
import type { GalleryImage } from "./GalleryGridBlock";
import { puckConfig } from "@/lib/page-builder/config";

const OLD = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
beforeEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = OLD;
});

function imgs(n: number): GalleryImage[] {
  return Array.from({ length: n }, (_, i) => ({ id: `id${i}`, publicId: `pid${i}`, alt: `Alt ${i}` }));
}

const base: GalleryMasonryProps = { ...galleryMasonryDefaultProps };

describe("GalleryMasonryBlock — isomorphic render", () => {
  it("is synchronous", () => {
    expect(GalleryMasonryBlock({ ...base, images: imgs(1) })).not.toBeInstanceOf(Promise);
  });

  it("renders one <img> per image", () => {
    const { container } = render(GalleryMasonryBlock({ ...base, images: imgs(4) }));
    expect(container.querySelectorAll("img").length).toBe(4);
  });

  it("sets columnCount from the columns prop", () => {
    const { container } = render(GalleryMasonryBlock({ ...base, images: imgs(2), columns: 4 }));
    const col = container.querySelector(".pf-masonry") as HTMLElement;
    expect(col.style.columnCount).toBe("4");
  });

  it("renders the empty state (default English label) when images is empty", () => {
    render(GalleryMasonryBlock({ ...base, images: [] }));
    expect(screen.getByText(/no photos in this collection yet/i)).toBeInTheDocument();
    expect(document.querySelector("[data-block='gallery-masonry'][data-empty='true']")).toBeInTheDocument();
  });

  it("uses a localized empty label from puck.metadata chrome when present", () => {
    render(
      GalleryMasonryBlock({
        ...base,
        images: [],
        puck: { metadata: { workspace: { _id: "x", name: "x", chrome: { gallery: { empty: "Walang larawan" } } } } },
      })
    );
    expect(screen.getByText(/walang larawan/i)).toBeInTheDocument();
  });

  it("registers default props with images:[] and no collectionId/maxItems", () => {
    expect(galleryMasonryDefaultProps.images).toEqual([]);
    expect(galleryMasonryDefaultProps).not.toHaveProperty("collectionId");
    expect(galleryMasonryDefaultProps).not.toHaveProperty("maxItems");
    expect(puckConfig.components.GalleryMasonry.defaultProps).toHaveProperty("images");
  });
});
