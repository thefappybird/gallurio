import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";
import {
  PendingTeamAssignment,
  PENDING_INVITE_CLAIM_TIMEOUT_MS,
} from "@/lib/db/models/pendingTeamAssignment";
import {
  claimAndReleasePendingInvite,
  claimPendingInviteForAccept,
} from "./release-pending-invite-seats";

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

async function makeTeam(
  memberCount: number,
  workspaceId: mongoose.Types.ObjectId = new mongoose.Types.ObjectId(),
) {
  return Team.create({
    workspaceId,
    name: `Team ${Math.random().toString(36).slice(2, 8)}`,
    color: TEAM_COLOR_PALETTE[0],
    isDefault: false,
    memberCount,
    createdByClerkUserId: "user_test",
  });
}

// Helper: create a team + a pending invite that share the same workspaceId.
// The release helper requires matching workspaceId on the Team filter to
// satisfy the tenant-scoped query rule, so tests must not pair a team from
// workspace A with a pending row pointing at workspace B.
async function makeTeamWithPending(opts: {
  memberCount: number;
  email?: string;
}) {
  const workspaceId = new mongoose.Types.ObjectId();
  const team = await makeTeam(opts.memberCount, workspaceId);
  const pending = await PendingTeamAssignment.create({
    workspaceId,
    email: opts.email ?? `t_${Math.random().toString(36).slice(2, 8)}@example.com`,
    teamIds: [team._id],
    leadOnTeamIds: [],
    clerkInvitationId: "clerk_inv_test",
    invitedByClerkUserId: "user_owner",
    claimedFor: null,
    claimedAt: null,
  });
  return { team, pending, workspaceId };
}

async function makePending(
  teamIds: mongoose.Types.ObjectId[],
  workspaceId = new mongoose.Types.ObjectId(),
  email = `t_${Math.random().toString(36).slice(2, 8)}@example.com`,
) {
  return PendingTeamAssignment.create({
    workspaceId,
    email,
    teamIds,
    leadOnTeamIds: [],
    clerkInvitationId: "clerk_inv_test",
    invitedByClerkUserId: "user_owner",
    claimedFor: null,
    claimedAt: null,
  });
}

