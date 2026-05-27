import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";
import { PendingTeamAssignment } from "@/lib/db/models/pendingTeamAssignment";
import { claimAndReleasePendingInvite } from "./release-pending-invite-seats";

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Team.deleteMany({});
  await PendingTeamAssignment.deleteMany({});
});

async function makeTeam(memberCount: number) {
  return Team.create({
    workspaceId: new mongoose.Types.ObjectId(),
    name: `Team ${Math.random().toString(36).slice(2, 8)}`,
    color: TEAM_COLOR_PALETTE[0],
    isDefault: false,
    memberCount,
    createdByClerkUserId: "user_test",
  });
}

async function makePending(teamIds: mongoose.Types.ObjectId[]) {
  return PendingTeamAssignment.create({
    workspaceId: new mongoose.Types.ObjectId(),
    email: `t_${Math.random().toString(36).slice(2, 8)}@example.com`,
    teamIds,
    leadOnTeamIds: [],
    clerkInvitationId: "clerk_inv_test",
    invitedByClerkUserId: "user_owner",
    releasedAt: null,
  });
}

describe("claimAndReleasePendingInvite — idempotency", () => {
  it("decrements memberCount once and deletes the pending row on a fresh release", async () => {
    const team = await makeTeam(3);
    const pending = await makePending([team._id]);

    const result = await claimAndReleasePendingInvite(pending._id);
    expect(result).toEqual({ status: "released", teamsReleased: 1 });

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(2);
    const stillThere = await PendingTeamAssignment.findById(pending._id).lean();
    expect(stillThere).toBeNull();
  });

  it("a second concurrent caller sees already-released and does NOT double-decrement", async () => {
    // Two callers race against the same pending row. Only one can claim the
    // releasedAt: null state; the other must short-circuit before touching
    // memberCount.
    const team = await makeTeam(5);
    const pending = await makePending([team._id, team._id]); // duplicate teamId on purpose to make the double-refund risk obvious

    const [a, b] = await Promise.all([
      claimAndReleasePendingInvite(pending._id),
      claimAndReleasePendingInvite(pending._id),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["already-released", "released"]);

    const teamAfter = await Team.findById(team._id).lean();
    // The pending row had teamIds=[t,t], so the winning call decrements twice
    // (5 -> 4 -> 3). The losing call must NOT decrement again. If the losing
    // call also decremented, we'd be at 1.
    expect(teamAfter?.memberCount).toBe(3);
  });

  it("returns not-found for an unknown _id without touching anything", async () => {
    const team = await makeTeam(7);
    const result = await claimAndReleasePendingInvite(
      new mongoose.Types.ObjectId(),
    );
    expect(result).toEqual({ status: "not-found" });
    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(7);
  });

  it("calling release on a row whose releasedAt is already set short-circuits", async () => {
    // Simulates the cleanup cron running after a prior crash mid-release.
    const team = await makeTeam(4);
    const pending = await PendingTeamAssignment.create({
      workspaceId: new mongoose.Types.ObjectId(),
      email: "stuck@example.com",
      teamIds: [team._id],
      leadOnTeamIds: [],
      clerkInvitationId: null,
      invitedByClerkUserId: "user_owner",
      releasedAt: new Date(),
    });

    const result = await claimAndReleasePendingInvite(pending._id);
    expect(result).toEqual({ status: "already-released" });

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(4); // untouched
  });
});
