import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
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
import { Workspace } from "@/lib/db/models";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import {
  savePortfolioDraftAction,
  publishPortfolioAction,
  updateBrandKitAction,
  updateContactConfigAction,
} from "./_actions";

let workspaceId: Types.ObjectId;

const samplePuck = { content: [{ type: "Hero", props: { headline: "Hi" } }], root: {} };

async function seedWorkspace() {
  const ws = await Workspace.create({
    slug: "studio-aurora",
    name: "Studio Aurora",
    ownerUserId: "user_owner",
    clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
    currency: "PHP",
    publicPage: {
      data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
      latestVersion: 0,
    },
  });
  workspaceId = ws._id;
  mockCtx = { userId: "user_owner", role: "owner", workspace: { _id: ws._id, slug: "studio-aurora" } };
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  revalidatePath.mockClear();
  await seedWorkspace();
});

describe("savePortfolioDraftAction", () => {
  it("writes only the named zone and bumps latestVersion", async () => {
    const res = await savePortfolioDraftAction({ zone: "home", data: samplePuck });
    expect(res).toMatchObject({ ok: true });

    const ws = await Workspace.findById(workspaceId).lean();
    const home = ws!.publicPage!.data!.home as typeof samplePuck;
    const gallery = ws!.publicPage!.data!.gallery as typeof samplePuck;
    expect(home.content).toHaveLength(1);
    expect(gallery.content).toHaveLength(0); // untouched
    expect(ws!.publicPage!.latestVersion).toBe(1);
  });

  it("does not publish (publishedAt stays null)", async () => {
    await savePortfolioDraftAction({ zone: "gallery", data: samplePuck });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.publishedAt ?? null).toBeNull();
  });

  it("rejects invalid Puck data", async () => {
    const res = await savePortfolioDraftAction({
      zone: "home",
      data: { content: "not-an-array" } as never,
    });
    expect("error" in res).toBe(true);
  });

  it("rejects an unknown zone", async () => {
    const res = await savePortfolioDraftAction({ zone: "about" as never, data: samplePuck });
    expect("error" in res).toBe(true);
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await savePortfolioDraftAction({ zone: "home", data: samplePuck });
    expect(res).toEqual({ error: "owner_only" });
  });
});

describe("publishPortfolioAction", () => {
  it("flips publishedAt + lastPublishedAt and revalidates public routes", async () => {
    const res = await publishPortfolioAction();
    expect(res).toEqual({ ok: true });

    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.publishedAt).toBeTruthy();
    expect(ws!.publicPage!.lastPublishedAt).toBeTruthy();

    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/w/studio-aurora");
    expect(paths).toContain("/w/studio-aurora/gallery");
    expect(paths).toContain("/sitemap.xml");
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await publishPortfolioAction();
    expect(res).toEqual({ error: "owner_only" });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.publishedAt ?? null).toBeNull();
  });
});

describe("updateBrandKitAction", () => {
  it("persists a valid brand kit", async () => {
    const res = await updateBrandKitAction({ ...DEFAULT_BRAND_KIT, accentColor: "#abcdef" });
    expect(res).toEqual({ ok: true });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.brandKit!.accentColor).toBe("#abcdef");
  });

  it("rejects a malformed brand kit", async () => {
    const res = await updateBrandKitAction({ ...DEFAULT_BRAND_KIT, accentColor: "red" });
    expect("error" in res).toBe(true);
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await updateBrandKitAction(DEFAULT_BRAND_KIT);
    expect(res).toEqual({ error: "owner_only" });
  });
});

describe("updateContactConfigAction", () => {
  it("persists a valid contact config", async () => {
    const res = await updateContactConfigAction({
      title: "Say hi",
      description: "We reply fast",
      buttonStyle: "solid",
      buttonColor: "accent",
    });
    expect(res).toEqual({ ok: true });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.contact!.title).toBe("Say hi");
  });

  it("rejects an over-long title", async () => {
    const res = await updateContactConfigAction({ title: "x".repeat(200) });
    expect("error" in res).toBe(true);
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await updateContactConfigAction({ title: "x" });
    expect(res).toEqual({ error: "owner_only" });
  });
});
