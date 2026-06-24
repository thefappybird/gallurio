import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryGridBlock, galleryGridDefaultProps } from "./GalleryGridBlock";
import type { GalleryGridProps, GalleryImage } from "./GalleryGridBlock";
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

const base: GalleryGridProps = { ...galleryGridDefaultProps };

describe("GalleryGridBlock — isomorphic render", () => {
  it("is a synchronous (non-async) component", () => {
    const out = GalleryGridBlock({ ...base, images: imgs(2) });
    expect(out).not.toBeInstanceOf(Promise);
  });

  it("renders one <img> per image with a CF Images URL + alt", () => {
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(3) }));
    const els = container.querySelectorAll("img");
    expect(els.length).toBe(3);
    expect(els[0].getAttribute("src")).toContain("imagedelivery.net/test-hash/");
    expect(els[0].getAttribute("src")).toContain("pid0");
    expect(els[0].getAttribute("alt")).toBe("Alt 0");
  });

  it("renders the empty state when images is empty", () => {
    render(GalleryGridBlock({ ...base, images: [] }));
    expect(screen.getByText(/no photos in this collection yet/i)).toBeInTheDocument();
    expect(document.querySelector("[data-block='gallery-grid'][data-empty='true']")).toBeInTheDocument();
  });

  it.each([2, 3, 4] as const)("_style.galleryColumns=%i sets responsive gridColsVar on grid-template-columns", (cols) => {
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(2), _style: { galleryColumns: cols } }));
    const grid = container.querySelector("[data-block='gallery-grid'] > div > div") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe(`var(--pf-grid-cols, repeat(${cols}, 1fr))`);
  });

  it("applies the gap value from _style.galleryGap", () => {
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(1), _style: { galleryGap: "loose" } }));
    const grid = container.querySelector("[data-block='gallery-grid'] > div > div") as HTMLElement;
    expect(grid.style.gap).toBe("16px");
  });

  it("defaults to 3 columns when _style.galleryColumns is unset", () => {
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(2) }));
    const grid = container.querySelector("[data-block='gallery-grid'] > div > div") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("var(--pf-grid-cols, repeat(3, 1fr))");
  });

  it("does not import server-only cloudinary (no SDK access in client bundle)", () => {
    // The block must NOT call server-side storage; this test renders
    // without any vi.mock and still produces CF Images URLs.
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(1) }));
    expect(container.querySelector("img")?.getAttribute("src")).toContain("imagedelivery.net");
  });

  it("registers default props with images:[] and no collectionId/maxItems", () => {
    expect(galleryGridDefaultProps.images).toEqual([]);
    expect(galleryGridDefaultProps).not.toHaveProperty("collectionId");
    expect(galleryGridDefaultProps).not.toHaveProperty("maxItems");
    expect(puckConfig.components.GalleryGrid.defaultProps).toHaveProperty("images");
  });
});

describe("GalleryGridBlock — banner/container props", () => {
  it("renders a background image when backgroundImages has one entry", () => {
    const bgImages: GalleryImage[] = [{ id: "bg1", publicId: "bg-pid1" }];
    const { container } = render(
      GalleryGridBlock({ ...base, images: imgs(1), backgroundImages: bgImages })
    );
    // A background <img> with aria-hidden is injected for a single bg image
    const bgImg = container.querySelector("img[aria-hidden='true']");
    expect(bgImg).toBeTruthy();
    expect(bgImg?.getAttribute("src")).toContain("bg-pid1");
  });

  it("renders an overlay scrim when overlayOpacity > 0 and backgroundImages present", () => {
    const bgImages: GalleryImage[] = [{ id: "bg1", publicId: "bg-pid1" }];
    const { container } = render(
      GalleryGridBlock({ ...base, images: imgs(1), backgroundImages: bgImages, overlayOpacity: 50 })
    );
    const scrim = container.querySelector("[aria-hidden='true'][style*='rgba']");
    expect(scrim).toBeTruthy();
  });

  it("applies minHeight css when minHeight='medium'", () => {
    const { container } = render(
      GalleryGridBlock({ ...base, images: imgs(1), minHeight: "medium" })
    );
    const section = container.querySelector("[data-block='gallery-grid']") as HTMLElement;
    expect(section.style.minHeight).toBe("60vh");
  });

  it("back-compat: no background image, no scrim, no minHeight when banner props absent", () => {
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(1) }));
    expect(container.querySelector("img[aria-hidden='true']")).toBeNull();
    expect(container.querySelector("[aria-hidden='true'][style*='rgba']")).toBeNull();
    const section = container.querySelector("[data-block='gallery-grid']") as HTMLElement;
    expect(section.style.minHeight).toBe("");
  });
});
