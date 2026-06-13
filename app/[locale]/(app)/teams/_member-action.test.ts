import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";
import { TeamMembership } from "@/lib/db/models/teamMembership";
import { User } from "@/lib/db/models/User";

const WORKSPACE_ID = new Types.ObjectId();
const OWNER_USER_ID = "user_owner";

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/ownerContext", () => ({
  ownerContext: vi.fn(async () => ({
    userId: OWNER_USER_ID,
    workspaceId: String(WORKSPACE_ID),
    workspace: {
      _id: WORKSPACE_ID,
      ownerUserId: OWNER_USER_ID,
      plan: "starter",
    },
  })),
}));

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

async function makeTeam() {
  return Team.create({
    workspaceId: WORKSPACE_ID,
    name: "Crew",
    color: TEAM_COLOR_PALETTE[0],
    isDefault: false,
    memberCount: 0,
    createdByWorkosUserId: OWNER_USER_ID,
  });
}

async function seedMemberUser(workosUserId: string) {
  return User.create({
    workosUserId,
    email: `${workosUserId}@test.com`,
    onboardingStep: "done",
    onboardingCompletedAt: new Date(),
    memberships: [{ workspaceId: WORKSPACE_ID, role: "staff" }],
  });
}

describe("assignMemberToTeamAction — workspace-member guard", () => {
  it("rejects workosUserId that has no membership in this workspace", async () => {
    const team = await makeTeam();
    // No User doc — pretends a direct server-action call from outside the UI.

    const { assignMemberToTeamAction } = await import("./_member-action");
    const result = await assignMemberToTeamAction({
      workosUserId: "user_random_attacker",
      teamId: String(team._id),
      role: "member",
    });

    expect(result.error).toBe("USER_NOT_IN_WORKSPACE");

    // No seat was reserved and no TeamMembership row was written.
    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(0);
    const rows = await TeamMembership.countDocuments({ workspaceId: WORKSPACE_ID });
    expect(rows).toBe(0);
  });

  it("rejects a user who only belongs to a different workspace", async () => {
    const team = await makeTeam();
    const otherWorkspaceId = new Types.ObjectId();
    await User.create({
      workosUserId: "user_other_ws",
      email: "other@test.com",
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
      memberships: [{ workspaceId: otherWorkspaceId, role: "owner" }],
    });

    const { assignMemberToTeamAction } = await import("./_member-action");
    const result = await assignMemberToTeamAction({
      workosUserId: "user_other_ws",
      teamId: String(team._id),
      role: "member",
    });

    expect(result.error).toBe("USER_NOT_IN_WORKSPACE");
    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(0);
  });

  it("admits a real workspace member and writes the TeamMembership row", async () => {
    const team = await makeTeam();
    await seedMemberUser("user_real_member");

    const { assignMemberToTeamAction } = await import("./_member-action");
    const result = await assignMemberToTeamAction({
      workosUserId: "user_real_member",
      teamId: String(team._id),
      role: "member",
    });

    expect(result.ok).toBe(true);
    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(1);
    const row = await TeamMembership.findOne({
      teamId: team._id,
      workosUserId: "user_real_member",
    }).lean();
    expect(row).toBeTruthy();
    expect(row?.role).toBe("member");
  });
});

describe("removeMemberFromWorkspaceAction — transaction + seat release", () => {
  it("removes workspace membership, team memberships, and releases seats", async () => {
    const team = await makeTeam();
    await seedMemberUser("user_to_remove");

    // Manually add team membership and bump seat count.
    await TeamMembership.create({
      workspaceId: WORKSPACE_ID,
      teamId: team._id,
      workosUserId: "user_to_remove",
      role: "member",
    });
    await Team.updateOne({ _id: team._id }, { $inc: { memberCount: 1 } });

    const { removeMemberFromWorkspaceAction } = await import("./_member-action");
    const result = await removeMemberFromWorkspaceAction({
      workosUserId: "user_to_remove",
    });

    expect(result.ok).toBe(true);

    const userAfter = await User.findOne({ workosUserId: "user_to_remove" }).lean();
    expect(userAfter?.memberships).toHaveLength(0);

    const membershipRows = await TeamMembership.countDocuments({
      workspaceId: WORKSPACE_ID,
      workosUserId: "user_to_remove",
    });
    expect(membershipRows).toBe(0);

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(0);
  });

  it("refuses to remove the workspace owner", async () => {
    const { removeMemberFromWorkspaceAction } = await import("./_member-action");
    const result = await removeMemberFromWorkspaceAction({
      workosUserId: OWNER_USER_ID,
    });
    expect(result.error).toBe("CANNOT_REMOVE_OWNER");
  });
});