describe("claimAndReleasePendingInvite — happy path + idempotency", () => {
  it("decrements memberCount once and deletes the pending row on a fresh release", async () => {
    const { team, pending } = await makeTeamWithPending({ memberCount: 3 });

    const result = await claimAndReleasePendingInvite(pending._id);
    expect(result.status).toBe("released");
    expect(result.status === "released" && result.teamsRefunded).toBe(1);

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(2);
    expect(teamAfter?.pendingReleaseAcks?.map(String)).toContain(String(pending._id));
    const stillThere = await PendingTeamAssignment.findById(pending._id).lean();
    expect(stillThere).toBeNull();
  });

  it("two concurrent callers do NOT double-decrement", async () => {
    // Even if both could somehow claim (e.g. stale lease takeover), the Team
    // per-team ack guarantees the seat is only decremented once.
    const { team, pending } = await makeTeamWithPending({ memberCount: 5 });

    const [a, b] = await Promise.all([
      claimAndReleasePendingInvite(pending._id),
      claimAndReleasePendingInvite(pending._id),
    ]);
    const statuses = [a.status, b.status].sort();
    // One released, one either not-found (row was deleted) or already-claimed.
    expect(statuses.filter((s) => s === "released").length).toBeGreaterThanOrEqual(1);

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(4);
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
});

describe("claimAndReleasePendingInvite — stuck-release recovery", () => {
  it("re-claims a row whose claimedAt lease is stale and completes the refund", async () => {
    // Simulates a worker that claimed the row but crashed before refunding
    // seats. The cron arrives later, sees the stale lease, re-claims, and
    // finishes the work. memberCount must be decremented exactly once.
    const workspaceId = new mongoose.Types.ObjectId();
    const team = await makeTeam(4, workspaceId);
    const stalePast = new Date(Date.now() - PENDING_INVITE_CLAIM_TIMEOUT_MS - 60_000);
    const pending = await PendingTeamAssignment.create({
      workspaceId,
      email: "stuck@example.com",
      teamIds: [team._id],
      leadOnTeamIds: [],
      clerkInvitationId: null,
      invitedByClerkUserId: "user_owner",
      claimedFor: "release",
      claimedAt: stalePast,
    });

    const result = await claimAndReleasePendingInvite(pending._id);
    expect(result.status).toBe("released");

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(3);
  });

  it("does NOT re-claim a row whose claimedAt lease is still fresh", async () => {
    const team = await makeTeam(4);
    const freshlyClaimedAt = new Date();
    const pending = await PendingTeamAssignment.create({
      workspaceId: new mongoose.Types.ObjectId(),
      email: "in-flight@example.com",
      teamIds: [team._id],
      leadOnTeamIds: [],
      clerkInvitationId: null,
      invitedByClerkUserId: "user_owner",
      claimedFor: "accept",
      claimedAt: freshlyClaimedAt,
    });

    const result = await claimAndReleasePendingInvite(pending._id);
    expect(result).toEqual({ status: "claimed-for-accept" });
    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(4); // untouched — accept path is in progress
  });
});

describe("claimPendingInviteForAccept — webhook side", () => {
  it("returns the pending row when no release is in flight", async () => {
    const team = await makeTeam(1);
    const workspaceId = new mongoose.Types.ObjectId();
    const pending = await makePending([team._id], workspaceId, "accept@example.com");

    const claim = await claimPendingInviteForAccept(workspaceId, "accept@example.com");
    expect(claim).not.toBeNull();
    expect(String(claim?._id)).toBe(String(pending._id));
    expect(claim?.teamIds.map(String)).toEqual([String(team._id)]);
  });

  it("returns null when the row is already claimed-for-release with a fresh lease", async () => {
    // Simulates the owner revoking the invite *while* the user is hitting
    // accept. The release path is in flight; the webhook must NOT create
    // TeamMembership rows because the seats are being refunded.
    const team = await makeTeam(1);
    const workspaceId = new mongoose.Types.ObjectId();
    const email = "race@example.com";
    await PendingTeamAssignment.create({
      workspaceId,
      email,
      teamIds: [team._id],
      leadOnTeamIds: [],
      clerkInvitationId: null,
      invitedByClerkUserId: "user_owner",
      claimedFor: "release",
      claimedAt: new Date(), // fresh
    });

    const claim = await claimPendingInviteForAccept(workspaceId, email);
    expect(claim).toBeNull();
  });

  it("returns the row if a prior release attempt has gone stale", async () => {
    // A prior release worker crashed long enough ago that its lease has
    // expired. The user accepting now should be allowed to drain.
    const team = await makeTeam(1);
    const workspaceId = new mongoose.Types.ObjectId();
    const email = "stale-release@example.com";
    const stalePast = new Date(Date.now() - PENDING_INVITE_CLAIM_TIMEOUT_MS - 60_000);
    await PendingTeamAssignment.create({
      workspaceId,
      email,
      teamIds: [team._id],
      leadOnTeamIds: [],
      clerkInvitationId: null,
      invitedByClerkUserId: "user_owner",
      claimedFor: "release",
      claimedAt: stalePast,
    });

    const claim = await claimPendingInviteForAccept(workspaceId, email);
    expect(claim).not.toBeNull();
  });
});

describe("accept-vs-release race", () => {
  it("only one of {claim-for-accept, claim-for-release} can win a fresh row", async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    const team = await makeTeam(1, workspaceId);
    const pending = await makePending([team._id], workspaceId, "race@example.com");

    const [acceptClaim, releaseOutcome] = await Promise.all([
      claimPendingInviteForAccept(workspaceId, "race@example.com"),
      claimAndReleasePendingInvite(pending._id),
    ]);

    // Exactly one side gets the row.
    const acceptWon = acceptClaim !== null;
    const releaseWon = releaseOutcome.status === "released";
    expect(Number(acceptWon) + Number(releaseWon)).toBe(1);

    if (releaseWon) {
      // The release side decremented the seat; the accept side returned null
      // and did NOT create a TeamMembership (webhook would skip the drain).
      const teamAfter = await Team.findById(team._id).lean();
      expect(teamAfter?.memberCount).toBe(0);
    } else {
      // The accept side won the claim. The pending row stays (the webhook
      // would now create TeamMembership rows and delete the row itself).
      const teamAfter = await Team.findById(team._id).lean();
      expect(teamAfter?.memberCount).toBe(1); // seat untouched, becomes TeamMembership
      expect(releaseOutcome).toEqual({ status: "claimed-for-accept" });
    }
  });
});
