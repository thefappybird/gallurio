import { describe, expect, it } from "vitest";
import {
  galleryPropsWithZones,
  gallerySlotPatch,
  gallerySlotSelections,
  galleryZonesWithPatch,
} from "./gallerySlotImages";

const photo = (id: string) => ({ id, publicId: `asset/${id}` });
const image = (id: string, publicId = "", height?: string) => ({
  type: "Image",
  props: {
    id,
    alt: publicId ? `Alt for ${publicId}` : "",
    _style: { ...(height ? { height } : {}), ...(publicId ? { bgImagePublicId: publicId } : {}) },
  },
});

describe("gallerySlotImages", () => {
  it("reads and atomically rewrites Puck zone-backed slots", () => {
    const props = { id: "grid-zoned", images: [], content: [] };
    const zones = { "grid-zoned:content": [image("image-1", "asset/a")] };
    const hydrated = galleryPropsWithZones(props, zones);
    expect(gallerySlotSelections("GalleryGrid", hydrated)).toEqual([{ id: "asset/a", publicId: "asset/a" }]);

    const patch = gallerySlotPatch("GalleryGrid", hydrated, [photo("b")]);
    const nextZones = galleryZonesWithPatch(props, patch, zones);
    expect(nextZones?.["grid-zoned:content"][0].props).toMatchObject({ id: "image-1", galleryItemId: "b" });
    expect((nextZones?.["grid-zoned:content"][0].props._style as Record<string, unknown>).bgImagePublicId).toBe("asset/b");
    expect(zones["grid-zoned:content"][0].props._style).toEqual({ bgImagePublicId: "asset/a" });
  });

  it("assigns Photo Grid selections to nested Image blocks while preserving positional styles", () => {
    const props = {
      id: "grid-1",
      images: [],
      content: [image("image-1", "", "12rem"), image("image-2", "asset/old", "18rem")],
    };

    const patch = gallerySlotPatch("GalleryGrid", props, [photo("a"), photo("b"), photo("c")]);
    const content = patch.content as Array<{ props: Record<string, unknown> }>;

    expect(patch.images).toEqual([]);
    expect(content).toHaveLength(3);
    expect(content[0].props).toMatchObject({ id: "image-1", galleryItemId: "a", alt: "" });
    expect(content[0].props._style).toEqual({ height: "12rem", bgImagePublicId: "asset/a" });
    expect(content[1].props).toMatchObject({ id: "image-2", galleryItemId: "b", alt: "" });
    expect(content[2].props.id).toContain("grid-1--bulk-image-c");
  });

  it("keeps an asset's alt text when photos are reordered without moving positional styles", () => {
    const props = {
      id: "grid-1",
      images: [],
      content: [image("image-1", "asset/a", "12rem"), image("image-2", "asset/b", "18rem")],
    };

    const patch = gallerySlotPatch("GalleryGrid", props, [photo("b"), photo("a")]);
    const content = patch.content as Array<{ props: Record<string, unknown> }>;

    expect(content[0].props).toMatchObject({ id: "image-1", alt: "Alt for asset/b" });
    expect(content[0].props._style).toEqual({ height: "12rem", bgImagePublicId: "asset/b" });
    expect(content[1].props).toMatchObject({ id: "image-2", alt: "Alt for asset/a" });
    expect(content[1].props._style).toEqual({ height: "18rem", bgImagePublicId: "asset/a" });
  });

  it("reads and writes Masonry lanes in visual row order and removes derived clones", () => {
    const props = {
      id: "masonry-1",
      masonryLayout: "columns",
      masonryLoop: true,
      images: [],
      _style: { galleryColumns: 3 },
      column1: [image("c1-r1", "asset/a", "15rem"), image("c1-r2", "asset/d", "25rem"), { type: "MasonryClone", props: { id: "clone-1" } }],
      column2: [image("c2-r1", "asset/b", "22rem"), image("c2-r2", "asset/e", "17rem")],
      column3: [image("c3-r1", "asset/c", "18rem"), image("c3-r2", "asset/f", "21rem")],
    };

    expect(gallerySlotSelections("GalleryMasonry", props).map((item) => item.publicId)).toEqual([
      "asset/a", "asset/b", "asset/c", "asset/d", "asset/e", "asset/f",
    ]);

    const patch = gallerySlotPatch("GalleryMasonry", props, [photo("f"), photo("e"), photo("d"), photo("c")]);
    const column1 = patch.column1 as Array<{ type: string; props: Record<string, unknown> }>;
    const column2 = patch.column2 as Array<{ type: string; props: Record<string, unknown> }>;
    const column3 = patch.column3 as Array<{ type: string; props: Record<string, unknown> }>;

    expect(column1.map((item) => item.type)).toEqual(["Image", "Image"]);
    expect(column1.map((item) => (item.props._style as Record<string, unknown>).bgImagePublicId)).toEqual(["asset/f", "asset/c"]);
    expect(column2).toHaveLength(1);
    expect(column3).toHaveLength(1);
  });
});
