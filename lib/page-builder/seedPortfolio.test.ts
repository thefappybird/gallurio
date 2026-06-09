import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace, GalleryCollection, GalleryItem } from "@/lib/db/models";
import {
  injectGalleryRefs,
  seedDefaultPortfolio,
  reseedPortfolioFromTemplate,
} from "./seedPortfolio";
import type { PortfolioPuckData } from "@/lib/page-builder/types";

let workspaceId: Types.ObjectId;

async function makeWorkspace(extra: Record<string, unknown> = {}) {
  const ws = await Workspace.create({
    slug: "studio",
    name: "Studio Aurora",
    ownerUserId: "user_owner",
    clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
    currency: "PHP",
    businessType: "photographer",
    ...extra,
  });
  workspaceId = ws._id;
  return ws;
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

describe("injectGalleryRefs", () => {
  it("seeds FeaturedWork itemIds as {id} rows and does NOT touch gallery blocks", () => {
    const data: PortfolioPuckData = {
      home: {
        content: [
          { type: "FeaturedWork", props: { id: "f1", itemIds: [] } },
          { type: "HeroPreset", props: { id: "h1" } },
        ],
        root: {},
      },
      gallery: {
        content: [{ type: "GalleryGrid", props: { id: "g1", images: [] } }],
        root: {},
      },
    };

    injectGalleryRefs(data, "col-123", ["a", "b", "c", "d"]);

    // FeaturedWork.itemIds filled with first 3 items
    expect(data.home!.content[0].props.itemIds).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
    // Gallery blocks are NOT touched — no collectionId is injected; images stays []
    expect(data.gallery!.content[0].props.images).toEqual([]);
    expect(data.gallery!.content[0].props).not.toHaveProperty("collectionId");
  });

  it("does not add or modify any prop on gallery blocks", () => {
    // Guard: injectGalleryRefs must never write collectionId, images, or any other
    // prop onto gallery blocks, regardless of what itemIds are passed.
    const galleryPropsBefore = { id: "g1", images: [] };
    const data: PortfolioPuckData = {
      home: null,
      gallery: { content: [{ type: "GalleryGrid", props: { ...galleryPropsBefore } }], root: {} },
    };
    injectGalleryRefs(data, "col-999", ["x", "y"]);
    expect(data.gallery!.content[0].props).toEqual(galleryPropsBefore);
  });
});

describe("seedDefaultPortfolio", () => {
  it("seeds the businessType-matched template when home is empty", async () => {
    await makeWorkspace();
    const seed = await seedDefaultPortfolio(workspaceId);
    expect(seed).toBeTruthy();
    // photographer → wedding-photographer default.
    expect(seed!.templateId).toBe("wedding-photographer");

    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.data!.home).toBeTruthy();
    expect(ws!.publicPage!.brandKit).toBeTruthy();
  });

  it("is idempotent — returns null and does not overwrite once home exists", async () => {
    await makeWorkspace({
      publicPage: { data: { home: { content: [{ type: "HeroPreset", props: {} }], root: {} }, gallery: null } },
    });
    const seed = await seedDefaultPortfolio(workspaceId);
    expect(seed).toBeNull();

    const ws = await Workspace.findById(workspaceId).lean();
    const home = ws!.publicPage!.data!.home as { content: unknown[] };
    expect(home.content).toHaveLength(1); // unchanged
  });

  it("seeded gallery blocks have empty images[] even when a featured-work collection exists", async () => {
    // The wedding-photographer template (photographer businessType) has no top-level
    // FeaturedWork block — FeaturedWork lives inside preset slot children that
    // injectGalleryRefs does not traverse. So even when a featured-work collection
    // exists, gallery blocks are seeded empty; the owner populates them in the editor.
    await makeWorkspace();
    const col = await GalleryCollection.create({
      workspaceId,
      name: "Featured work",
      slug: "featured-work",
      isPublic: true,
      order: 0,
    });
    await GalleryItem.create([
      { workspaceId, collectionId: col._id, cloudinaryPublicId: `gallurio/${workspaceId}/p/1.jpg`, url: "u1", order: 0 },
      { workspaceId, collectionId: col._id, cloudinaryPublicId: `gallurio/${workspaceId}/p/2.jpg`, url: "u2", order: 1 },
    ]);

    const seed = await seedDefaultPortfolio(workspaceId);
    // Gallery blocks bake images[] directly — no collectionId pointer is injected.
    const galleryBlocks = (seed!.data.gallery?.content ?? []).filter((b) => b.type.startsWith("Gallery"));
    expect(galleryBlocks.length).toBeGreaterThan(0);
    for (const b of galleryBlocks) {
      expect(b.props.images).toEqual([]);
      expect(b.props).not.toHaveProperty("collectionId");
    }
  });
});

describe("reseedPortfolioFromTemplate", () => {
  it("returns null for an unknown template", async () => {
    await makeWorkspace();
    const seed = await reseedPortfolioFromTemplate(workspaceId, "nope");
    expect(seed).toBeNull();
  });

  it("archives current data to previousData on switch", async () => {
    await makeWorkspace({
      publicPage: { data: { home: { content: [{ type: "HeroPreset", props: {} }], root: {} }, gallery: { content: [], root: {} } } },
    });
    const seed = await reseedPortfolioFromTemplate(workspaceId, "minimal");
    expect(seed!.templateId).toBe("minimal");

    const ws = await Workspace.findById(workspaceId).lean();
    const prev = ws!.publicPage!.previousData!.home as { content: unknown[] };
    expect(prev.content).toHaveLength(1);
  });
});
