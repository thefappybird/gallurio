import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));
// Passthrough stub — this suite tests publish plumbing, not reconcile correctness (reconcile has its own tests).
vi.mock("@/lib/page-builder/reconcile", () => ({
  reconcileGalleryImages: async (_wsId: string, data: unknown) => data,
  reconcileFeaturedCollections: async (_wsId: string, data: unknown) => data,
}));
vi.mock("@/lib/storage/cloudflareImages", () => ({
  deleteImage: vi.fn().mockResolvedValue(undefined),
  verifyImageOwnership: vi.fn().mockResolvedValue(true),
  updateImageMetadata: vi.fn().mockResolvedValue(undefined),
  imageDeliveryUrl: (id: string) => `https://imagedelivery.net/hash/${id}/public`,
  // Mirror the real constant — the demo-import path passes it to
  // verifyImageOwnership to demand the asset be a DEMO upload, not a tenant's.
  DEMO_UPLOAD_SUBFOLDER: "portfolio-maker-demo",
}));

let mockCtx: {
  userId: string;
  role: "owner" | "staff";
  workspace: { _id: Types.ObjectId; slug: string; plan: "free" | "pro" | "beta" };
};
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId: mockCtx.userId,
    clerkOrgId: "org_test",
    role: mockCtx.role,
    workspace: mockCtx.workspace,
  }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { deleteImage, verifyImageOwnership, updateImageMetadata } from "@/lib/storage/cloudflareImages";
import { PortfolioDraft, Workspace, GalleryItem } from "@/lib/db/models";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import {
  createDraftAction,
  updateDraftAction,
  deleteDraftAction,
  listDraftsAction,
  getDraftAction,
  publishDraftAction,
  importDemoPortfolioAction,
} from "./_draftActions";

const snapshot = {
  templateId: "minimal",
  data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
  brandKit: DEFAULT_BRAND_KIT,
  contact: {},
  header: {},
  collectionsPopup: {},
  formLocale: "",
};

function setWorkspace(plan: "free" | "pro" | "beta" = "free") {
  mockCtx = {
    userId: "user_owner",
    role: "owner",
    workspace: { _id: new Types.ObjectId(), slug: "studio-aurora", plan },
  };
}

beforeAll(async () => {
  await startInMemoryMongo();
  await PortfolioDraft.createIndexes();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  revalidatePath.mockClear();
  vi.mocked(deleteImage).mockClear();
  vi.mocked(verifyImageOwnership).mockClear();
  vi.mocked(updateImageMetadata).mockClear();
  setWorkspace();
});

describe("createDraftAction", () => {
  it("creates a draft and returns a summary", async () => {
    const res = await createDraftAction({ name: "My Draft", ...snapshot });
    expect("ok" in res && res.ok).toBe(true);
    const count = await PortfolioDraft.countDocuments({ workspaceId: mockCtx.workspace._id });
    expect(count).toBe(1);
  });

  it("rejects an empty name with name_required", async () => {
    const res = await createDraftAction({ name: "  ", ...snapshot });
    expect(res).toEqual({ error: "name_required" });
  });

  it("rejects a duplicate name with name_taken", async () => {
    await createDraftAction({ name: "Dupe", ...snapshot });
    const res = await createDraftAction({ name: "Dupe", ...snapshot });
    expect(res).toEqual({ error: "name_taken" });
  });

  it("enforces the free-plan cap of 5", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await createDraftAction({ name: `D${i}`, ...snapshot });
      expect("ok" in r).toBe(true);
    }
    const res = await createDraftAction({ name: "D6", ...snapshot });
    expect(res).toEqual({ error: "draft_limit_reached:5" });
  });

  it("lets pro create past 15 (unlimited)", async () => {
    setWorkspace("pro");
    for (let i = 0; i < 16; i++) {
      const r = await createDraftAction({ name: `P${i}`, ...snapshot });
      expect("ok" in r).toBe(true);
    }
  });

  it("blocks staff (owner_only)", async () => {
    mockCtx.role = "staff";
    const res = await createDraftAction({ name: "X", ...snapshot });
    expect(res).toEqual({ error: "owner_only" });
  });
});

