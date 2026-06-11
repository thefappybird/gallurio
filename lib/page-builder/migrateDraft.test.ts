import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace, PortfolioDraft } from "@/lib/db/models";
import { ensureLegacyDraftMigrated } from "./migrateDraft";

async function makeWorkspace(home: unknown) {
  return Workspace.create({
    slug: `s-${Math.round(Math.random() * 1e9)}`,
    name: "Studio",
    ownerUserId: "u",
    clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
    currency: "PHP",
    plan: "free",
    publicPage: { data: { home, gallery: null }, latestVersion: 0 },
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

describe("ensureLegacyDraftMigrated", () => {
  it("creates one 'New Draft' from existing publicPage.data", async () => {
    const ws = await makeWorkspace({ content: [{ type: "HeroPreset", props: { id: "h" } }], root: {} });
    await ensureLegacyDraftMigrated(ws._id);
    const drafts = await PortfolioDraft.find({ workspaceId: ws._id }).lean();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].name).toBe("New Draft");
  });

  it("is idempotent — running twice does not duplicate", async () => {
    const ws = await makeWorkspace({ content: [], root: {} });
    await ensureLegacyDraftMigrated(ws._id);
    await ensureLegacyDraftMigrated(ws._id);
    expect(await PortfolioDraft.countDocuments({ workspaceId: ws._id })).toBe(1);
  });

  it("no-ops when publicPage.data is empty", async () => {
    const ws = await makeWorkspace(null);
    await ensureLegacyDraftMigrated(ws._id);
    expect(await PortfolioDraft.countDocuments({ workspaceId: ws._id })).toBe(0);
  });
});
