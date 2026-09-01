import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  it("shows the real grid shape in an empty preset hover preview", () => {
    const { container } = render(
      GalleryGridBlock({
        ...base,
        images: [],
        _style: { galleryColumns: 3, galleryGap: "normal" },
        puck: { metadata: { presetPreview: true } },
      })
    );

    expect(screen.queryByText(/no photos in this collection yet/i)).not.toBeInTheDocument();
    expect(container.querySelector("[data-preset-media-placeholder='grid']")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-preset-media-tile]")).toHaveLength(6);
  });

  it("keeps a two-column preview to two complete rows", () => {
    const { container } = render(
      GalleryGridBlock({
        ...base,
        images: [],
        _style: { galleryColumns: 2 },
        puck: { metadata: { presetPreview: true } },
      })
    );
    expect(container.querySelectorAll("[data-preset-media-tile]")).toHaveLength(4);
  });

  it.each([2, 3, 4] as const)("_style.galleryColumns=%i sets responsive gridColsVar on grid-template-columns", (cols) => {
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(2), _style: { galleryColumns: cols } }));
    const grid = container.querySelector("[data-block='gallery-grid'] > div > div") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe(`var(--pf-grid-cols, repeat(${cols}, 1fr))`);
  });

  it("shows the configured column count in the narrow editor canvas", () => {
    const { container } = render(
      GalleryGridBlock({ ...base, images: imgs(4), _style: { galleryColumns: 4 }, puck: { isEditing: true } })
    );
    const grid = container.querySelector("[data-block='gallery-grid'] > div > div") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
  });

  it("shows the configured column count for the slot-based preset path", () => {
    const slot: import("@measured/puck").SlotComponent = (props = {}) => (
      <div data-testid="grid-slot" style={props.style} />
    );
    render(
      GalleryGridBlock({
        ...base,
        images: [],
        content: slot,
        _style: { galleryColumns: 4 },
        puck: { isEditing: true },
      })
    );
    expect(screen.getByTestId("grid-slot")).toHaveStyle({ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" });
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

  it("minHeight=custom + minHeightValue renders min-height equal to the provided value", () => {
    const { container } = render(
      GalleryGridBlock({ ...base, images: imgs(1), minHeight: "custom", minHeightValue: "400px" })
    );
    const section = container.querySelector("[data-block='gallery-grid']") as HTMLElement;
    expect(section.style.minHeight).toBe("400px");
  });

  it("minHeight=custom without minHeightValue renders no min-height constraint", () => {
    const { container } = render(
      GalleryGridBlock({ ...base, images: imgs(1), minHeight: "custom" })
    );
    const section = container.querySelector("[data-block='gallery-grid']") as HTMLElement;
    expect(section.style.minHeight).toBe("");
  });
});

describe("GalleryGridBlock — lightbox", () => {
  it("clicking an image opens the shared Lightbox with that image's data", () => {
    render(GalleryGridBlock({ ...base, images: imgs(2) }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Alt 1" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByAltText("Alt 1")).toHaveAttribute("src", expect.stringContaining("pid1"));
  });
});
