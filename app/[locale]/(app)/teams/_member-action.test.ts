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

const emit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sockets/emitDataChanged", () => ({ emitDataChanged: emit }));
const evict = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/sockets/evictUserFromWorkspace", () => ({ evictUserFromWorkspace: evict }));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn().mockResolvedValue("en") }));

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
      plan: "pro",
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
  emit.mockClear();
  evict.mockClear();
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

describe("member actions — data:changed", () => {
  it("assign emits team.updated on success and not when the user is outside the workspace", async () => {
    const team = await makeTeam();
    const { assignMemberToTeamAction } = await import("./_member-action");
    await assignMemberToTeamAction({ workosUserId: "user_nobody", teamId: String(team._id), role: "member" });
    expect(emit).not.toHaveBeenCalled();
    await seedMemberUser("user_m1");
    await assignMemberToTeamAction({ workosUserId: "user_m1", teamId: String(team._id), role: "member" });
    expect(emit).toHaveBeenCalledWith(String(WORKSPACE_ID), { type: "team.updated", teamId: String(team._id) });
  });

  it("setLead (promote and demote) emits team.updated, none when membership is missing", async () => {
    const team = await makeTeam();
    await seedMemberUser("user_m2");
    const { setLeadFlagAction } = await import("./_member-action");
    await setLeadFlagAction({ workosUserId: "user_m2", teamId: String(team._id), isLead: true });
    expect(emit).not.toHaveBeenCalled();
    await TeamMembership.create({ workspaceId: WORKSPACE_ID, teamId: team._id, workosUserId: "user_m2", role: "member" });
    await setLeadFlagAction({ workosUserId: "user_m2", teamId: String(team._id), isLead: true });
    await setLeadFlagAction({ workosUserId: "user_m2", teamId: String(team._id), isLead: false });
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledWith(String(WORKSPACE_ID), { type: "team.updated", teamId: String(team._id) });
  });

  it("removeMemberFromTeam emits team.updated on success, none when membership is missing", async () => {
    const team = await makeTeam();
    await seedMemberUser("user_m3");
    const { removeMemberFromTeamAction } = await import("./_member-action");
    await removeMemberFromTeamAction({ workosUserId: "user_m3", teamId: String(team._id) });
    expect(emit).not.toHaveBeenCalled();
    await TeamMembership.create({ workspaceId: WORKSPACE_ID, teamId: team._id, workosUserId: "user_m3", role: "member" });
    await Team.updateOne({ _id: team._id }, { $inc: { memberCount: 1 } });
    await removeMemberFromTeamAction({ workosUserId: "user_m3", teamId: String(team._id) });
    expect(emit).toHaveBeenCalledWith(String(WORKSPACE_ID), { type: "team.updated", teamId: String(team._id) });
  });

  it("removeMemberFromTeamAndWorkspace emits team.updated on success", async () => {
    const team = await makeTeam();
    await seedMemberUser("user_m4");
    await TeamMembership.create({ workspaceId: WORKSPACE_ID, teamId: team._id, workosUserId: "user_m4", role: "member" });
    await Team.updateOne({ _id: team._id }, { $inc: { memberCount: 1 } });
    const { removeMemberFromTeamAndWorkspaceAction } = await import("./_member-action");
    const res = await removeMemberFromTeamAndWorkspaceAction({ workosUserId: "user_m4", teamId: String(team._id) });
    expect(res.ok).toBe(true);
    expect(emit).toHaveBeenCalledWith(String(WORKSPACE_ID), { type: "team.updated", teamId: String(team._id) });
    expect(evict).toHaveBeenCalledWith(String(WORKSPACE_ID), "user_m4");
  });

  it("removeMemberFromWorkspace emits team.updated on success, none when removing the owner", async () => {
    const { removeMemberFromWorkspaceAction } = await import("./_member-action");
    await removeMemberFromWorkspaceAction({ workosUserId: OWNER_USER_ID });
    expect(emit).not.toHaveBeenCalled();
    expect(evict).not.toHaveBeenCalled();
    await seedMemberUser("user_m5");
    await removeMemberFromWorkspaceAction({ workosUserId: "user_m5" });
    expect(emit).toHaveBeenCalledWith(String(WORKSPACE_ID), { type: "team.updated", teamId: null });
    expect(evict).toHaveBeenCalledWith(String(WORKSPACE_ID), "user_m5");
  });
});

describe("setLeadFlagAction — one lead per team", () => {
  it("atomically transfers lead from the existing lead to the selected member", async () => {
    const team = await makeTeam();
    await seedMemberUser("user_existing_lead");
    await seedMemberUser("user_candidate");
    await TeamMembership.create({
      workspaceId: WORKSPACE_ID,
      teamId: team._id,
      workosUserId: "user_existing_lead",
      role: "lead",
    });
    await TeamMembership.create({
      workspaceId: WORKSPACE_ID,
      teamId: team._id,
      workosUserId: "user_candidate",
      role: "member",
    });

    const { setLeadFlagAction } = await import("./_member-action");
    const result = await setLeadFlagAction({
      workosUserId: "user_candidate",
      teamId: String(team._id),
      isLead: true,
    });

    expect(result.ok).toBe(true);
    const previousLead = await TeamMembership.findOne({
      teamId: team._id,
      workosUserId: "user_existing_lead",
    }).lean();
    const candidate = await TeamMembership.findOne({
      teamId: team._id,
      workosUserId: "user_candidate",
    }).lean();
    expect(previousLead?.role).toBe("member");
    expect(candidate?.role).toBe("lead");
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

  it("refuses to remove a team lead and does not touch any membership", async () => {
    const team = await makeTeam();
    await seedMemberUser("user_lead");
    await TeamMembership.create({
      workspaceId: WORKSPACE_ID,
      teamId: team._id,
      workosUserId: "user_lead",
      role: "lead",
    });

    const { removeMemberFromWorkspaceAction } = await import("./_member-action");
    const result = await removeMemberFromWorkspaceAction({
      workosUserId: "user_lead",
    });

    expect(result).toEqual({ error: "IS_TEAM_LEAD", teamName: "Crew" });

    const row = await TeamMembership.findOne({
      teamId: team._id,
      workosUserId: "user_lead",
    }).lean();
    expect(row).toBeTruthy();
    expect(row?.role).toBe("lead");

    const userAfter = await User.findOne({ workosUserId: "user_lead" }).lean();
    expect(userAfter?.memberships).toHaveLength(1);
  });
});
