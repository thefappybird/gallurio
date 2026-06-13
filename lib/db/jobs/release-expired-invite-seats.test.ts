import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Invitation } from "@/lib/db/models/Invitation";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";
import { releaseExpiredInviteSeats } from "./release-expired-invite-seats";

// connectDB is a no-op in this suite — the in-memory Mongo is already wired
// up via mongoose.connect below.
import { vi } from "vitest";
vi.mock("@/lib/db/mongoose", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Invitation.createIndexes();
  await Team.createIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Invitation.deleteMany({});
  await Team.deleteMany({});
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function pastDate(msAgo: number): Date {
  return new Date(Date.now() - msAgo);
}

function futureDate(msAhead: number): Date {
  return new Date(Date.now() + msAhead);
}

async function makeTeam(workspaceId: Types.ObjectId, memberCount: number) {
  return Team.create({
    workspaceId,
    name: `Team-${Math.random().toString(36).slice(2, 8)}`,
    color: TEAM_COLOR_PALETTE[0],
    isDefault: false,
    memberCount,
    createdByWorkosUserId: "wos_user_owner",
  });
}

function makeInviteData(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: new Types.ObjectId(),
    email: `inv_${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: "staff",
    teamIds: [],
    leadOnTeamIds: [],
    tokenHash: `hash_${Math.random().toString(36).slice(2, 16)}`,
    invitedByWorkosUserId: "wos_user_owner",
    status: "pending",
    expiresAt: futureDate(7 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("releaseExpiredInviteSeats — expired pending invite", () => {
  it("flips status to 'expired' and decrements memberCount for each teamId", async () => {
    const workspaceId = new Types.ObjectId();
    const team = await makeTeam(workspaceId, 3);

    await Invitation.create(
      makeInviteData({
        workspaceId,
        teamIds: [team._id],
        expiresAt: pastDate(60_000),
      }),
    );

    const report = await releaseExpiredInviteSeats();

    expect(report).toEqual({ scanned: 1, released: 1, skipped: 0 });

    const inv = await Invitation.findOne({ workspaceId }).lean();
    expect(inv?.status).toBe("expired");

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(2);
  });

  it("releases seats for all teamIds on an invite with multiple teams", async () => {
    const workspaceId = new Types.ObjectId();
    const teamA = await makeTeam(workspaceId, 5);
    const teamB = await makeTeam(workspaceId, 2);

    await Invitation.create(
      makeInviteData({
        workspaceId,
        teamIds: [teamA._id, teamB._id],
        expiresAt: pastDate(60_000),
      }),
    );

    const report = await releaseExpiredInviteSeats();

    expect(report).toEqual({ scanned: 1, released: 1, skipped: 0 });

    const afterA = await Team.findById(teamA._id).lean();
    const afterB = await Team.findById(teamB._id).lean();
    expect(afterA?.memberCount).toBe(4);
    expect(afterB?.memberCount).toBe(1);
  });
});

describe("releaseExpiredInviteSeats — unexpired pending invite", () => {
  it("does not touch an invite whose expiresAt is in the future", async () => {
    const workspaceId = new Types.ObjectId();
    const team = await makeTeam(workspaceId, 4);

    await Invitation.create(
      makeInviteData({
        workspaceId,
        teamIds: [team._id],
        expiresAt: futureDate(24 * 60 * 60 * 1000),
      }),
    );

    const report = await releaseExpiredInviteSeats();

    expect(report).toEqual({ scanned: 0, released: 0, skipped: 0 });

    const inv = await Invitation.findOne({ workspaceId }).lean();
    expect(inv?.status).toBe("pending");

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(4);
  });
});

describe("releaseExpiredInviteSeats — non-pending statuses with past expiresAt", () => {
  it("does not touch an 'accepted' invite even if past expiresAt", async () => {
    const workspaceId = new Types.ObjectId();
    const team = await makeTeam(workspaceId, 2);

    await Invitation.create(
      makeInviteData({
        workspaceId,
        teamIds: [team._id],
        status: "accepted",
        expiresAt: pastDate(60_000),
        acceptedAt: pastDate(120_000),
      }),
    );

    const report = await releaseExpiredInviteSeats();

    expect(report).toEqual({ scanned: 0, released: 0, skipped: 0 });

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(2);
  });

  it("does not touch a 'revoked' invite even if past expiresAt", async () => {
    const workspaceId = new Types.ObjectId();
    const team = await makeTeam(workspaceId, 2);

    await Invitation.create(
      makeInviteData({
        workspaceId,
        teamIds: [team._id],
        status: "revoked",
        expiresAt: pastDate(60_000),
        revokedAt: pastDate(90_000),
      }),
    );

    const report = await releaseExpiredInviteSeats();

    expect(report).toEqual({ scanned: 0, released: 0, skipped: 0 });

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(2);
  });

  it("does not touch an already 'expired' invite", async () => {
    const workspaceId = new Types.ObjectId();
    const team = await makeTeam(workspaceId, 1);

    await Invitation.create(
      makeInviteData({
        workspaceId,
        teamIds: [team._id],
        status: "expired",
        expiresAt: pastDate(60_000),
      }),
    );

    const report = await releaseExpiredInviteSeats();

    expect(report).toEqual({ scanned: 0, released: 0, skipped: 0 });

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(1);
  });
});

describe("releaseExpiredInviteSeats — idempotency", () => {
  it("does not double-decrement memberCount when the sweep runs twice", async () => {
    const workspaceId = new Types.ObjectId();
    const team = await makeTeam(workspaceId, 3);

    await Invitation.create(
      makeInviteData({
        workspaceId,
        teamIds: [team._id],
        expiresAt: pastDate(60_000),
      }),
    );

    const first = await releaseExpiredInviteSeats();
    expect(first).toEqual({ scanned: 1, released: 1, skipped: 0 });

    // Second sweep: the row is now "expired", so scanned=0.
    const second = await releaseExpiredInviteSeats();
    expect(second).toEqual({ scanned: 0, released: 0, skipped: 0 });

    const teamAfter = await Team.findById(team._id).lean();
    // Decremented exactly once.
    expect(teamAfter?.memberCount).toBe(2);
  });
});

describe("releaseExpiredInviteSeats — skipped path via atomic claim failure", () => {
  it("skips and leaves seats untouched when findOneAndUpdate cannot claim the row", async () => {
    // The sweep's find() returns candidates with status:"pending". Between
    // that find and the per-candidate findOneAndUpdate, a concurrent accept or
    // revoke can transition the row. We simulate this by inserting the invite
    // already in "accepted" state with a past expiresAt: the find() filter
    // (status:"pending") will not return it, so scanned=0 and no seats are
    // released. This validates the filter correctly excludes non-pending rows.
    const workspaceId = new Types.ObjectId();
    const team = await makeTeam(workspaceId, 2);

    await Invitation.create(
      makeInviteData({
        workspaceId,
        teamIds: [team._id],
        status: "accepted",
        expiresAt: pastDate(60_000),
        acceptedAt: pastDate(30_000),
      }),
    );

    const report = await releaseExpiredInviteSeats();

    // The accepted row is invisible to the status:"pending" find query.
    expect(report).toEqual({ scanned: 0, released: 0, skipped: 0 });

    // Seat must NOT have been released.
    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(2);
  });

  it("skips (does not release) when the atomic claim fails mid-sweep", async () => {
    // Insert two expired pending invites for the same workspace/team.
    // We delete the first one directly in Mongo between find() and the
    // findOneAndUpdate by running the sweep a second time — the first sweep
    // expires it, the second sweep finds nothing: validates skipped accounting.
    const workspaceId = new Types.ObjectId();
    const team = await makeTeam(workspaceId, 3);

    await Invitation.create(
      makeInviteData({
        workspaceId,
        teamIds: [team._id],
        expiresAt: pastDate(60_000),
      }),
    );

    // First sweep claims and releases.
    const first = await releaseExpiredInviteSeats();
    expect(first).toEqual({ scanned: 1, released: 1, skipped: 0 });

    // Second sweep: row is now "expired", find() returns nothing.
    const second = await releaseExpiredInviteSeats();
    expect(second).toEqual({ scanned: 0, released: 0, skipped: 0 });

    // memberCount decremented exactly once.
    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(2);
  });
});

describe("releaseExpiredInviteSeats — tenant scoping", () => {
  it("only releases seats for the invite's own workspace teams", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const teamA = await makeTeam(wsA, 4);
    const teamB = await makeTeam(wsB, 3);

    // Only wsA's invite is expired.
    await Invitation.create(
      makeInviteData({
        workspaceId: wsA,
        teamIds: [teamA._id],
        expiresAt: pastDate(60_000),
      }),
    );
    await Invitation.create(
      makeInviteData({
        workspaceId: wsB,
        teamIds: [teamB._id],
        expiresAt: futureDate(60_000),
      }),
    );

    const report = await releaseExpiredInviteSeats();

    expect(report).toEqual({ scanned: 1, released: 1, skipped: 0 });

    const afterA = await Team.findById(teamA._id).lean();
    const afterB = await Team.findById(teamB._id).lean();
    expect(afterA?.memberCount).toBe(3); // released
    expect(afterB?.memberCount).toBe(3); // untouched
  });
});
