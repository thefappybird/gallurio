import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

let mockCtx: { userId: string; role: "owner" | "staff"; workspace: { _id: Types.ObjectId; slug: string } };
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId: mockCtx.userId,
    clerkOrgId: "org_test",
    role: mockCtx.role,
    workspace: mockCtx.workspace,
  }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace, GalleryCollection, GalleryItem } from "@/lib/db/models";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import { saveWizardOutputAction, resetPortfolioAction, type SaveWizardInput } from "./_actions";

let workspaceId: Types.ObjectId;

async function seedWorkspace() {
  const ws = await Workspace.create({
    slug: "studio-aurora",
    name: "Studio Aurora",
    ownerUserId: "user_owner",
    clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
    currency: "PHP",
    branding: { tagline: "Light & shadow", description: "We chase good light." },
  });
  workspaceId = ws._id;
  mockCtx = { userId: "user_owner", role: "owner", workspace: { _id: ws._id, slug: "studio-aurora" } };
  return ws;
}

function makeInput(overrides: Partial<SaveWizardInput> = {}): SaveWizardInput {
  // cloudinaryPublicIds must be scoped to the caller's workspace folder.
  const wsId = workspaceId?.toHexString() ?? "placeholder";
  return {
    templateId: "wedding-photographer",
    brandKit: DEFAULT_BRAND_KIT,
    contact: { title: "Hi", description: "Reach out", buttonStyle: "solid", buttonColor: "accent" },
    branding: { tagline: "New tagline" },
    starterImages: [
      { cloudinaryPublicId: `gallurio/${wsId}/portfolio/1.jpg`, url: "https://res.cloudinary.com/x/1.jpg", width: 800, height: 600 },
      { cloudinaryPublicId: `gallurio/${wsId}/portfolio/2.jpg`, url: "https://res.cloudinary.com/x/2.jpg", width: 800, height: 600 },
    ],
    ...overrides,
  };
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  await seedWorkspace();
});

