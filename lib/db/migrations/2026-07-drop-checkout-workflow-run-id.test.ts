import { afterAll, beforeAll, beforeEach, describe, it, expect } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "../models";
import { runDropCheckoutWorkflowRunId } from "./2026-07-drop-checkout-workflow-run-id";

describe("runDropCheckoutWorkflowRunId", () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  }, 120_000);

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it("unsets lsCheckoutWorkflowRunId from a workspace that still carries it", async () => {
    const ws = await Workspace.create({
      slug: "ws-migrate-1",
      name: "Migrate WS 1",
      ownerUserId: "user_1",
      plan: "free",
    });
    await Workspace.collection.updateOne(
      { _id: ws._id },
      { $set: { lsCheckoutWorkflowRunId: "run_stale_123" } }
    );

    const summary = await runDropCheckoutWorkflowRunId();
    expect(summary).toEqual({ matched: 1, updated: 1 });

    const after = await Workspace.collection.findOne({ _id: ws._id });
    expect(after).not.toHaveProperty("lsCheckoutWorkflowRunId");
  });

  it("dry-run reports what would change without writing", async () => {
    const ws = await Workspace.create({
      slug: "ws-migrate-2",
      name: "Migrate WS 2",
      ownerUserId: "user_1",
      plan: "free",
    });
    await Workspace.collection.updateOne(
      { _id: ws._id },
      { $set: { lsCheckoutWorkflowRunId: "run_stale_456" } }
    );

    const summary = await runDropCheckoutWorkflowRunId({ dryRun: true });
    expect(summary).toEqual({ matched: 1, updated: 0 });

    const stillThere = await Workspace.collection.findOne({ _id: ws._id });
    expect(stillThere).toHaveProperty("lsCheckoutWorkflowRunId", "run_stale_456");
  });

  it("is idempotent: a repeated apply finds nothing left to touch", async () => {
    const ws = await Workspace.create({
      slug: "ws-migrate-3",
      name: "Migrate WS 3",
      ownerUserId: "user_1",
      plan: "free",
    });
    await Workspace.collection.updateOne(
      { _id: ws._id },
      { $set: { lsCheckoutWorkflowRunId: "run_stale_789" } }
    );

    const first = await runDropCheckoutWorkflowRunId();
    expect(first).toEqual({ matched: 1, updated: 1 });

    const second = await runDropCheckoutWorkflowRunId();
    expect(second).toEqual({ matched: 0, updated: 0 });
  });
});
