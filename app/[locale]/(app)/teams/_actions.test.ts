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

const emit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sockets/emitDataChanged", () => ({ emitDataChanged: emit }));

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
      plan: "free",
    },
  })),
}));

// next-intl/server reads request context that does not exist under Vitest, so
// getLocale/getTranslations throw "not supported in Client Components". They run
// fine inside real Server Actions (server-side); the test just lacks the request
// scope, so stub them the same way settings/_actions.test.ts does.
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  setRequestLocale: vi.fn(),
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
});

function makeTeam(
  overrides: Partial<{
    workspaceId: Types.ObjectId;
    name: string;
    isDefault: boolean;
    color: string;
    isActive: boolean;
    deactivatedAt: Date | null;
  }> = {},
) {
  return Team.create({
    workspaceId: overrides.workspaceId ?? WORKSPACE_ID,
    name: overrides.name ?? "Crew",
    color: overrides.color ?? TEAM_COLOR_PALETTE[0],
    isDefault: overrides.isDefault ?? false,
    isActive: overrides.isActive ?? true,
    deactivatedAt: overrides.deactivatedAt ?? null,
    memberCount: 0,
    createdByWorkosUserId: OWNER_USER_ID,
  });
}

describe("createTeamAction", () => {
  it("emits team.updated with the new team id after create", async () => {
    const { createTeamAction } = await import("./_actions");
    const result = await createTeamAction({ name: "Fresh", color: TEAM_COLOR_PALETTE[1] });
    expect(result.ok).toBe(true);
    expect(emit).toHaveBeenCalledWith(String(WORKSPACE_ID), {
      type: "team.updated",
      teamId: result.team?.id,
    });
  });

  it("does not emit on invalid input", async () => {
    const { createTeamAction } = await import("./_actions");
    await createTeamAction({ name: "", color: TEAM_COLOR_PALETTE[1] });
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("renameTeamAction", () => {
  it("persists the new name", async () => {
    const team = await makeTeam({ name: "Old" });
    const { renameTeamAction } = await import("./_actions");
    const result = await renameTeamAction({ teamId: String(team._id), name: "New crew" });
    expect(result.ok).toBe(true);
    const after = await Team.findById(team._id).lean();
    expect(after?.name).toBe("New crew");
  });

  it("emits team.updated after rename, none for a foreign team", async () => {
    const team = await makeTeam({ name: "Old" });
    const foreign = await makeTeam({ workspaceId: OTHER_WORKSPACE_ID, name: "F" });
    const { renameTeamAction } = await import("./_actions");
    await renameTeamAction({ teamId: String(foreign._id), name: "X" });
    expect(emit).not.toHaveBeenCalled();
    await renameTeamAction({ teamId: String(team._id), name: "New crew" });
    expect(emit).toHaveBeenCalledWith(String(WORKSPACE_ID), { type: "team.updated", teamId: String(team._id) });
  });

  it("cannot rename a team in another workspace (tenant isolation)", async () => {
    const foreign = await makeTeam({ workspaceId: OTHER_WORKSPACE_ID, name: "Foreign" });
    const { renameTeamAction } = await import("./_actions");
    const result = await renameTeamAction({ teamId: String(foreign._id), name: "Hijacked" });
    expect(result.error).toBe("TEAM_NOT_FOUND");
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

  it("emits team.updated after recolor", async () => {
    const team = await makeTeam();
    const { setTeamColorAction } = await import("./_actions");
    await setTeamColorAction({ teamId: String(team._id), color: "#123456" });
    expect(emit).toHaveBeenCalledWith(String(WORKSPACE_ID), { type: "team.updated", teamId: String(team._id) });
  });

  it("cannot recolor a team in another workspace", async () => {
    const foreign = await makeTeam({ workspaceId: OTHER_WORKSPACE_ID, color: "#000000" });
    const { setTeamColorAction } = await import("./_actions");
    const result = await setTeamColorAction({ teamId: String(foreign._id), color: "#ffffff" });
    expect(result.error).toBe("TEAM_NOT_FOUND");
    const after = await Team.findById(foreign._id).lean();
    expect(after?.color).toBe("#000000");
  });
});

describe("deactivateTeamAction", () => {
  it("soft-deletes: sets isActive false + deactivatedAt, KEEPING the row and memberships", async () => {
    const team = await makeTeam();
    await TeamMembership.create([
      { workspaceId: WORKSPACE_ID, teamId: team._id, workosUserId: "u1", role: "member" },
      { workspaceId: WORKSPACE_ID, teamId: team._id, workosUserId: "u2", role: "lead" },
    ]);

    const { deactivateTeamAction } = await import("./_actions");
    const result = await deactivateTeamAction({ teamId: String(team._id) });

    expect(result.ok).toBe(true);
    const after = await Team.findById(team._id).lean();
    expect(after).not.toBeNull();
    expect(after?.isActive).toBe(false);
    expect(after?.deactivatedAt).toBeInstanceOf(Date);
    // History is preserved — memberships survive deactivation.
    expect(
      await TeamMembership.countDocuments({ teamId: team._id, workspaceId: WORKSPACE_ID }),
    ).toBe(2);
  });

  it("emits team.updated after deactivate, none when the default team is refused", async () => {
    const def = await makeTeam({ name: "Main", isDefault: true });
    const team = await makeTeam({ name: "Crew2" });
    const { deactivateTeamAction } = await import("./_actions");
    await deactivateTeamAction({ teamId: String(def._id) });
    expect(emit).not.toHaveBeenCalled();
    await deactivateTeamAction({ teamId: String(team._id) });
    expect(emit).toHaveBeenCalledWith(String(WORKSPACE_ID), { type: "team.updated", teamId: String(team._id) });
  });

  it("refuses to deactivate the default team and leaves it active", async () => {
    const team = await makeTeam({ isDefault: true, name: "Main" });
    const { deactivateTeamAction } = await import("./_actions");
    const result = await deactivateTeamAction({ teamId: String(team._id) });
    expect(result.error).toBe("CANNOT_DEACTIVATE_DEFAULT");
    const after = await Team.findById(team._id).lean();
    expect(after?.isActive).toBe(true);
  });

  it("does not deactivate a team belonging to another workspace (tenant isolation)", async () => {
    const foreign = await makeTeam({ workspaceId: OTHER_WORKSPACE_ID });
    const { deactivateTeamAction } = await import("./_actions");
    const result = await deactivateTeamAction({ teamId: String(foreign._id) });
    expect(result.error).toBe("TEAM_NOT_FOUND");
    const after = await Team.findById(foreign._id).lean();
    expect(after?.isActive).toBe(true);
  });
});

describe("reactivateTeamAction", () => {
  it("restores a deactivated team: isActive true + deactivatedAt null", async () => {
    const team = await makeTeam({ isActive: false, deactivatedAt: new Date() });
    const { reactivateTeamAction } = await import("./_actions");
    const result = await reactivateTeamAction({ teamId: String(team._id) });

    expect(result.ok).toBe(true);
    const after = await Team.findById(team._id).lean();
    expect(after?.isActive).toBe(true);
    expect(after?.deactivatedAt).toBeNull();
  });

  it("emits team.updated after reactivation", async () => {
    const team = await makeTeam({ isActive: false, deactivatedAt: new Date() });
    const { reactivateTeamAction } = await import("./_actions");
    await reactivateTeamAction({ teamId: String(team._id) });
    expect(emit).toHaveBeenCalledWith(String(WORKSPACE_ID), { type: "team.updated", teamId: String(team._id) });
  });

  it("refuses reactivation that would exceed the active-team plan cap", async () => {
    // Mocked workspace plan is "free" → cap 10. Fill the 10 active slots, then
    // try to reactivate an 11th (currently inactive) team.
    for (let i = 0; i < 10; i++) {
      await makeTeam({ name: `A${i}` });
    }
    const dead = await makeTeam({ name: "D", isActive: false, deactivatedAt: new Date() });

    const { reactivateTeamAction } = await import("./_actions");
    const result = await reactivateTeamAction({ teamId: String(dead._id) });

    expect(result.error).toBe("REACTIVATE_CAP_EXCEEDED");
    const after = await Team.findById(dead._id).lean();
    expect(after?.isActive).toBe(false);
  });

  it("cannot reactivate a team belonging to another workspace (tenant isolation)", async () => {
    const foreign = await makeTeam({
      workspaceId: OTHER_WORKSPACE_ID,
      isActive: false,
      deactivatedAt: new Date(),
    });
    const { reactivateTeamAction } = await import("./_actions");
    const result = await reactivateTeamAction({ teamId: String(foreign._id) });
    expect(result.error).toBe("TEAM_NOT_FOUND");
    const after = await Team.findById(foreign._id).lean();
    expect(after?.isActive).toBe(false);
  });
});