describe("saveWizardOutputAction", () => {
  it("seeds publicPage, creates the collection, and persists starter images", async () => {
    const res = await saveWizardOutputAction(makeInput());
    expect(res).toEqual({ ok: true });

    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws?.publicPage?.templateId).toBe("wedding-photographer");
    expect(ws?.publicPage?.data?.home).toBeTruthy();
    expect(ws?.publicPage?.data?.gallery).toBeTruthy();
    expect(ws?.publicPage?.brandKit?.themePreset).toBe(DEFAULT_BRAND_KIT.themePreset);
    expect(ws?.publicPage?.contact?.title).toBe("Hi");
    expect(ws?.branding?.tagline).toBe("New tagline");

    const collections = await GalleryCollection.find({ workspaceId }).lean();
    expect(collections).toHaveLength(1);
    expect(collections[0].slug).toBe("featured-work");
    expect(collections[0].coverItemId).toBeTruthy();

    const items = await GalleryItem.find({ workspaceId }).lean();
    expect(items).toHaveLength(2);
  });

  it("wires the created collection id into seeded gallery blocks", async () => {
    await saveWizardOutputAction(makeInput());
    const ws = await Workspace.findById(workspaceId).lean();
    const collection = await GalleryCollection.findOne({ workspaceId }).lean();

    const galleryBlocks = (ws!.publicPage!.data!.gallery as { content: { type: string; props: Record<string, unknown> }[] }).content;
    const galleryBlock = galleryBlocks.find((b) => b.type.startsWith("Gallery"));
    expect(galleryBlock?.props.collectionId).toBe(String(collection!._id));
  });

  it("seeds FeaturedWork itemIds as { id } rows from the uploaded images", async () => {
    await saveWizardOutputAction(makeInput());
    const ws = await Workspace.findById(workspaceId).lean();
    const home = ws!.publicPage!.data!.home as { content: { type: string; props: Record<string, unknown> }[] };
    const featured = home.content.find((b) => b.type === "FeaturedWork");
    const itemIds = featured?.props.itemIds as Array<{ id: string }>;
    expect(itemIds.length).toBeGreaterThan(0);
    // Editor round-trip shape: each row is a { id } object, not a bare string.
    expect(itemIds[0]).toEqual({ id: expect.any(String) });
  });

  it("reuses the existing featured-work collection on a second run (no duplicate)", async () => {
    await saveWizardOutputAction(makeInput());
    await saveWizardOutputAction(makeInput({ templateId: "minimal" }));

    const collections = await GalleryCollection.find({ workspaceId }).lean();
    expect(collections).toHaveLength(1);
    const items = await GalleryItem.find({ workspaceId }).lean();
    expect(items).toHaveLength(4); // appended, not replaced
  });

  it("archives existing portfolio data to previousData on re-run", async () => {
    await saveWizardOutputAction(makeInput()); // first run populates data.home
    await saveWizardOutputAction(makeInput({ templateId: "planner" }));

    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws?.publicPage?.previousData?.home).toBeTruthy();
    expect(ws?.publicPage?.templateId).toBe("planner");
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await saveWizardOutputAction(makeInput());
    expect(res).toEqual({ error: "owner_only" });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws?.publicPage?.data?.home).toBeFalsy();
  });

  it("rejects an unknown template id", async () => {
    const res = await saveWizardOutputAction(makeInput({ templateId: "nope" as never }));
    expect("error" in res).toBe(true);
  });

  it("works with zero starter images (collection created, no items)", async () => {
    const res = await saveWizardOutputAction(makeInput({ starterImages: [] }));
    expect(res).toEqual({ ok: true });
    expect(await GalleryItem.countDocuments({ workspaceId })).toBe(0);
    expect(await GalleryCollection.countDocuments({ workspaceId })).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Cross-tenant asset isolation (High severity regression tests)
  // -----------------------------------------------------------------------

  it("rejects a starterImage whose cloudinaryPublicId belongs to another workspace", async () => {
    const otherWorkspaceId = new Types.ObjectId().toHexString();
    const res = await saveWizardOutputAction(
      makeInput({
        starterImages: [
          {
            cloudinaryPublicId: `gallurio/${otherWorkspaceId}/portfolio/stolen.jpg`,
            url: "https://res.cloudinary.com/x/stolen.jpg",
          },
        ],
      })
    );
    expect(res).toEqual({ error: "invalid_image_ownership" });
    // Nothing written to DB
    expect(await GalleryItem.countDocuments({ workspaceId })).toBe(0);
  });

  it("accepts a starterImage whose cloudinaryPublicId is under the caller's workspace folder", async () => {
    const validPublicId = `gallurio/${workspaceId.toHexString()}/portfolio/mine.jpg`;
    const res = await saveWizardOutputAction(
      makeInput({
        starterImages: [
          {
            cloudinaryPublicId: validPublicId,
            url: "https://res.cloudinary.com/x/mine.jpg",
            width: 800,
            height: 600,
          },
        ],
      })
    );
    expect(res).toEqual({ ok: true });
    const item = await GalleryItem.findOne({ workspaceId }).lean();
    expect(item?.cloudinaryPublicId).toBe(validPublicId);
  });

  it("rejects a branding.logoCloudinaryPublicId that belongs to another workspace", async () => {
    const otherWorkspaceId = new Types.ObjectId().toHexString();
    const res = await saveWizardOutputAction(
      makeInput({
        branding: {
          tagline: "hello",
          logoUrl: "https://res.cloudinary.com/x/logo.jpg",
          logoCloudinaryPublicId: `gallurio/${otherWorkspaceId}/logos/logo.jpg`,
        },
        starterImages: [],
      })
    );
    expect(res).toEqual({ error: "invalid_logo_ownership" });
  });

  it("rejects a cloudinaryPublicId with a path-traversal prefix that looks like another workspace", async () => {
    // e.g. gallurio/<workspaceId>/../<otherWorkspaceId>/file
    const ownId = workspaceId.toHexString();
    const otherWorkspaceId = new Types.ObjectId().toHexString();
    const res = await saveWizardOutputAction(
      makeInput({
        starterImages: [
          {
            cloudinaryPublicId: `gallurio/${ownId}/../${otherWorkspaceId}/portfolio/escape.jpg`,
            url: "https://res.cloudinary.com/x/escape.jpg",
          },
        ],
      })
    );
    // Cloudinary public IDs don't do path resolution, but we still reject because
    // the string does not start with the expected prefix after normalization —
    // the `..` makes the prefix check fail naturally.
    expect(res).toEqual({ error: "invalid_image_ownership" });
  });
});

describe("resetPortfolioAction", () => {
  it("archives current data and nulls home so the wizard re-runs", async () => {
    await saveWizardOutputAction(makeInput());
    const res = await resetPortfolioAction();
    expect(res).toEqual({ ok: true });

    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws?.publicPage?.data?.home).toBeNull();
    expect(ws?.publicPage?.previousData?.home).toBeTruthy();
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await resetPortfolioAction();
    expect(res).toEqual({ error: "owner_only" });
  });
});
