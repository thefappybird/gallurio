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

  it("sets responsive masonryColsVar from _style.galleryColumns", () => {
    const { container } = render(GalleryMasonryBlock({ ...base, images: imgs(2), _style: { galleryColumns: 4 } }));
    const col = container.querySelector(".pf-masonry") as HTMLElement;
    expect(col.style.columnCount).toBe("var(--pf-masonry-cols, 4)");
  });

  it("defaults to 3 columns when _style.galleryColumns is unset", () => {
    const { container } = render(GalleryMasonryBlock({ ...base, images: imgs(2) }));
    const col = container.querySelector(".pf-masonry") as HTMLElement;
    expect(col.style.columnCount).toBe("var(--pf-masonry-cols, 3)");
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

describe("GalleryMasonryBlock — banner/container props", () => {
  it("renders a background image when backgroundImages has one entry", () => {
    const bgImages: GalleryImage[] = [{ id: "bg1", publicId: "bg-pid1" }];
    const { container } = render(
      GalleryMasonryBlock({ ...base, images: imgs(1), backgroundImages: bgImages })
    );
    const bgImg = container.querySelector("img[aria-hidden='true']");
    expect(bgImg).toBeTruthy();
    expect(bgImg?.getAttribute("src")).toContain("bg-pid1");
  });
});

describe("GalleryMasonryBlock — CLS / dimension reservation", () => {
  it("emits width + height attrs and aspect-ratio style when image has known dimensions", () => {
    const withDims: GalleryImage[] = [{ id: "d1", publicId: "pid-d1", width: 1200, height: 800 }];
    const { container } = render(GalleryMasonryBlock({ ...base, images: withDims }));
    const img = container.querySelector("figure img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("800");
    expect(img.style.aspectRatio).toBe("1200 / 800");
    // height:auto must not be set when aspect-ratio handles it
    expect(img.style.height).toBe("");
  });

  it("omits width/height attrs and aspect-ratio for legacy images without dimensions", () => {
    const noDims: GalleryImage[] = [{ id: "d2", publicId: "pid-d2" }];
    const { container } = render(GalleryMasonryBlock({ ...base, images: noDims }));
    const img = container.querySelector("figure img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute("width")).toBeNull();
    expect(img.getAttribute("height")).toBeNull();
    expect(img.style.aspectRatio).toBe("");
    expect(img.style.height).toBe("auto");
  });
});
