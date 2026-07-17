import { afterAll, beforeAll, beforeEach, describe, it, expect } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";
import { resolveProviderEventTimestamp, applyOrderedWorkspaceUpdate } from "./webhookOrdering";

describe("resolveProviderEventTimestamp", () => {
  it("returns updated_at parsed as a Date when present", () => {
    const ts = resolveProviderEventTimestamp({ updated_at: "2026-08-01T00:00:00Z" });
    expect(ts).toEqual(new Date("2026-08-01T00:00:00Z"));
  });

  it("falls back to created_at when updated_at is absent", () => {
    const ts = resolveProviderEventTimestamp({ created_at: "2026-07-01T00:00:00Z" });
    expect(ts).toEqual(new Date("2026-07-01T00:00:00Z"));
  });

  it("returns null when neither updated_at nor created_at is present", () => {
    expect(resolveProviderEventTimestamp({ status: "active" })).toBeNull();
  });

  it("returns null when the timestamp string is unparseable", () => {
    expect(resolveProviderEventTimestamp({ updated_at: "not-a-date" })).toBeNull();
  });
});

describe("applyOrderedWorkspaceUpdate", () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  }, 120_000);

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it("applies the update and stamps lsLastEventAt when the workspace has never seen an event", async () => {
    const ws = await Workspace.create({
      slug: "ws-ordering-1",
      name: "Ordering WS",
      ownerUserId: "user_1",
      plan: "free",
    });

    const ts = new Date("2026-08-01T00:00:00Z");
    await applyOrderedWorkspaceUpdate({ _id: ws._id }, { plan: "pro" }, ts);

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsLastEventAt?.getTime()).toBe(ts.getTime());
  });

  it("skips the update when eventTimestamp is older than the workspace's lsLastEventAt (stale event)", async () => {
    const ws = await Workspace.create({
      slug: "ws-ordering-2",
      name: "Ordering WS 2",
      ownerUserId: "user_1",
      plan: "pro",
      lsLastEventAt: new Date("2026-08-05T00:00:00Z"),
    });

    const staleTs = new Date("2026-08-01T00:00:00Z");
    await applyOrderedWorkspaceUpdate({ _id: ws._id }, { plan: "free" }, staleTs);

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsLastEventAt?.getTime()).toBe(new Date("2026-08-05T00:00:00Z").getTime());
  });

  it("applies unconditionally without touching lsLastEventAt when eventTimestamp is null (degraded fallback)", async () => {
    const ws = await Workspace.create({
      slug: "ws-ordering-3",
      name: "Ordering WS 3",
      ownerUserId: "user_1",
      plan: "free",
      lsLastEventAt: new Date("2026-08-05T00:00:00Z"),
    });

    await applyOrderedWorkspaceUpdate({ _id: ws._id }, { plan: "pro" }, null);

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsLastEventAt?.getTime()).toBe(new Date("2026-08-05T00:00:00Z").getTime());
  });
});
