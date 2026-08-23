import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
import { reconcileGalleryImages, reconcileFeaturedCollections } from "./reconcile";
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
    assetId: `ws/${workspaceId}/item${i}`,
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

  it("altText wins over caption when both are set; caption is only the fallback", async () => {
    const ws = new Types.ObjectId();
    const both = await makeItem(ws, 9, { altText: "Alt wins", caption: "Cap loses" });
    const data: PuckData = {
      root: {},
      content: [gridBlock([{ id: String(both._id), publicId: "x" }])],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    const images = out.content[0].props.images as Array<{ alt: string }>;
    expect(images[0].alt).toBe("Alt wins");
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

  it("reconciles a GalleryGrid nested inside a GalleryGridPreset's props.content slot (single query; refresh; prune; order preserved; sibling untouched)", async () => {
    // Mirrors the real published shape: GalleryGridPreset @ content[0],
    // Heading/Text/GalleryGrid nested in its props.content slot.
    const ws = new Types.ObjectId();
    const a = await makeItem(ws, 0);
    const missing = new Types.ObjectId().toString();
    const findSpy = vi.spyOn(GalleryItem, "find");
    const data: PuckData = {
      root: {},
      content: [
        {
          type: "GalleryGridPreset",
          props: {
            content: [
              { type: "Heading", props: { id: "h1", text: "Gallery", level: "h2" } },
              { type: "Text", props: { id: "t1", text: "desc" } },
              gridBlock([
                { id: String(a._id), publicId: "STALE", alt: "stale" },
                { id: missing, publicId: "x" },
              ]),
            ],
          },
        },
      ],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(findSpy).toHaveBeenCalledTimes(1);
    const nested = out.content[0].props.content as Array<{ type: string; props: Record<string, unknown> }>;
    expect(nested[0].type).toBe("Heading");
    expect(nested[1].type).toBe("Text");
    expect(nested[2].props.images).toEqual([
      { id: String(a._id), publicId: `ws/${ws}/item0`, alt: "Alt 0" },
    ]);
    findSpy.mockRestore();
  });

  it("no-op fast path considers nested blocks: a tree whose ONLY gallery block is nested still queries and reconciles (not skipped)", async () => {
    const ws = new Types.ObjectId();
    const a = await makeItem(ws, 0);
    const findSpy = vi.spyOn(GalleryItem, "find");
    const data: PuckData = {
      root: {},
      content: [
        {
          type: "Columns",
          props: { content: [gridBlock([{ id: String(a._id), publicId: "STALE" }])] },
        },
      ],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(findSpy).toHaveBeenCalledTimes(1);
    const nested = out.content[0].props.content as Array<{ props: Record<string, unknown> }>;
    expect((nested[0].props.images as Array<{ publicId: string }>)[0].publicId).toBe(`ws/${ws}/item0`);
    findSpy.mockRestore();
  });
});

function fwBlock(collections: Array<{ id: string; name?: string; coverPublicId?: string; itemCount?: number }>) {
  return { type: "FeaturedWork", props: { id: "fw1", collections, columns: 3 } };
}

describe("reconcileFeaturedCollections", () => {
  it("refreshes name + coverPublicId(from coverItemId) + itemCount(public total); preserves order; prunes deleted/foreign; never adds", async () => {
    const ws = new Types.ObjectId();
    const colA = await GalleryCollection.create({ workspaceId: ws, name: "Weddings", slug: "w", isPublic: true });
    const cover = await GalleryItem.create({ workspaceId: ws, collectionId: colA._id, assetId: "cover-pid", url: "u", order: 0 });
    await GalleryItem.create({ workspaceId: ws, collectionId: colA._id, assetId: "p1", url: "u", order: 1 });
    await GalleryCollection.updateOne({ _id: colA._id }, { $set: { coverItemId: cover._id } });
    const foreignWs = new Types.ObjectId();
    const foreign = await GalleryCollection.create({ workspaceId: foreignWs, name: "X", slug: "x", isPublic: true });
    const missing = new Types.ObjectId().toString();
    const data: PuckData = { root: {}, content: [fwBlock([
      { id: String(colA._id), name: "STALE", coverPublicId: "STALE", itemCount: 0 },
      { id: missing },
      { id: String(foreign._id) },
    ])] };
    const out = await reconcileFeaturedCollections(ws.toString(), data);
    expect(out.content[0].props.collections).toEqual([{ id: String(colA._id), name: "Weddings", coverPublicId: "cover-pid", itemCount: 2 }]);
  });

  it("itemCount is 0 for a private collection", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "Priv", slug: "p", isPublic: false });
    await GalleryItem.create({ workspaceId: ws, collectionId: col._id, assetId: "x", url: "u", order: 0 });
    const out = await reconcileFeaturedCollections(ws.toString(), { root: {}, content: [fwBlock([{ id: String(col._id) }])] });
    expect((out.content[0].props.collections as Array<{ itemCount: number }>)[0].itemCount).toBe(0);
  });

  it("falls back coverPublicId to newest item when no coverItemId; '' for empty collection", async () => {
    const ws = new Types.ObjectId();
    const withItems = await GalleryCollection.create({ workspaceId: ws, name: "A", slug: "a", isPublic: true });
    await GalleryItem.create({ workspaceId: ws, collectionId: withItems._id, assetId: "newest", url: "u", order: 0 });
    const empty = await GalleryCollection.create({ workspaceId: ws, name: "B", slug: "b", isPublic: true });
    const out = await reconcileFeaturedCollections(ws.toString(), { root: {}, content: [fwBlock([{ id: String(withItems._id) }, { id: String(empty._id) }])] });
    const cols = out.content[0].props.collections as Array<{ coverPublicId: string }>;
    expect(cols[0].coverPublicId).toBe("newest");
    expect(cols[1].coverPublicId).toBe("");
  });

  it("no-op (no query) when there are no FeaturedWork blocks", async () => {
    const ws = new Types.ObjectId();
    const findSpy = vi.spyOn(GalleryCollection, "find");
    const data: PuckData = { root: {}, content: [{ type: "Heading", props: { id: "h", text: "x", level: "h2" } }] };
    const out = await reconcileFeaturedCollections(ws.toString(), data);
    expect(findSpy).not.toHaveBeenCalled();
    expect(out).toEqual(data);
    findSpy.mockRestore();
  });

  it("uses a single GalleryCollection.find for collections across blocks/zones (no N+1)", async () => {
    const ws = new Types.ObjectId();
    const c1 = await GalleryCollection.create({ workspaceId: ws, name: "A", slug: "a", isPublic: true });
    const c2 = await GalleryCollection.create({ workspaceId: ws, name: "B", slug: "b", isPublic: true });
    const findSpy = vi.spyOn(GalleryCollection, "find");
    const data: PuckData = { root: {}, content: [fwBlock([{ id: String(c1._id) }])], zones: { "z:1": [fwBlock([{ id: String(c2._id) }])] } };
    await reconcileFeaturedCollections(ws.toString(), data);
    expect(findSpy).toHaveBeenCalledTimes(1);
    findSpy.mockRestore();
  });

  it("reconciles a FeaturedWork block nested inside a FeaturedWorkPreset's props.content slot (single query; refresh; prune; sibling untouched)", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "Weddings", slug: "w", isPublic: true });
    await GalleryItem.create({ workspaceId: ws, collectionId: col._id, assetId: "p0", url: "u", order: 0 });
    const missing = new Types.ObjectId().toString();
    const findSpy = vi.spyOn(GalleryCollection, "find");
    const data: PuckData = {
      root: {},
      content: [
        {
          type: "FeaturedWorkPreset",
          props: {
            content: [
              { type: "Heading", props: { id: "h1", text: "Work", level: "h2" } },
              fwBlock([{ id: String(col._id), name: "STALE" }, { id: missing }]),
            ],
          },
        },
      ],
    };
    const out = await reconcileFeaturedCollections(ws.toString(), data);
    expect(findSpy).toHaveBeenCalledTimes(1);
    const nested = out.content[0].props.content as Array<{ type: string; props: Record<string, unknown> }>;
    expect(nested[0].type).toBe("Heading");
    expect(nested[1].props.collections).toEqual([
      { id: String(col._id), name: "Weddings", coverPublicId: "p0", itemCount: 1 },
    ]);
    findSpy.mockRestore();
  });
});
