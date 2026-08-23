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
