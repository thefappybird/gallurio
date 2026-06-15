import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { GalleryCarouselBlock, galleryCarouselDefaultProps } from "./GalleryCarouselBlock";
import type { GalleryCarouselProps } from "./GalleryCarouselBlock";
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

  it("threads heading and description colors independently", () => {
    const { container } = render(
      GalleryCarouselBlock({
        ...base,
        images: imgs(2),
        heading: "Hi",
        description: "Yo",
        _style: { headingColorToken: "primary", descriptionColorToken: "secondary" },
      })
    );
    expect(container.querySelector("h2")!.getAttribute("style") ?? "").toContain("var(--pf-color-primary)");
    expect(container.querySelector("[data-gallery-overlay] p")!.getAttribute("style") ?? "").toContain("var(--pf-color-secondary)");
  });

  it("renders the heading at the chosen level", () => {
    const { container } = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi", _style: { headingLevel: "h1" } })
    );
    expect(container.querySelector("h1")).not.toBeNull();
  });

  it("applies the description font size", () => {
    const { container } = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), description: "Yo", _style: { descriptionFontSize: 22 } })
    );
    expect(container.querySelector("[data-gallery-overlay] p")!.getAttribute("style") ?? "").toContain("font-size: 22px");
  });

  it("renders a heading highlight band with the chosen shape and size", () => {
    const { container } = render(
      GalleryCarouselBlock({
        ...base,
        images: imgs(2),
        heading: "Hi",
        _style: { headingHighlight: true, headingHighlightToken: "accent", headingHighlightShape: "rounded", headingHighlightSize: "lg" },
      })
    );
    const mark = container.querySelector("[data-gallery-overlay] h2 mark");
    expect(mark).not.toBeNull();
    expect(mark!.getAttribute("style") ?? "").toContain("border-radius: 0.6em");
    expect(mark!.getAttribute("style") ?? "").toContain("padding: 0.2em 0.45em");
  });

  it("applies Text Padding to the overlay layer (default 1.5rem, overridable)", () => {
    const def = render(GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi" }));
    expect(def.container.querySelector("[data-gallery-overlay]")!.getAttribute("style") ?? "").toContain("padding: 1.5rem");

    const custom = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi", _style: { textPaddingX: "2rem", textPaddingY: "3rem" } })
    );
    const style = custom.container.querySelector("[data-gallery-overlay]")!.getAttribute("style") ?? "";
    expect(style).toContain("padding: 3rem 2rem");
  });

  it("lets _style.headingAlign override the float-derived heading alignment", () => {
    const { container } = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi", floatX: "center", _style: { headingAlign: "left" } })
    );
    expect(container.querySelector("h2")!.getAttribute("style") ?? "").toContain("text-align: left");
  });
});

describe("GalleryCarouselBlock heading gap", () => {
  it("passes _style.headingGap to the rendered description margin", () => {
    const { container } = render(
      <GalleryCarouselBlock
        {...galleryCarouselDefaultProps}
        images={[{ id: "1", publicId: "demo/x", alt: "" }]}
        heading="Title"
        description="Desc"
        _style={{ headingGap: 32 }}
      />,
    );
    const p = container.querySelector("[data-gallery-overlay] p")!;
    expect(p.getAttribute("style") ?? "").toContain("32px");
  });
});
