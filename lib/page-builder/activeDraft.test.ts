import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace, PortfolioDraft } from "@/lib/db/models";
import { DEFAULT_DRAFT_NAME } from "./drafts";
import { resolveActiveDraftId } from "./activeDraft";

async function makeWorkspace() {
  return Workspace.create({
    slug: `s-${Math.round(Math.random() * 1e9)}`,
    name: "Studio",
    ownerUserId: "u",
    clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
    currency: "PHP",
    plan: "free",
    publicPage: { data: { home: null, gallery: null }, latestVersion: 0 },
  });
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

describe("resolveActiveDraftId", () => {
  it("creates a minimal default draft when the workspace has none", async () => {
    const ws = await makeWorkspace();
    const draftId = await resolveActiveDraftId(ws._id);
    const drafts = await PortfolioDraft.find({ workspaceId: ws._id }).lean();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]._id.toString()).toBe(draftId.toString());
    expect(drafts[0].name).toBe(DEFAULT_DRAFT_NAME);
  });

  it("returns the most recently updated existing draft", async () => {
    const ws = await makeWorkspace();
    await PortfolioDraft.create({ workspaceId: ws._id, name: "Older" });
    const newer = await PortfolioDraft.create({ workspaceId: ws._id, name: "Newer" });

    const draftId = await resolveActiveDraftId(ws._id);
    expect(draftId.toString()).toBe(newer._id.toString());
  });

  it("handles the duplicate-key race by returning the already-created draft", async () => {
    const ws = await makeWorkspace();
    const raced = await PortfolioDraft.create({ workspaceId: ws._id, name: DEFAULT_DRAFT_NAME });

    const spy = vi.spyOn(PortfolioDraft, "findOne").mockImplementationOnce(() => {
      // Simulate the "no draft found" read racing a concurrent creator: report
      // no draft even though one now exists, forcing create() to hit the
      // unique-index race the function must recover from.
      return { sort: () => ({ select: () => ({ lean: async () => null }) }) } as never;
    });

    const draftId = await resolveActiveDraftId(ws._id);
    expect(draftId.toString()).toBe(raced._id.toString());
    expect(await PortfolioDraft.countDocuments({ workspaceId: ws._id })).toBe(1);

    spy.mockRestore();
  });
});
