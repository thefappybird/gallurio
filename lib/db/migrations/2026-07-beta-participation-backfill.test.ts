import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace, User } from "../models";
import { runBackfill } from "./2026-07-beta-participation-backfill";

describe("runBackfill", () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  }, 120_000);

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it("backfills betaParticipation for a beta-plan workspace owner missing it", async () => {
    const owner = await User.create({ workosUserId: "user_1", email: "owner1@test.com" });
    await Workspace.create({
      slug: "ws-beta-1",
      name: "Beta WS 1",
      ownerUserId: "user_1",
      plan: "beta",
    });

    const summary = await runBackfill();
    expect(summary).toEqual({
      workspacesFound: 1,
      distinctOwners: 1,
      updated: 1,
      skippedAlreadyRecorded: 0,
      ownersNotFound: [],
    });

    const updated = await User.findById(owner._id);
    expect(updated?.betaParticipation?.recordedAt).toBeInstanceOf(Date);
    expect(updated?.betaParticipation?.source).toBe("backfill");
  });

  it("is idempotent: a re-run does not touch an already-backfilled user", async () => {
    const owner = await User.create({ workosUserId: "user_1", email: "owner1@test.com" });
    await Workspace.create({
      slug: "ws-beta-1",
      name: "Beta WS 1",
      ownerUserId: "user_1",
      plan: "beta",
    });

    await runBackfill();
    const firstRecordedAt = (await User.findById(owner._id))?.betaParticipation?.recordedAt;

    const second = await runBackfill();
    expect(second).toEqual({
      workspacesFound: 1,
      distinctOwners: 1,
      updated: 0,
      skippedAlreadyRecorded: 1,
      ownersNotFound: [],
    });

    const afterSecond = await User.findById(owner._id);
    expect(afterSecond?.betaParticipation?.recordedAt?.getTime()).toBe(firstRecordedAt?.getTime());
  });

  it("dry-run reports what would change without writing", async () => {
    const owner = await User.create({ workosUserId: "user_1", email: "owner1@test.com" });
    await Workspace.create({
      slug: "ws-beta-1",
      name: "Beta WS 1",
      ownerUserId: "user_1",
      plan: "beta",
    });

    const summary = await runBackfill({ dryRun: true });
    expect(summary.updated).toBe(1);

    const stillUnrecorded = await User.findById(owner._id);
    expect(stillUnrecorded?.betaParticipation?.recordedAt).toBeNull();
  });

  it("logs an owner whose workosUserId has no matching User instead of crashing", async () => {
    await Workspace.create({
      slug: "ws-beta-orphan",
      name: "Beta WS Orphan",
      ownerUserId: "user_ghost",
      plan: "beta",
    });

    const summary = await runBackfill();
    expect(summary.workspacesFound).toBe(1);
    expect(summary.updated).toBe(0);
    expect(summary.ownersNotFound).toEqual(["user_ghost"]);
  });
});