describe("updateDraftAction", () => {
  it("updates by id and keeps the same name (no false name_taken)", async () => {
    const created = await createDraftAction({ name: "Keep", ...snapshot });
    if (!("ok" in created)) throw new Error("setup failed");
    const res = await updateDraftAction({ id: created.draft.id, name: "Keep", ...snapshot });
    expect("ok" in res && res.ok).toBe(true);
  });

  it("rejects renaming onto another draft's name (name_taken)", async () => {
    await createDraftAction({ name: "Taken", ...snapshot });
    const b = await createDraftAction({ name: "B", ...snapshot });
    if (!("ok" in b)) throw new Error("setup failed");
    const res = await updateDraftAction({ id: b.draft.id, name: "Taken", ...snapshot });
    expect(res).toEqual({ error: "name_taken" });
  });

  it("cannot update another workspace's draft (tenant isolation)", async () => {
    const otherWs = new Types.ObjectId();
    const foreign = await PortfolioDraft.create({ workspaceId: otherWs, name: "Foreign", ...snapshot });
    const res = await updateDraftAction({ id: String(foreign._id), name: "Hijacked", ...snapshot });
    expect(res).toEqual({ error: "draft_not_found" });
    const still = await PortfolioDraft.findById(foreign._id).lean();
    expect(still!.name).toBe("Foreign");
  });
});

describe("deleteDraftAction", () => {
  it("deletes only within the workspace", async () => {
    await createDraftAction({ name: "Keep", ...snapshot });
    const created = await createDraftAction({ name: "Bye", ...snapshot });
    if (!("ok" in created)) throw new Error("setup failed");
    const res = await deleteDraftAction(created.draft.id);
    expect(res).toEqual({ ok: true });
    expect(await PortfolioDraft.countDocuments({ workspaceId: mockCtx.workspace._id })).toBe(1);
  });

  it("does not delete the last draft in the workspace", async () => {
    const created = await createDraftAction({ name: "Only", ...snapshot });
    if (!("ok" in created)) throw new Error("setup failed");
    const res = await deleteDraftAction(created.draft.id);
    expect(res).toEqual({ error: "last_draft" });
    expect(await PortfolioDraft.countDocuments({ workspaceId: mockCtx.workspace._id })).toBe(1);
  });

  it("cannot delete another workspace's draft (tenant isolation)", async () => {
    const otherWs = new Types.ObjectId();
    const foreign = await PortfolioDraft.create({ workspaceId: otherWs, name: "Foreign", ...snapshot });
    const res = await deleteDraftAction(String(foreign._id));
    expect(res).toEqual({ ok: true });
    expect(await PortfolioDraft.findById(foreign._id).lean()).not.toBeNull();
  });
});

describe("listDraftsAction / getDraftAction", () => {
  it("lists summaries newest-first and loads a full draft", async () => {
    await createDraftAction({ name: "First", ...snapshot });
    const second = await createDraftAction({ name: "Second", ...snapshot });
    if (!("ok" in second)) throw new Error("setup failed");

    const list = await listDraftsAction();
    expect(list.map((d) => d.name)).toEqual(["Second", "First"]);

    const full = await getDraftAction(second.draft.id);
    expect("ok" in full && full.ok).toBe(true);
    if ("ok" in full) expect(full.draft.brandKit).toBeTruthy();
  });
});

