import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace, GalleryCollection, GalleryItem } from "@/lib/db/models";
import {
  seedDefaultPortfolio,
  reseedPortfolioFromTemplate,
} from "./seedPortfolio";

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

  it("seeded gallery blocks have empty images[] even when collections exist", async () => {
    // Gallery blocks bake images[] directly (no collectionId pointer).
    // FeaturedWork blocks are seeded with empty collections[]; the owner populates them
    // via the editor's collections picker.
    await makeWorkspace();
    await GalleryCollection.create({
      workspaceId,
      name: "Featured work",
      slug: "featured-work",
      isPublic: true,
      order: 0,
    });
    await GalleryItem.create([
      { workspaceId, assetId: `gallurio/${workspaceId}/p/1.jpg`, url: "u1", order: 0 },
    ]);

    const seed = await seedDefaultPortfolio(workspaceId);
    // Gallery blocks bake images[] directly — no collectionId pointer is injected.
    const galleryBlocks = (seed!.data.gallery?.content ?? []).filter((b) => b.type.startsWith("Gallery"));
    expect(galleryBlocks.length).toBeGreaterThan(0);
    for (const b of galleryBlocks) {
      expect(b.props.images).toEqual([]);
      expect(b.props).not.toHaveProperty("collectionId");
    }
    // FeaturedWork blocks are seeded with empty collections[]
    const allContent = [
      ...(seed!.data.home?.content ?? []),
      ...(seed!.data.gallery?.content ?? []),
    ];
    const featuredBlocks = allContent.filter((b) => b.type === "FeaturedWork");
    for (const b of featuredBlocks) {
      expect(b.props.collections).toEqual([]);
      expect(b.props).not.toHaveProperty("itemIds");
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
