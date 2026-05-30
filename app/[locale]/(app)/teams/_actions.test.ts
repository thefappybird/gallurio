import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";
import { TeamMembership } from "@/lib/db/models/teamMembership";

const WORKSPACE_ID = new Types.ObjectId();
const OTHER_WORKSPACE_ID = new Types.ObjectId();
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

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

function makeTeam(overrides: Partial<{ workspaceId: Types.ObjectId; name: string; isDefault: boolean; color: string }> = {}) {
  return Team.create({
    workspaceId: overrides.workspaceId ?? WORKSPACE_ID,
    name: overrides.name ?? "Crew",
    color: overrides.color ?? TEAM_COLOR_PALETTE[0],
    isDefault: overrides.isDefault ?? false,
    memberCount: 0,
    createdByClerkUserId: OWNER_USER_ID,
  });
}

describe("renameTeamAction", () => {
  it("persists the new name", async () => {
    const team = await makeTeam({ name: "Old" });
    const { renameTeamAction } = await import("./_actions");
    const result = await renameTeamAction({ teamId: String(team._id), name: "New crew" });
    expect(result.ok).toBe(true);
    const after = await Team.findById(team._id).lean();
    expect(after?.name).toBe("New crew");
  });

  it("cannot rename a team in another workspace (tenant isolation)", async () => {
    const foreign = await makeTeam({ workspaceId: OTHER_WORKSPACE_ID, name: "Foreign" });
    const { renameTeamAction } = await import("./_actions");
    const result = await renameTeamAction({ teamId: String(foreign._id), name: "Hijacked" });
    expect(result.error).toBe("Team not found");
    const after = await Team.findById(foreign._id).lean();
    expect(after?.name).toBe("Foreign");
  });
});

describe("setTeamColorAction", () => {
  it("persists an arbitrary spectrum hex", async () => {
    const team = await makeTeam();
    const { setTeamColorAction } = await import("./_actions");
    const result = await setTeamColorAction({ teamId: String(team._id), color: "#abcdef" });
    expect(result.ok).toBe(true);
    const after = await Team.findById(team._id).lean();
    expect(after?.color).toBe("#abcdef");
  });

  it("cannot recolor a team in another workspace", async () => {
    const foreign = await makeTeam({ workspaceId: OTHER_WORKSPACE_ID, color: "#000000" });
    const { setTeamColorAction } = await import("./_actions");
    const result = await setTeamColorAction({ teamId: String(foreign._id), color: "#ffffff" });
    expect(result.error).toBe("Team not found");
    const after = await Team.findById(foreign._id).lean();
    expect(after?.color).toBe("#000000");
  });
});

describe("deleteTeamAction", () => {
  it("removes the team AND its membership rows", async () => {
    const team = await makeTeam();
    await TeamMembership.create([
      { workspaceId: WORKSPACE_ID, teamId: team._id, clerkUserId: "u1", role: "member" },
      { workspaceId: WORKSPACE_ID, teamId: team._id, clerkUserId: "u2", role: "lead" },
    ]);

    const { deleteTeamAction } = await import("./_actions");
    const result = await deleteTeamAction({ teamId: String(team._id) });

    expect(result.ok).toBe(true);
    expect(await Team.findById(team._id).lean()).toBeNull();
    expect(
      await TeamMembership.countDocuments({ teamId: team._id, workspaceId: WORKSPACE_ID }),
    ).toBe(0);
  });

  it("refuses to delete the default team and leaves it intact", async () => {
    const team = await makeTeam({ isDefault: true, name: "Main" });
    const { deleteTeamAction } = await import("./_actions");
    const result = await deleteTeamAction({ teamId: String(team._id) });
    expect(result.error).toBe("CANNOT_DELETE_DEFAULT");
    expect(await Team.findById(team._id).lean()).not.toBeNull();
  });

  it("does not delete a team belonging to another workspace", async () => {
    const foreign = await makeTeam({ workspaceId: OTHER_WORKSPACE_ID });
    await TeamMembership.create({
      workspaceId: OTHER_WORKSPACE_ID,
      teamId: foreign._id,
      clerkUserId: "uX",
      role: "member",
    });

    const { deleteTeamAction } = await import("./_actions");
    const result = await deleteTeamAction({ teamId: String(foreign._id) });

    expect(result.error).toBe("Team not found");
    expect(await Team.findById(foreign._id).lean()).not.toBeNull();
    expect(
      await TeamMembership.countDocuments({ teamId: foreign._id }),
    ).toBe(1);
  });
});