describe("publishDraftAction", () => {
  it("copies the draft into publicPage and stamps publishedAt", async () => {
    await Workspace.create({
      _id: mockCtx.workspace._id,
      slug: "studio-aurora",
      name: "Studio Aurora",
      ownerUserId: "user_owner",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
      plan: "free",
      publicPage: { data: { home: null, gallery: null }, latestVersion: 0 },
    });
    const created = await createDraftAction({
      name: "Live",
      ...snapshot,
      data: { home: { content: [{ type: "HeroPreset", props: { id: "h" } }], root: {} }, gallery: { content: [], root: {} } },
    });
    if (!("ok" in created)) throw new Error("setup failed");

    const res = await publishDraftAction(created.draft.id);
    expect(res).toEqual({ ok: true });

    const ws = await Workspace.findById(mockCtx.workspace._id).lean();
    expect(ws!.publicPage!.publishedAt).toBeInstanceOf(Date);
    expect(ws!.publicPage!.lastPublishedAt).toBeInstanceOf(Date);
    expect((ws!.publicPage!.data!.home as { content: unknown[] }).content.length).toBe(1);
  });

  it("rejects a draft from another workspace (tenant isolation)", async () => {
    const foreign = await PortfolioDraft.create({ workspaceId: new Types.ObjectId(), name: "F", ...snapshot });
    const res = await publishDraftAction(String(foreign._id));
    expect(res).toEqual({ error: "draft_not_found" });
  });

  it("overlays workspace settingsDraft seo/media fields onto publicPage during publish", async () => {
    await Workspace.create({
      _id: mockCtx.workspace._id,
      slug: "studio-aurora",
      name: "Studio Aurora",
      ownerUserId: "user_owner",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
      plan: "free",
      publicPage: {
        data: { home: null, gallery: null },
        latestVersion: 0,
        settingsDraft: {
          seoTitle: "Settings Draft Title",
          seoDescription: "Settings draft description.",
          siteIcon: { url: "https://imagedelivery.net/h/settings-icon/public", assetId: "settings-icon-1" },
          seo: {
            keywords: ["settings", "override"],
            ogImageUrl: "https://imagedelivery.net/h/settings-og/public",
            ogImageAssetId: "settings-og-1",
            galleryDescription: "Settings gallery copy",
            noindex: false,
          },
        },
      },
    });
    const draft = await PortfolioDraft.create({
      workspaceId: mockCtx.workspace._id,
      name: "SEO Draft",
      ...snapshot,
      seoTitle: "Draft Title Should Be Overridden",
      seoDescription: "Draft description should be overridden.",
      siteIcon: { url: "https://imagedelivery.net/h/icon/public", assetId: "icon-1" },
      seo: {
        ogImageUrl: "https://imagedelivery.net/h/og/public",
        ogImageAssetId: "og-1",
        galleryDescription: "Our gallery",
        noindex: true,
        keywords: ["wedding", "bali"],
      },
    });

    const res = await publishDraftAction(String(draft._id));
    expect(res).toEqual({ ok: true });

      const ws = await Workspace.findById(mockCtx.workspace._id).lean();
    expect(ws!.publicPage!.seoTitle).toBe("Settings Draft Title");
    expect(ws!.publicPage!.seoDescription).toBe("Settings draft description.");
    expect(ws!.publicPage!.siteIcon?.url).toBe("https://imagedelivery.net/h/settings-icon/public");
    expect(ws!.publicPage!.siteIcon?.assetId).toBe("settings-icon-1");
    expect(ws!.publicPage!.seo?.ogImageUrl).toBe("https://imagedelivery.net/h/settings-og/public");
    expect(ws!.publicPage!.seo?.ogImageAssetId).toBe("settings-og-1");
    expect(ws!.publicPage!.seo?.galleryDescription).toBe("Settings gallery copy");
    expect(ws!.publicPage!.seo?.noindex).toBe(false);
    expect(ws!.publicPage!.seo?.keywords).toEqual(["settings", "override"]);
  });

  it("settingsDraft.logo overrides the draft's header logo when publishing", async () => {
    await Workspace.create({
      _id: mockCtx.workspace._id,
      slug: "studio-aurora",
      name: "Studio Aurora",
      ownerUserId: "user_owner",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
      plan: "free",
      publicPage: {
        data: { home: null, gallery: null },
        latestVersion: 0,
        settingsDraft: {
          logo: { url: "https://imagedelivery.net/h/settings-logo/public", assetId: "settings-logo-1" },
        },
      },
    });
    const draft = await PortfolioDraft.create({
      workspaceId: mockCtx.workspace._id,
      name: "Logo Draft",
      ...snapshot,
      header: { logoUrl: "https://imagedelivery.net/h/draft-logo/public", logoAssetId: "draft-logo-1" },
    });

    const res = await publishDraftAction(String(draft._id));
    expect(res).toEqual({ ok: true });

    const ws = await Workspace.findById(mockCtx.workspace._id).lean();
    expect(ws!.publicPage!.header?.logoUrl).toBe("https://imagedelivery.net/h/settings-logo/public");
    expect(ws!.publicPage!.header?.logoAssetId).toBe("settings-logo-1");
  });

  it("deletes the superseded live OG image when publish promotes a different one", async () => {
    await Workspace.create({
      _id: mockCtx.workspace._id,
      slug: "studio-aurora",
      name: "Studio Aurora",
      ownerUserId: "user_owner",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
      plan: "free",
      publicPage: {
        data: { home: null, gallery: null },
        latestVersion: 0,
        seo: { ogImageAssetId: "live-og-1" },
        settingsDraft: {
          seo: { ogImageUrl: "https://imagedelivery.net/h/new-og/public", ogImageAssetId: "new-og-1" },
        },
      },
    });
    const draft = await PortfolioDraft.create({
      workspaceId: mockCtx.workspace._id,
      name: "OG Draft",
      ...snapshot,
    });

    const res = await publishDraftAction(String(draft._id));
    expect(res).toEqual({ ok: true });
    expect(vi.mocked(deleteImage)).toHaveBeenCalledWith("live-og-1");
  });

  it("deletes the superseded live site icon when publish promotes a different one", async () => {
    await Workspace.create({
      _id: mockCtx.workspace._id,
      slug: "studio-aurora",
      name: "Studio Aurora",
      ownerUserId: "user_owner",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
      plan: "free",
      publicPage: {
        data: { home: null, gallery: null },
        latestVersion: 0,
        siteIcon: { assetId: "live-icon-1" },
        settingsDraft: {
          siteIcon: { url: "https://imagedelivery.net/h/new-icon/public", assetId: "new-icon-1" },
        },
      },
    });
    const draft = await PortfolioDraft.create({
      workspaceId: mockCtx.workspace._id,
      name: "Icon Draft",
      ...snapshot,
    });

    const res = await publishDraftAction(String(draft._id));
    expect(res).toEqual({ ok: true });
    expect(vi.mocked(deleteImage)).toHaveBeenCalledWith("live-icon-1");
  });

  it("propagates the staged header logo on publish even when the draft's own header is null, without wrongly deleting the still-referenced live logo", async () => {
    await Workspace.create({
      _id: mockCtx.workspace._id,
      slug: "studio-aurora",
      name: "Studio Aurora",
      ownerUserId: "user_owner",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
      plan: "free",
      publicPage: {
        data: { home: null, gallery: null },
        latestVersion: 0,
        header: { logoUrl: "https://imagedelivery.net/h/live-logo/public", logoAssetId: "live-logo-1" },
        settingsDraft: {
          logo: { url: "https://imagedelivery.net/h/live-logo/public", assetId: "live-logo-1" },
        },
      },
    });
    const draft = await PortfolioDraft.create({
      workspaceId: mockCtx.workspace._id,
      name: "Null Header Draft",
      ...snapshot,
      header: null,
    });

    const res = await publishDraftAction(String(draft._id));
    expect(res).toEqual({ ok: true });

    const ws = await Workspace.findById(mockCtx.workspace._id).lean();
    expect(ws!.publicPage!.header?.logoAssetId).toBe("live-logo-1");
    expect(vi.mocked(deleteImage)).not.toHaveBeenCalledWith("live-logo-1");
  });

  it("clears the header logo on publish when settingsDraft.logo was explicitly removed (assetId cleared to empty)", async () => {
    await Workspace.create({
      _id: mockCtx.workspace._id,
      slug: "studio-aurora",
      name: "Studio Aurora",
      ownerUserId: "user_owner",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
      plan: "free",
      publicPage: {
        data: { home: null, gallery: null },
        latestVersion: 0,
        header: { logoUrl: "https://imagedelivery.net/h/live-logo/public", logoAssetId: "live-logo-1" },
        settingsDraft: {
          logo: { url: "", assetId: "" },
        },
      },
    });
    const draft = await PortfolioDraft.create({
      workspaceId: mockCtx.workspace._id,
      name: "Removed Logo Draft",
      ...snapshot,
      header: { logoUrl: "https://imagedelivery.net/h/draft-logo/public", logoAssetId: "draft-logo-1" },
    });

    const res = await publishDraftAction(String(draft._id));
    expect(res).toEqual({ ok: true });

    const ws = await Workspace.findById(mockCtx.workspace._id).lean();
    expect(ws!.publicPage!.header?.logoUrl).toBe("");
    expect(ws!.publicPage!.header?.logoAssetId).toBe("");
    expect(vi.mocked(deleteImage)).toHaveBeenCalledWith("live-logo-1");
  });

  it("deletes the superseded live logo when settingsDraft.logo promotes a different one", async () => {
    await Workspace.create({
      _id: mockCtx.workspace._id,
      slug: "studio-aurora",
      name: "Studio Aurora",
      ownerUserId: "user_owner",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
      plan: "free",
      publicPage: {
        data: { home: null, gallery: null },
        latestVersion: 0,
        header: { logoAssetId: "live-logo-1" },
        settingsDraft: {
          logo: { url: "https://imagedelivery.net/h/new-logo/public", assetId: "new-logo-1" },
        },
      },
    });
    const draft = await PortfolioDraft.create({
      workspaceId: mockCtx.workspace._id,
      name: "Logo Draft 2",
      ...snapshot,
      header: { logoUrl: "https://imagedelivery.net/h/draft-logo/public", logoAssetId: "draft-logo-1" },
    });

    const res = await publishDraftAction(String(draft._id));
    expect(res).toEqual({ ok: true });
    expect(vi.mocked(deleteImage)).toHaveBeenCalledWith("live-logo-1");
  });
});

