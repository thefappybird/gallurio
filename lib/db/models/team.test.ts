import { describe, beforeAll, afterAll, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Team, ensureDefaultTeam, TEAM_COLOR_PALETTE } from "./team";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Ensure unique indexes are created in the in-memory server before tests run.
  await Team.createIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeWorkspaceId() {
  return new mongoose.Types.ObjectId();
}

describe("Team model", () => {
  it("creates a team with required fields and reads it back", async () => {
    const workspaceId = makeWorkspaceId();
    const created = await Team.create({
      workspaceId,
      name: "Alpha",
      color: TEAM_COLOR_PALETTE[1],
      createdByClerkUserId: "user_abc",
    });

    const found = await Team.findById(created._id).lean();
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Alpha");
    expect(found!.color).toBe(TEAM_COLOR_PALETTE[1]);
    expect(found!.workspaceId.toString()).toBe(workspaceId.toString());
    expect(found!.createdByClerkUserId).toBe("user_abc");
    expect(found!.isDefault).toBe(false);
    expect(found!.memberCount).toBe(0);
  });

  it("rejects a duplicate name within the same workspace", async () => {
    const workspaceId = makeWorkspaceId();
    await Team.create({
      workspaceId,
      name: "Duplicate",
      color: TEAM_COLOR_PALETTE[0],
      createdByClerkUserId: "user_x",
    });

    await expect(
      Team.create({
        workspaceId,
        name: "Duplicate",
        color: TEAM_COLOR_PALETTE[2],
        createdByClerkUserId: "user_y",
      })
    ).rejects.toThrow();
  });

  it("allows the same name in different workspaces", async () => {
    const wsA = makeWorkspaceId();
    const wsB = makeWorkspaceId();

    await Team.create({ workspaceId: wsA, name: "Shared", color: TEAM_COLOR_PALETTE[0], createdByClerkUserId: "u1" });
    const second = await Team.create({ workspaceId: wsB, name: "Shared", color: TEAM_COLOR_PALETTE[0], createdByClerkUserId: "u2" });

    expect(second._id).toBeDefined();
  });
});

describe("ensureDefaultTeam", () => {
  it("creates the Main team on first call", async () => {
    const workspaceId = makeWorkspaceId();
    const team = await ensureDefaultTeam(workspaceId, "user_owner");

    expect(team.name).toBe("Main");
    expect(team.isDefault).toBe(true);
    expect(team.color).toBe(TEAM_COLOR_PALETTE[0]);
    expect(team.workspaceId.toString()).toBe(workspaceId.toString());
    expect(team.createdByClerkUserId).toBe("user_owner");
  });

  it("is idempotent — second call returns the same _id, count stays at 1", async () => {
    const workspaceId = makeWorkspaceId();

    const first = await ensureDefaultTeam(workspaceId, "user_owner");
    const second = await ensureDefaultTeam(workspaceId, "user_owner");

    expect(second._id.toString()).toBe(first._id.toString());

    const count = await Team.countDocuments({ workspaceId, isDefault: true });
    expect(count).toBe(1);
  });
});

describe("Team tenant isolation", () => {
  it("a team in workspace A is not returned by a workspace B query", async () => {
    const wsA = makeWorkspaceId();
    const wsB = makeWorkspaceId();

    await Team.create({
      workspaceId: wsA,
      name: "Team A Secret",
      color: TEAM_COLOR_PALETTE[3],
      createdByClerkUserId: "user_a",
    });

    const found = await Team.findOne({ workspaceId: wsB, name: "Team A Secret" }).lean();
    expect(found).toBeNull();
  });
});
