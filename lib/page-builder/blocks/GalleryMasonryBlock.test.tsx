import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { GalleryMasonryBlock, galleryMasonryDefaultProps } from "./GalleryMasonryBlock";
import type { GalleryMasonryProps } from "./GalleryMasonryBlock";
import type { GalleryImage } from "./GalleryGridBlock";
import type { SlotComponent } from "@measured/puck";
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

  it("shows the configured column count in the narrow editor canvas", () => {
    const { container } = render(
      GalleryMasonryBlock({ ...base, images: imgs(4), _style: { galleryColumns: 4 }, puck: { isEditing: true } })
    );
    const col = container.querySelector(".pf-masonry") as HTMLElement;
    expect(col.style.columnCount).toBe("4");
  });

  it("shows the configured column count for explicit preset lanes", () => {
    const lane: SlotComponent = (props = {}) => <div className={props.className} />;
    const { container } = render(
      GalleryMasonryBlock({
        ...base,
        id: "editor-lanes",
        images: [],
        masonryLayout: "columns",
        column1: lane,
        column2: lane,
        column3: lane,
        column4: lane,
        _style: { galleryColumns: 4 },
        puck: { isEditing: true },
      } as Parameters<typeof GalleryMasonryBlock>[0])
    );
    const lanes = container.querySelector(".pf-masonry-editor-lanes-columns") as HTMLElement;
    expect(lanes.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
    expect(container.querySelectorAll("[data-masonry-column]")).toHaveLength(4);
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

  it("shows varied masonry tiles in an empty preset hover preview", () => {
    const { container } = render(
      GalleryMasonryBlock({
        ...base,
        images: [],
        _style: { galleryColumns: 3, galleryGap: "normal" },
        puck: { metadata: { presetPreview: true } },
      })
    );

    expect(screen.queryByText(/no photos in this collection yet/i)).not.toBeInTheDocument();
    expect(container.querySelector("[data-preset-media-placeholder='masonry']")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-preset-media-tile]")).toHaveLength(6);
  });

  it("keeps a two-column preview to two complete tiles per column", () => {
    const { container } = render(
      GalleryMasonryBlock({
        ...base,
        images: [],
        _style: { galleryColumns: 2 },
        puck: { metadata: { presetPreview: true } },
      })
    );
    expect(container.querySelectorAll("[data-preset-media-tile]")).toHaveLength(4);
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

describe("GalleryMasonryBlock — true masonry flow", () => {
  it("uses independent CSS columns", () => {
    const { container } = render(GalleryMasonryBlock({ ...base, images: imgs(3) }));
    const col = container.querySelector(".pf-masonry") as HTMLElement;
    expect(col.style.display).toBe("");
    expect(col.style.columnCount).toBe("var(--pf-masonry-cols, 3)");
    const figure = container.querySelector("figure") as HTMLElement;
    expect(figure.style.marginTop).toBe("0px");
    expect(figure.style.breakInside).toBe("avoid");
    expect(figure.style.display).toBe("inline-block");
    expect(figure.style.width).toBe("100%");
  });

  it("ignores a saved legacy galleryStagger value", () => {
    const { container } = render(
      GalleryMasonryBlock({ ...base, images: imgs(2), _style: { galleryStagger: true } })
    );
    const col = container.querySelector(".pf-masonry") as HTMLElement;
    expect(col.style.columnCount).toBe("var(--pf-masonry-cols, 3)");
  });

  it("keeps the empty state when legacy galleryStagger data is present", () => {
    render(GalleryMasonryBlock({ ...base, images: [], _style: { galleryStagger: true } }));
    expect(document.querySelector("[data-block='gallery-masonry'][data-empty='true']")).toBeInTheDocument();
  });

  it("keeps the lightbox working when legacy galleryStagger data is present", () => {
    render(GalleryMasonryBlock({ ...base, images: imgs(2), _style: { galleryStagger: true } }));
    fireEvent.click(screen.getByRole("button", { name: "Alt 1" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByAltText("Alt 1")).toHaveAttribute("src", expect.stringContaining("pid1"));
  });

  it("applies configured alternating heights to every editable Image slot child", () => {
    const slot: SlotComponent = () => <div data-testid="masonry-slot-child" />;
    const { container } = render(
      GalleryMasonryBlock({
        ...base,
        images: [],
        content: slot,
        _style: { masonryHeightPattern: "alternating", masonryOddHeight: 220, masonryEvenHeight: 380 },
      }),
    );

    const rules = container.querySelector("style")?.textContent ?? "";
    expect(rules).toContain(":nth-child(odd){height:220px !important");
    expect(rules).toContain(":nth-child(even){height:380px !important");
  });

  it("uses different alternate rhythms for odd/even column lanes", () => {
    const lane = (name: string): SlotComponent => {
      function MasonryLaneSlot(props: NonNullable<Parameters<SlotComponent>[0]> = {}) {
        return <div className={props.className} data-testid={name}><div /><div /><div /></div>;
      }
      return MasonryLaneSlot;
    };
    const { container } = render(
      GalleryMasonryBlock({
        ...base,
        id: "loop-lanes",
        images: [],
        masonryLayout: "columns",
        column1: lane("lane-1"),
        column2: lane("lane-2"),
        column3: lane("lane-3"),
        _style: {
          galleryColumns: 3,
          masonryHeightPattern: "alternating",
          masonryOddHeight: 220,
          masonryEvenHeight: 380,
          masonryEvenColumnOddHeight: 410,
          masonryEvenColumnEvenHeight: 250,
        },
      } as Parameters<typeof GalleryMasonryBlock>[0]),
    );

    const lanes = container.querySelectorAll("[data-masonry-column]");
    expect(lanes).toHaveLength(3);
    expect(screen.getAllByTestId(/lane-/)).toHaveLength(3);
    const rules = container.querySelector("style")?.textContent ?? "";
    expect(rules).toContain("pf-masonry-loop-lanes-column-1");
    expect(rules).toContain("height:220px !important");
    expect(rules).toContain("pf-masonry-loop-lanes-column-2");
    expect(rules).toContain("height:410px !important");
  });
});

describe("GalleryMasonryBlock — lightbox", () => {
  it("clicking an image opens the shared Lightbox with that image's data", () => {
    render(GalleryMasonryBlock({ ...base, images: imgs(2) }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Alt 1" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByAltText("Alt 1")).toHaveAttribute("src", expect.stringContaining("pid1"));
  });
});
