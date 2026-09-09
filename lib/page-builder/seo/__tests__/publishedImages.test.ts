import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/storage/cloudflareImages", () => ({
  imageDeliveryUrl: (id: string) => (id ? `https://cdn.example.com/${id}` : ""),
}));

import {
  collectPublishedGalleryImages,
  collectFeaturedCollectionIds,
  capPublishedImages,
  PUBLISHED_IMAGE_CAP,
} from "../publishedImages";

function galleryBlock(type: string, images: Array<{ id?: string; publicId?: string; alt?: string }>) {
  return { type, props: { images } };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("collectPublishedGalleryImages", () => {
  it("collects images from root content", () => {
    const data = { content: [galleryBlock("GalleryGrid", [{ publicId: "a", alt: "Photo A" }])] };
    expect(collectPublishedGalleryImages(data)).toEqual([
      { url: "https://cdn.example.com/a", alt: "Photo A" },
    ]);
  });

  it("collects images from zone arrays too", () => {
    const data = {
      content: [],
      zones: { "Container-1:zone": [galleryBlock("GalleryMasonry", [{ publicId: "b", alt: "" }])] },
    };
    expect(collectPublishedGalleryImages(data)).toEqual([{ url: "https://cdn.example.com/b", alt: "" }]);
  });

  it("collects Image blocks nested in a new gallery slot", () => {
    const data = {
      content: [{
        type: "GalleryGrid",
        props: {
          content: [{ type: "Image", props: { alt: "Hand-held film camera", _style: { bgImagePublicId: "slot-image" } } }],
        },
      }],
    };
    expect(collectPublishedGalleryImages(data)).toEqual([
      { url: "https://cdn.example.com/slot-image", alt: "Hand-held film camera" },
    ]);
  });

  it("excludes decorative backgroundImages", () => {
    const data = {
      content: [{ type: "Container", props: { backgroundImages: [{ publicId: "bg1", alt: "bg" }] } }],
    };
    expect(collectPublishedGalleryImages(data)).toEqual([]);
  });

  it("skips entries with a missing or blank publicId", () => {
    const data = {
      content: [galleryBlock("GalleryCarousel", [{ alt: "no id" }, { publicId: "  ", alt: "blank" }])],
    };
    expect(collectPublishedGalleryImages(data)).toEqual([]);
  });

  it("dedupes by url", () => {
    const data = {
      content: [galleryBlock("GalleryGrid", [{ publicId: "dup", alt: "one" }, { publicId: "dup", alt: "two" }])],
    };
    expect(collectPublishedGalleryImages(data)).toHaveLength(1);
  });

  it("enforces the cap and warns how many were dropped", () => {
    const warnSpy = vi.spyOn(console, "warn");
    const images = Array.from({ length: 5 }, (_, i) => ({ publicId: `id${i}`, alt: "" }));
    const data = { content: [galleryBlock("GalleryGrid", images)] };
    const result = collectPublishedGalleryImages(data, 3);
    expect(result).toHaveLength(3);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("dropped 2"));
  });

  it("returns empty array for non-PuckData input", () => {
    expect(collectPublishedGalleryImages(null)).toEqual([]);
    expect(collectPublishedGalleryImages(undefined)).toEqual([]);
    expect(collectPublishedGalleryImages("not an object")).toEqual([]);
  });

  it("defaults limit to PUBLISHED_IMAGE_CAP", () => {
    const images = Array.from({ length: PUBLISHED_IMAGE_CAP + 1 }, (_, i) => ({ publicId: `id${i}`, alt: "" }));
    const data = { content: [galleryBlock("GalleryGrid", images)] };
    expect(collectPublishedGalleryImages(data)).toHaveLength(PUBLISHED_IMAGE_CAP);
  });
});

describe("collectFeaturedCollectionIds", () => {
  it("collects ids from FeaturedWork blocks in content and zones", () => {
    const data = {
      content: [{ type: "FeaturedWork", props: { collections: [{ id: "col1" }, { id: "col2" }] } }],
      zones: { z: [{ type: "FeaturedWork", props: { collections: [{ id: "col3" }] } }] },
    };
    expect(collectFeaturedCollectionIds(data).sort()).toEqual(["col1", "col2", "col3"]);
  });

  it("dedupes ids and ignores non-FeaturedWork blocks", () => {
    const data = {
      content: [
        { type: "FeaturedWork", props: { collections: [{ id: "col1" }, { id: "col1" }] } },
        { type: "GalleryGrid", props: { images: [] } },
      ],
    };
    expect(collectFeaturedCollectionIds(data)).toEqual(["col1"]);
  });

  it("returns empty array for non-PuckData input", () => {
    expect(collectFeaturedCollectionIds(null)).toEqual([]);
  });
});

