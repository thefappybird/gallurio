import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";
import { TeamMembership } from "@/lib/db/models/teamMembership";
import { getBookingTeamOptions } from "./team-options";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

function makeTeam(
  workspaceId: Types.ObjectId,
  opts: Partial<{ name: string; isDefault: boolean; isActive: boolean }> = {},
) {
  return Team.create({
    workspaceId,
    name: opts.name ?? "Crew",
    color: TEAM_COLOR_PALETTE[0],
    isDefault: opts.isDefault ?? false,
    isActive: opts.isActive ?? true,
    memberCount: 0,
    createdByWorkosUserId: "user_owner",
  });
}

describe("getBookingTeamOptions — owner", () => {
  it("returns every workspace team (incl. inactive), active+default first, all writable", async () => {
    const ws = new Types.ObjectId();
    await makeTeam(ws, { name: "Main", isDefault: true });
    await makeTeam(ws, { name: "Crew B" });
    await makeTeam(ws, { name: "Retired", isActive: false });

    const opts = await getBookingTeamOptions({ role: "owner", userId: "user_owner", workspace: { _id: ws } });

    expect(opts).toHaveLength(3);
    // Active teams sort before inactive; default before other active.
    expect(opts[0].name).toBe("Main");
    expect(opts[opts.length - 1].name).toBe("Retired");
    expect(opts.every((o) => o.isLead)).toBe(true); // owner may write to any active team
    expect(opts.find((o) => o.name === "Retired")?.isActive).toBe(false);
  });

  it("never returns another workspace's teams (tenant isolation)", async () => {
    const ws = new Types.ObjectId();
    const otherWs = new Types.ObjectId();
    await makeTeam(ws, { name: "Mine" });
    await makeTeam(otherWs, { name: "Theirs" });

    const opts = await getBookingTeamOptions({ role: "owner", userId: "user_owner", workspace: { _id: ws } });
    expect(opts.map((o) => o.name)).toEqual(["Mine"]);
  });
});

describe("getBookingTeamOptions — non-owner (staff)", () => {
  it("returns only the teams the member belongs to, with isLead from their role", async () => {
    const ws = new Types.ObjectId();
    const userId = "user_member";
    const onLead = await makeTeam(ws, { name: "Lead Team" });
    const onMember = await makeTeam(ws, { name: "Member Team" });
    await makeTeam(ws, { name: "Not Mine" }); // member is NOT on this one

    await TeamMembership.create([
      { workspaceId: ws, teamId: onLead._id, workosUserId: userId, role: "lead" },
      { workspaceId: ws, teamId: onMember._id, workosUserId: userId, role: "member" },
    ]);

    const opts = await getBookingTeamOptions({ role: "staff", userId, workspace: { _id: ws } });

    expect(opts.map((o) => o.name).sort()).toEqual(["Lead Team", "Member Team"]);
    expect(opts.find((o) => o.name === "Lead Team")?.isLead).toBe(true);
    expect(opts.find((o) => o.name === "Member Team")?.isLead).toBe(false);
  });

  it("includes a deactivated team the member still belongs to (view-only history)", async () => {
    const ws = new Types.ObjectId();
    const userId = "user_member2";
    const dead = await makeTeam(ws, { name: "Retired Crew", isActive: false });
    await TeamMembership.create({
      workspaceId: ws,
      teamId: dead._id,
      workosUserId: userId,
      role: "lead",
    });

    const opts = await getBookingTeamOptions({ role: "staff", userId, workspace: { _id: ws } });
    expect(opts).toHaveLength(1);
    expect(opts[0]).toMatchObject({ name: "Retired Crew", isActive: false, isLead: true });
  });

  it("returns [] for a member with no memberships", async () => {
    const ws = new Types.ObjectId();
    await makeTeam(ws, { name: "Some Team" });
    const opts = await getBookingTeamOptions({ role: "staff", userId: "nobody", workspace: { _id: ws } });
    expect(opts).toEqual([]);
  });
});
