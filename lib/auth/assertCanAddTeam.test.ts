import { describe, beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";
import {
  assertCanAddTeam,
  createTeamWithCapEnforcement,
  TeamCapExceededError,
} from "./assertCanAddTeam";

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
      createdByWorkosUserId: "user_seed",
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

describe("createTeamWithCapEnforcement — atomic cap guard", () => {
  beforeEach(async () => {
    await Team.deleteMany({});
  });

  it("creates a team when under cap", async () => {
    const workspaceId = makeWorkspaceId();
    const team = await createTeamWithCapEnforcement(
      {
        workspaceId,
        name: "Crew A",
        color: TEAM_COLOR_PALETTE[0],
        isDefault: false,
        memberCount: 0,
        createdByWorkosUserId: "user_test",
      },
      "pro",
    );
    expect(team).toBeTruthy();
    expect(await Team.countDocuments({ workspaceId })).toBe(1);
  });

  it("rejects and rolls back the row when two concurrent creates race past the cap", async () => {
    const workspaceId = makeWorkspaceId();
    // Pre-seed the workspace right under the free-plan cap of 1.
    // Two concurrent creates from here must result in exactly 1 success
    // and exactly 1 cap-exceeded rejection, with at most 1 team in the DB
    // (the original seeded one). The race-loser's row must be rolled back.
    await seedTeams(workspaceId, 0);

    const make = (name: string) =>
      createTeamWithCapEnforcement(
        {
          workspaceId,
          name,
          color: TEAM_COLOR_PALETTE[0],
          isDefault: false,
          memberCount: 0,
          createdByWorkosUserId: "user_test",
        },
        "free",
      );

    const results = await Promise.allSettled([make("Race A"), make("Race B")]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      TeamCapExceededError,
    );

    // Exactly one team in the DB — the race-loser's insert was rolled back.
    expect(await Team.countDocuments({ workspaceId })).toBe(1);
  });
});

describe("TeamCapExceededError", () => {
  it("inherits from Error and sets all fields correctly", () => {
    const err = new TeamCapExceededError("pro", 3, 3);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TeamCapExceededError);
    expect(err.name).toBe("TeamCapExceededError");
    expect(err.plan).toBe("pro");
    expect(err.currentCount).toBe(3);
    expect(err.max).toBe(3);
    expect(err.message).toMatch(/pro/);
    expect(err.message).toMatch(/3\/3/);
  });
});
