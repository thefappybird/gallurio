import { describe, beforeAll, afterAll, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TeamMembership, TEAM_MEMBERSHIP_ROLES } from "./teamMembership";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Ensure unique indexes are created in the in-memory server before tests run.
  await TeamMembership.createIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeId() {
  return new mongoose.Types.ObjectId();
}

describe("TeamMembership model", () => {
  it("creates a membership with required fields and reads it back", async () => {
    const workspaceId = makeId();
    const teamId = makeId();
    const clerkUserId = "user_test_1";

    const created = await TeamMembership.create({ workspaceId, teamId, clerkUserId });
    const found = await TeamMembership.findById(created._id).lean();

    expect(found).not.toBeNull();
    expect(found!.workspaceId.toString()).toBe(workspaceId.toString());
    expect(found!.teamId.toString()).toBe(teamId.toString());
    expect(found!.clerkUserId).toBe(clerkUserId);
    expect(found!.role).toBe("member"); // default
  });

  it("accepts 'lead' as a valid role", async () => {
    const membership = await TeamMembership.create({
      workspaceId: makeId(),
      teamId: makeId(),
      clerkUserId: "user_lead_1",
      role: "lead",
    });
    expect(membership.role).toBe("lead");
  });

  it("rejects an invalid role", async () => {
    await expect(
      TeamMembership.create({
        workspaceId: makeId(),
        teamId: makeId(),
        clerkUserId: "user_bad_role",
        role: "admin",
      })
    ).rejects.toThrow();
  });

  it("TEAM_MEMBERSHIP_ROLES contains member and lead", () => {
    expect(TEAM_MEMBERSHIP_ROLES).toContain("member");
    expect(TEAM_MEMBERSHIP_ROLES).toContain("lead");
    expect(TEAM_MEMBERSHIP_ROLES).toHaveLength(2);
  });

  it("rejects a duplicate membership for the same user in the same team", async () => {
    const teamId = makeId();
    const workspaceId = makeId();
    const clerkUserId = "user_dup";

    await TeamMembership.create({ workspaceId, teamId, clerkUserId });

    await expect(
      TeamMembership.create({ workspaceId, teamId, clerkUserId, role: "lead" })
    ).rejects.toThrow();
  });

  it("allows the same user to be a member of two different teams", async () => {
    const workspaceId = makeId();
    const teamA = makeId();
    const teamB = makeId();
    const clerkUserId = "user_multi_team";

    await TeamMembership.create({ workspaceId, teamId: teamA, clerkUserId });
    const second = await TeamMembership.create({ workspaceId, teamId: teamB, clerkUserId });

    expect(second._id).toBeDefined();
  });
});

describe("TeamMembership tenant isolation", () => {
  it("a membership in workspace A is not returned by a workspace B query", async () => {
    const wsA = makeId();
    const wsB = makeId();
    const teamId = makeId();
    const clerkUserId = "user_isolated";

    await TeamMembership.create({ workspaceId: wsA, teamId, clerkUserId });

    const found = await TeamMembership.findOne({ workspaceId: wsB, clerkUserId }).lean();
    expect(found).toBeNull();
  });
});
