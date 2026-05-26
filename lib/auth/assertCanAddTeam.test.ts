import { describe, beforeAll, afterAll, it, expect } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";
import { assertCanAddTeam, TeamCapExceededError } from "./assertCanAddTeam";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeWorkspaceId() {
  return new mongoose.Types.ObjectId();
}

async function seedTeams(workspaceId: mongoose.Types.ObjectId, count: number) {
  for (let i = 0; i < count; i++) {
    await Team.create({
      workspaceId,
      name: `Team ${i + 1}`,
      color: TEAM_COLOR_PALETTE[i % TEAM_COLOR_PALETTE.length],
      createdByClerkUserId: "user_seed",
    });
  }
}

describe("assertCanAddTeam — free plan (max 1)", () => {
  it("resolves when workspace has 0 teams", async () => {
    const workspaceId = makeWorkspaceId();
    await expect(assertCanAddTeam(workspaceId, "free")).resolves.toBeUndefined();
  });

  it("throws TeamCapExceededError when already at 1 team", async () => {
    const workspaceId = makeWorkspaceId();
    await seedTeams(workspaceId, 1);

    const err = await assertCanAddTeam(workspaceId, "free").catch((e) => e);
    expect(err).toBeInstanceOf(TeamCapExceededError);
    expect(err.plan).toBe("free");
    expect(err.currentCount).toBe(1);
    expect(err.max).toBe(1);
    expect(err.message).toContain("free");
    expect(err.name).toBe("TeamCapExceededError");
  });
});

describe("assertCanAddTeam — starter plan (max 3)", () => {
  it("resolves when workspace has 2 teams", async () => {
    const workspaceId = makeWorkspaceId();
    await seedTeams(workspaceId, 2);
    await expect(assertCanAddTeam(workspaceId, "starter")).resolves.toBeUndefined();
  });

  it("throws TeamCapExceededError when already at 3 teams", async () => {
    const workspaceId = makeWorkspaceId();
    await seedTeams(workspaceId, 3);

    const err = await assertCanAddTeam(workspaceId, "starter").catch((e) => e);
    expect(err).toBeInstanceOf(TeamCapExceededError);
    expect(err.plan).toBe("starter");
    expect(err.currentCount).toBe(3);
    expect(err.max).toBe(3);
  });
});

describe("assertCanAddTeam — pro plan (max 15)", () => {
  it("resolves when workspace has 14 teams", async () => {
    const workspaceId = makeWorkspaceId();
    await seedTeams(workspaceId, 14);
    await expect(assertCanAddTeam(workspaceId, "pro")).resolves.toBeUndefined();
  });

  it("throws TeamCapExceededError when already at 15 teams", async () => {
    const workspaceId = makeWorkspaceId();
    await seedTeams(workspaceId, 15);

    const err = await assertCanAddTeam(workspaceId, "pro").catch((e) => e);
    expect(err).toBeInstanceOf(TeamCapExceededError);
    expect(err.plan).toBe("pro");
    expect(err.currentCount).toBe(15);
    expect(err.max).toBe(15);
  });

  it("resolves at 0 teams (edge: fresh pro workspace)", async () => {
    const workspaceId = makeWorkspaceId();
    await expect(assertCanAddTeam(workspaceId, "pro")).resolves.toBeUndefined();
  });
});

describe("TeamCapExceededError", () => {
  it("inherits from Error and sets all fields correctly", () => {
    const err = new TeamCapExceededError("starter", 3, 3);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TeamCapExceededError);
    expect(err.name).toBe("TeamCapExceededError");
    expect(err.plan).toBe("starter");
    expect(err.currentCount).toBe(3);
    expect(err.max).toBe(3);
    expect(err.message).toMatch(/starter/);
    expect(err.message).toMatch(/3\/3/);
  });
});