describe("collectPublishedGalleryImages — nested slot traversal (Puck presets)", () => {
  it("collects images from a GalleryGrid nested inside a preset block's props.content slot", () => {
    // Mirrors the real published shape: a preset block's `props.content` slot
    // holds the actual GalleryGrid, not the root `content`/`zones` arrays.
    const data = {
      content: [
        {
          type: "GalleryGridPreset",
          props: {
            content: [
              { type: "Heading", props: { text: "Gallery" } },
              galleryBlock("GalleryGrid", [{ publicId: "nested-1", alt: "Nested photo" }]),
            ],
          },
        },
      ],
    };
    expect(collectPublishedGalleryImages(data)).toEqual([
      { url: "https://cdn.example.com/nested-1", alt: "Nested photo" },
    ]);
  });

  it("collects images through multiple nesting levels (block -> slot -> block -> slot -> GalleryGrid)", () => {
    const data = {
      content: [
        {
          type: "Columns",
          props: {
            content: [
              {
                type: "CtaPreset",
                props: {
                  content: [galleryBlock("GalleryCarousel", [{ publicId: "deep-1", alt: "Deep photo" }])],
                },
              },
            ],
          },
        },
      ],
    };
    expect(collectPublishedGalleryImages(data)).toEqual([
      { url: "https://cdn.example.com/deep-1", alt: "Deep photo" },
    ]);
  });

  it("excludes backgroundImages on a nested Container/preset block", () => {
    const data = {
      content: [
        {
          type: "Columns",
          props: {
            content: [
              { type: "Container", props: { backgroundImages: [{ publicId: "bg-nested", alt: "bg" }] } },
            ],
          },
        },
      ],
    };
    expect(collectPublishedGalleryImages(data)).toEqual([]);
  });

  it("caps and dedupes images collected across several nesting levels", () => {
    const data = {
      content: [
        galleryBlock("GalleryGrid", [{ publicId: "dup", alt: "top" }]),
        {
          type: "GalleryGridPreset",
          props: {
            content: [galleryBlock("GalleryMasonry", [{ publicId: "dup", alt: "nested" }, { publicId: "extra", alt: "e" }])],
          },
        },
      ],
    };
    const result = collectPublishedGalleryImages(data, 1);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://cdn.example.com/dup");
  });

  it("terminates on a self-referential (cyclic) block tree instead of hanging or throwing", () => {
    const cyclic: { type: string; props: Record<string, unknown> } = { type: "Recursive", props: {} };
    cyclic.props.content = [cyclic, galleryBlock("GalleryGrid", [{ publicId: "cyc-1", alt: "in cycle" }])];
    const data = { content: [cyclic] };
    expect(() => collectPublishedGalleryImages(data)).not.toThrow();
    expect(collectPublishedGalleryImages(data)).toEqual([
      { url: "https://cdn.example.com/cyc-1", alt: "in cycle" },
    ]);
  });

  it("bails out cleanly on an over-deep chain instead of collecting past the depth cap", () => {
    // 15 wrapper levels, each nesting the next one deeper inside props.content;
    // the GalleryGrid at the bottom sits well past the recursion depth cap.
    let leaf: unknown = galleryBlock("GalleryGrid", [{ publicId: "too-deep", alt: "unreachable" }]);
    for (let i = 0; i < 15; i++) {
      leaf = { type: `Wrapper${i}`, props: { content: [leaf] } };
    }
    const data = { content: [leaf] };
    expect(() => collectPublishedGalleryImages(data)).not.toThrow();
    expect(collectPublishedGalleryImages(data)).toEqual([]);
  });
});

describe("collectFeaturedCollectionIds — nested slot traversal", () => {
  it("collects ids from a FeaturedWork block nested inside a preset's props.content slot", () => {
    const data = {
      content: [
        {
          type: "Columns",
          props: {
            content: [{ type: "FeaturedWork", props: { collections: [{ id: "nested-col" }] } }],
          },
        },
      ],
    };
    expect(collectFeaturedCollectionIds(data)).toEqual(["nested-col"]);
  });
});

describe("capPublishedImages", () => {
  it("dedupes by url without a cap breach", () => {
    const result = capPublishedImages([
      { url: "https://a", alt: "1" },
      { url: "https://a", alt: "2" },
      { url: "https://b", alt: "3" },
    ]);
    expect(result).toEqual([{ url: "https://a", alt: "1" }, { url: "https://b", alt: "3" }]);
  });
});