describe("importDemoPortfolioAction", () => {
  // Demo sessions are crypto.randomUUID() (lib/page-builder/demoSession.ts).
  const DEMO_SESSION = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  const demoInput = {
    demoSessionId: DEMO_SESSION,
    draft: snapshot,
    images: [{ publicId: "demo-img-1", width: 800, height: 600 }],
  };

  it("re-parents a verified demo asset, creates a GalleryItem, and lands a new named draft", async () => {
    const res = await importDemoPortfolioAction(demoInput);
    expect("ok" in res && res.ok).toBe(true);
    if (!("ok" in res)) throw new Error("expected ok");
    expect(res.draft.name).toBe("Demo portfolio");
    expect(res.failedAssetIds).toEqual([]);

    expect(vi.mocked(verifyImageOwnership)).toHaveBeenCalledWith(
      "demo-img-1",
      DEMO_SESSION,
      "portfolio-maker-demo"
    );
    expect(vi.mocked(updateImageMetadata)).toHaveBeenCalledWith("demo-img-1", {
      workspaceId: String(mockCtx.workspace._id),
      subfolder: "gallery",
    });

    const item = await GalleryItem.findOne({ workspaceId: mockCtx.workspace._id, assetId: "demo-img-1" }).lean();
    expect(item).not.toBeNull();
    expect(item!.width).toBe(800);
  });

  // The demoSessionId is client-supplied and is compared against the asset's
  // Cloudflare `workspaceId` metadata. If any string were accepted, a caller
  // could pass a VICTIM WORKSPACE's ObjectId plus a publicId harvested from
  // that workspace's public portfolio, pass the ownership check, and have the
  // asset re-parented into their own workspace. Constraining the shape to a
  // UUID makes a 24-hex ObjectId unrepresentable.
  it("rejects a demoSessionId shaped like a workspace id, before any Cloudflare call", async () => {
    const res = await importDemoPortfolioAction({
      ...demoInput,
      demoSessionId: String(mockCtx.workspace._id),
    });

    expect(res).toEqual({ error: "invalid_data" });
    expect(vi.mocked(verifyImageOwnership)).not.toHaveBeenCalled();
    expect(vi.mocked(updateImageMetadata)).not.toHaveBeenCalled();
  });

  it("refuses to adopt an asset that does not belong to the claimed demo session (tenancy attack), but still lands the page", async () => {
    vi.mocked(verifyImageOwnership).mockResolvedValueOnce(false);

    const res = await importDemoPortfolioAction(demoInput);
    expect("ok" in res && res.ok).toBe(true);
    if (!("ok" in res)) throw new Error("expected ok");
    expect(res.failedAssetIds).toEqual(["demo-img-1"]);

    expect(vi.mocked(updateImageMetadata)).not.toHaveBeenCalled();
    const item = await GalleryItem.findOne({ workspaceId: mockCtx.workspace._id, assetId: "demo-img-1" }).lean();
    expect(item).toBeNull();
  });

  it("is idempotent: retrying the same claim does not duplicate the GalleryItem row", async () => {
    await importDemoPortfolioAction(demoInput);
    await importDemoPortfolioAction({ ...demoInput, draft: { ...snapshot } });

    const items = await GalleryItem.find({ workspaceId: mockCtx.workspace._id, assetId: "demo-img-1" }).lean();
    expect(items).toHaveLength(1);
  });

  it("blocks staff (owner_only)", async () => {
    mockCtx.role = "staff";
    const res = await importDemoPortfolioAction(demoInput);
    expect(res).toEqual({ error: "owner_only" });
  });

  it("never persists a client-supplied url — the stored URL is always derived from the verified publicId", async () => {
    const hostileInput = {
      ...demoInput,
      images: [
        {
          publicId: "demo-img-1",
          url: "javascript:alert(1)//https://evil.example/x",
          width: 800,
          height: 600,
        },
      ],
    };

    const res = await importDemoPortfolioAction(hostileInput);
    expect("ok" in res && res.ok).toBe(true);

    const item = await GalleryItem.findOne({ workspaceId: mockCtx.workspace._id, assetId: "demo-img-1" }).lean();
    expect(item!.url).toBe("https://imagedelivery.net/hash/demo-img-1/public");
  });

  it("auto-dedupes the draft name when 'Demo portfolio' already exists", async () => {
    await createDraftAction({ name: "Demo portfolio", ...snapshot });
    const res = await importDemoPortfolioAction(demoInput);
    expect("ok" in res && res.ok).toBe(true);
    if ("ok" in res) expect(res.draft.name).toBe("Demo portfolio (2)");
  });
});
