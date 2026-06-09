import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryCarouselBlock, galleryCarouselDefaultProps } from "./GalleryCarouselBlock";
import type { GalleryCarouselProps } from "./GalleryCarouselBlock";
import type { GalleryImage } from "./GalleryGridBlock";
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

const base: GalleryCarouselProps = { ...galleryCarouselDefaultProps };

describe("GalleryCarouselBlock — isomorphic render", () => {
  it("is synchronous", () => {
    expect(GalleryCarouselBlock({ ...base, images: imgs(2) })).not.toBeInstanceOf(Promise);
  });

  it("maps images[] to carousel slides (one <img> per image)", () => {
    const { container } = render(GalleryCarouselBlock({ ...base, images: imgs(3) }));
    expect(container.querySelectorAll("[data-slide] img").length).toBe(3);
    expect(container.querySelector("[data-block='gallery-carousel']")).toBeInTheDocument();
  });

  it("renders the floating header heading/description", () => {
    render(GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Our Work", description: "Recent shoots" }));
    expect(screen.getByText("Our Work")).toBeInTheDocument();
    expect(screen.getByText("Recent shoots")).toBeInTheDocument();
  });

  it("renders the empty state when images is empty", () => {
    render(GalleryCarouselBlock({ ...base, images: [] }));
    expect(screen.getByText(/no photos in this collection yet/i)).toBeInTheDocument();
    expect(document.querySelector("[data-block='gallery-carousel'][data-empty='true']")).toBeInTheDocument();
  });

  it("registers default props with images:[] and no collectionId/maxItems/overlayAlign", () => {
    expect(galleryCarouselDefaultProps.images).toEqual([]);
    expect(galleryCarouselDefaultProps).not.toHaveProperty("collectionId");
    expect(galleryCarouselDefaultProps).not.toHaveProperty("maxItems");
    expect(galleryCarouselDefaultProps).not.toHaveProperty("overlayAlign");
    expect(puckConfig.components.GalleryCarousel.defaultProps).toHaveProperty("images");
  });

  it("threads the picked text color token into the heading", () => {
    const { container } = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi", _style: { textColorToken: "primary" } })
    );
    expect(container.querySelector("h2")!.getAttribute("style") ?? "").toContain("var(--pf-color-primary)");
  });

  it("renders a heading highlight band when _style.headingHighlight is on", () => {
    const { container } = render(
      GalleryCarouselBlock({
        ...base,
        images: imgs(2),
        heading: "Hi",
        _style: { headingHighlight: true, headingHighlightToken: "accent" },
      })
    );
    expect(container.querySelector("[data-gallery-overlay] h2 mark")).not.toBeNull();
  });

  it("applies Text Padding to the overlay layer (default 1.5rem, overridable)", () => {
    const def = render(GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi" }));
    expect(def.container.querySelector("[data-gallery-overlay]")!.getAttribute("style") ?? "").toContain("padding: 1.5rem");

    const custom = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi", _style: { textPaddingX: "2rem", textPaddingY: "3rem" } })
    );
    const style = custom.container.querySelector("[data-gallery-overlay]")!.getAttribute("style") ?? "";
    // Guard the Y-then-X axis order (padding: <vertical> <horizontal>).
    expect(style).toContain("padding: 3rem 2rem");
  });

  it("lets _style.align override the float-derived heading alignment", () => {
    const { container } = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi", floatX: "center", _style: { align: "left" } })
    );
    const wrapper = container.querySelector("h2")!.parentElement!;
    expect(wrapper.getAttribute("style") ?? "").toContain("text-align: left");
  });
});
