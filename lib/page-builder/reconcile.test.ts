import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { reconcileGalleryImages } from "./reconcile";
import type { PuckData } from "@/lib/page-builder/types";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
afterEach(async () => {
  await clearCollections();
});

async function makeItem(workspaceId: Types.ObjectId, i: number, over: Record<string, unknown> = {}) {
  return GalleryItem.create({
    workspaceId,
    collectionId: null,
    cloudinaryPublicId: `ws/${workspaceId}/item${i}`,
    url: `https://x/${i}.jpg`,
    altText: `Alt ${i}`,
    caption: `Cap ${i}`,
    order: i,
    ...over,
  });
}

function gridBlock(images: Array<{ id: string; publicId: string; alt?: string }>): { type: string; props: Record<string, unknown> } {
  return { type: "GalleryGrid", props: { id: "g1", images, columns: 3, gap: "normal" } };
}

describe("reconcileGalleryImages", () => {
  it("refreshes publicId + alt from the current GalleryItem (stale cache rebuilt)", async () => {
    const ws = new Types.ObjectId();
    const it = await makeItem(ws, 0);
    const data: PuckData = {
      root: {},
      content: [gridBlock([{ id: String(it._id), publicId: "STALE", alt: "stale" }])],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    const images = (out.content[0].props.images as Array<{ id: string; publicId: string; alt: string }>);
    expect(images).toEqual([{ id: String(it._id), publicId: `ws/${ws}/item0`, alt: "Alt 0" }]);
  });

  it("falls back alt to caption then empty string", async () => {
    const ws = new Types.ObjectId();
    const noAlt = await makeItem(ws, 1, { altText: "" });
    const noText = await makeItem(ws, 2, { altText: "", caption: "" });
    const data: PuckData = {
      root: {},
      content: [gridBlock([
        { id: String(noAlt._id), publicId: "x" },
        { id: String(noText._id), publicId: "x" },
      ])],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    const images = out.content[0].props.images as Array<{ alt: string }>;
    expect(images[0].alt).toBe("Cap 1");
    expect(images[1].alt).toBe("");
  });

  it("prunes ids whose item no longer exists; preserves stored order; never adds", async () => {
    const ws = new Types.ObjectId();
    const a = await makeItem(ws, 0);
    const b = await makeItem(ws, 1);
    const c = await makeItem(ws, 2);
    const missing = new Types.ObjectId().toString();
    const data: PuckData = {
      root: {},
      content: [gridBlock([
        { id: String(c._id), publicId: "x" },
        { id: missing, publicId: "x" },
        { id: String(a._id), publicId: "x" },
      ])],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    const ids = (out.content[0].props.images as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toEqual([String(c._id), String(a._id)]);
    expect(ids).not.toContain(String(b._id));
  });

  it("prunes a foreign-workspace id (tenant isolation)", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const foreign = await makeItem(wsB, 0);
    const mine = await makeItem(wsA, 0);
    const data: PuckData = {
      root: {},
      content: [gridBlock([
        { id: String(foreign._id), publicId: "x" },
        { id: String(mine._id), publicId: "x" },
      ])],
    };
    const out = await reconcileGalleryImages(wsA.toString(), data);
    const ids = (out.content[0].props.images as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toEqual([String(mine._id)]);
  });

  it("collects ids across all gallery blocks AND zones with a SINGLE query (no N+1)", async () => {
    const ws = new Types.ObjectId();
    const a = await makeItem(ws, 0);
    const b = await makeItem(ws, 1);
    const findSpy = vi.spyOn(GalleryItem, "find");
    const data: PuckData = {
      root: {},
      content: [
        { type: "GalleryGrid", props: { id: "g1", images: [{ id: String(a._id), publicId: "x" }], columns: 3, gap: "normal" } },
        { type: "Heading", props: { id: "h1", text: "x", level: "h2" } },
      ],
      zones: {
        "g1:content": [
          { type: "GalleryCarousel", props: { id: "c1", images: [{ id: String(b._id), publicId: "x" }], heading: "", description: "", aspect: "landscape", floatX: "center", floatY: "center", autoplay: false } },
        ],
      },
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(findSpy).toHaveBeenCalledTimes(1);
    expect((out.content[0].props.images as unknown[]).length).toBe(1);
    expect((out.zones!["g1:content"][0].props.images as unknown[]).length).toBe(1);
    findSpy.mockRestore();
  });

  it("is a no-op (no query) when there are no gallery blocks", async () => {
    const ws = new Types.ObjectId();
    const findSpy = vi.spyOn(GalleryItem, "find");
    const data: PuckData = { root: {}, content: [{ type: "Heading", props: { id: "h1", text: "x", level: "h2" } }] };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(findSpy).not.toHaveBeenCalled();
    expect(out).toEqual(data);
    findSpy.mockRestore();
  });

  it("treats a missing/empty images[] as empty (no throw)", async () => {
    const ws = new Types.ObjectId();
    const data: PuckData = {
      root: {},
      content: [{ type: "GalleryMasonry", props: { id: "m1", columns: 3, gap: "normal" } }],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(out.content[0].props.images).toEqual([]);
  });

  function containerBlock(
    type: string,
    backgroundImages: Array<{ id: string; publicId: string; alt?: string }>
  ): { type: string; props: Record<string, unknown> } {
    return { type, props: { id: "c1", backgroundImages, overlayOpacity: 0, content: [] } };
  }

  it("refreshes a Container's backgroundImages like a gallery block", async () => {
    const ws = new Types.ObjectId();
    const it = await makeItem(ws, 5);
    const data: PuckData = {
      root: {},
      content: [containerBlock("Container", [{ id: String(it._id), publicId: "STALE", alt: "stale" }])],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(out.content[0].props.backgroundImages).toEqual([
      { id: String(it._id), publicId: `ws/${ws}/item5`, alt: "Alt 5" },
    ]);
  });

  it("prunes a foreign-workspace background image (tenant isolation)", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const foreign = await makeItem(wsB, 0);
    const mine = await makeItem(wsA, 1);
    const data: PuckData = {
      root: {},
      content: [containerBlock("HeroPreset", [
        { id: String(foreign._id), publicId: "x" },
        { id: String(mine._id), publicId: "x" },
      ])],
    };
    const out = await reconcileGalleryImages(wsA.toString(), data);
    const ids = (out.content[0].props.backgroundImages as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toEqual([String(mine._id)]);
  });

  it("collects gallery images AND container backgrounds in a SINGLE query", async () => {
    const ws = new Types.ObjectId();
    const a = await makeItem(ws, 0);
    const b = await makeItem(ws, 1);
    const findSpy = vi.spyOn(GalleryItem, "find");
    const data: PuckData = {
      root: {},
      content: [
        gridBlock([{ id: String(a._id), publicId: "x" }]),
        containerBlock("Container", [{ id: String(b._id), publicId: "x" }]),
      ],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(findSpy).toHaveBeenCalledTimes(1);
    expect((out.content[0].props.images as unknown[]).length).toBe(1);
    expect((out.content[1].props.backgroundImages as unknown[]).length).toBe(1);
    findSpy.mockRestore();
  });

  it("is still a no-op (no query) for a Container with an empty backgroundImages", async () => {
    const ws = new Types.ObjectId();
    const findSpy = vi.spyOn(GalleryItem, "find");
    const data: PuckData = { root: {}, content: [containerBlock("Container", [])] };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(findSpy).not.toHaveBeenCalled();
    expect(out.content[0].props.backgroundImages).toEqual([]);
    findSpy.mockRestore();
  });
});
