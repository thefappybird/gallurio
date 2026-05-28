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
    clerkOrgId: "org_test",
    workspace: {
      _id: WORKSPACE_ID,
      ownerUserId: OWNER_USER_ID,
      plan: "starter",
    },
  })),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    organizations: {
      deleteOrganizationMembership: vi.fn().mockResolvedValue({}),
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
    createdByClerkUserId: OWNER_USER_ID,
  });
}

async function seedMemberUser(clerkUserId: string) {
  return User.create({
    clerkUserId,
    email: `${clerkUserId}@test.com`,
    onboardingStep: "done",
    onboardingCompletedAt: new Date(),
    memberships: [{ workspaceId: WORKSPACE_ID, role: "staff" }],
  });
}

describe("assignMemberToTeamAction — workspace-member guard", () => {
  it("rejects clerkUserId that has no membership in this workspace", async () => {
    const team = await makeTeam();
    // No User doc — pretends a direct server-action call from outside the UI.

    const { assignMemberToTeamAction } = await import("./_member-action");
    const result = await assignMemberToTeamAction({
      clerkUserId: "user_random_attacker",
      teamId: String(team._id),
      role: "member",
    });

    expect(result.error).toBe("USER_NOT_IN_WORKSPACE");

    // Crucially, no seat was reserved and no TeamMembership row was written.
    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(0);
    const rows = await TeamMembership.countDocuments({ workspaceId: WORKSPACE_ID });
    expect(rows).toBe(0);
  });

  it("rejects a user who only belongs to a different workspace", async () => {
    const team = await makeTeam();
    const otherWorkspaceId = new Types.ObjectId();
    await User.create({
      clerkUserId: "user_other_ws",
      email: "other@test.com",
      onboardingStep: "done",
      onboardingCompletedAt: new Date(),
      memberships: [{ workspaceId: otherWorkspaceId, role: "owner" }],
    });

    const { assignMemberToTeamAction } = await import("./_member-action");
    const result = await assignMemberToTeamAction({
      clerkUserId: "user_other_ws",
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
      clerkUserId: "user_real_member",
      teamId: String(team._id),
      role: "member",
    });

    expect(result.ok).toBe(true);
    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(1);
    const row = await TeamMembership.findOne({
      teamId: team._id,
      clerkUserId: "user_real_member",
    }).lean();
    expect(row).toBeTruthy();
    expect(row?.role).toBe("member");
  });
});
