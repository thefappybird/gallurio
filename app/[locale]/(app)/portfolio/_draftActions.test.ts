import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));
vi.mock("@/lib/page-builder/reconcile", () => ({
  reconcileGalleryImages: async (_wsId: string, data: unknown) => data,
  reconcileFeaturedCollections: async (_wsId: string, data: unknown) => data,
}));

let mockCtx: {
  userId: string;
  role: "owner" | "staff";
  workspace: { _id: Types.ObjectId; slug: string; plan: "free" | "starter" | "pro" };
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
import { PortfolioDraft, Workspace } from "@/lib/db/models";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import {
  createDraftAction,
  updateDraftAction,
  deleteDraftAction,
  listDraftsAction,
  getDraftAction,
  publishDraftAction,
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

function setWorkspace(plan: "free" | "starter" | "pro" = "free") {
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

  it("enforces the starter-plan cap of 15", async () => {
    setWorkspace("starter");
    for (let i = 0; i < 15; i++) {
      const r = await createDraftAction({ name: `S${i}`, ...snapshot });
      expect("ok" in r).toBe(true);
    }
    const res = await createDraftAction({ name: "S16", ...snapshot });
    expect(res).toEqual({ error: "draft_limit_reached:15" });
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
    const created = await createDraftAction({ name: "Bye", ...snapshot });
    if (!("ok" in created)) throw new Error("setup failed");
    const res = await deleteDraftAction(created.draft.id);
    expect(res).toEqual({ ok: true });
    expect(await PortfolioDraft.countDocuments({})).toBe(0);
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
    expect((ws!.publicPage!.data!.home as { content: unknown[] }).content.length).toBe(1);
  });

  it("rejects a draft from another workspace (tenant isolation)", async () => {
    const foreign = await PortfolioDraft.create({ workspaceId: new Types.ObjectId(), name: "F", ...snapshot });
    const res = await publishDraftAction(String(foreign._id));
    expect(res).toEqual({ error: "draft_not_found" });
  });
});
