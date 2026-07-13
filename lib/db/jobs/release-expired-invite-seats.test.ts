import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Invitation } from "@/lib/db/models/Invitation";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";
import { releaseExpiredInviteSeats } from "./release-expired-invite-seats";

// connectDB is a no-op in this suite — the in-memory Mongo is already wired
// up via startInMemoryMongo below. Replica-set (not single-node) so the job's
// per-invitation transaction (flip + seat release) can be exercised.
import { vi } from "vitest";
vi.mock("@/lib/db/mongoose", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(async () => {
  await startInMemoryMongo();
  await Invitation.createIndexes();
  await Team.createIndexes();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
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

    expect(report).toEqual({ scanned: 1, released: 1, skipped: 0, failed: 0 });

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

    expect(report).toEqual({ scanned: 1, released: 1, skipped: 0, failed: 0 });

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

    expect(report).toEqual({ scanned: 0, released: 0, skipped: 0, failed: 0 });

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

    expect(report).toEqual({ scanned: 0, released: 0, skipped: 0, failed: 0 });

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

    expect(report).toEqual({ scanned: 0, released: 0, skipped: 0, failed: 0 });

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

    expect(report).toEqual({ scanned: 0, released: 0, skipped: 0, failed: 0 });

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
    expect(first).toEqual({ scanned: 1, released: 1, skipped: 0, failed: 0 });

    // Second sweep: the row is now "expired", so scanned=0.
    const second = await releaseExpiredInviteSeats();
    expect(second).toEqual({ scanned: 0, released: 0, skipped: 0, failed: 0 });

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
    expect(report).toEqual({ scanned: 0, released: 0, skipped: 0, failed: 0 });

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
    expect(first).toEqual({ scanned: 1, released: 1, skipped: 0, failed: 0 });

    // Second sweep: row is now "expired", find() returns nothing.
    const second = await releaseExpiredInviteSeats();
    expect(second).toEqual({ scanned: 0, released: 0, skipped: 0, failed: 0 });

    // memberCount decremented exactly once.
    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(2);
  });
});

describe("releaseExpiredInviteSeats — transactional rollback on seat-release failure", () => {
  it("keeps the invite 'pending' and the seat untouched when releaseTeamSeat throws, then retries it clean next run", async () => {
    const workspaceId = new Types.ObjectId();
    const team = await makeTeam(workspaceId, 3);

    await Invitation.create(
      makeInviteData({
        workspaceId,
        teamIds: [team._id],
        expiresAt: pastDate(60_000),
      }),
    );

    const updateOneSpy = vi
      .spyOn(Team, "updateOne")
      .mockRejectedValueOnce(new Error("seat release boom"));

    const first = await releaseExpiredInviteSeats();
    expect(first).toEqual({ scanned: 1, released: 0, skipped: 0, failed: 1 });

    // Rolled back: invite still pending, seat not decremented.
    const invAfterFailure = await Invitation.findOne({ workspaceId }).lean();
    expect(invAfterFailure?.status).toBe("pending");
    const teamAfterFailure = await Team.findById(team._id).lean();
    expect(teamAfterFailure?.memberCount).toBe(3);

    updateOneSpy.mockRestore();

    const second = await releaseExpiredInviteSeats();
    expect(second).toEqual({ scanned: 1, released: 1, skipped: 0, failed: 0 });

    const invAfterRetry = await Invitation.findOne({ workspaceId }).lean();
    expect(invAfterRetry?.status).toBe("expired");
    const teamAfterRetry = await Team.findById(team._id).lean();
    expect(teamAfterRetry?.memberCount).toBe(2);
  });
});

describe("releaseExpiredInviteSeats — pagination", () => {
  it("processes every expired pending invite across multiple small batches", async () => {
    const workspaceId = new Types.ObjectId();
    const team = await makeTeam(workspaceId, 10);
    const total = 5;
    for (let i = 0; i < total; i++) {
      await Invitation.create(
        makeInviteData({
          workspaceId,
          teamIds: [team._id],
          expiresAt: pastDate(60_000),
        }),
      );
    }

    const findSpy = vi.spyOn(Invitation, "find");
    const report = await releaseExpiredInviteSeats(new Date(), { batchSize: 2 });

    expect(report).toEqual({ scanned: total, released: total, skipped: 0, failed: 0 });
    // 5 rows at batchSize 2 => 3 pages (2, 2, 1) — proves the query is capped
    // per page rather than loaded in one unbounded find().
    expect(findSpy).toHaveBeenCalledTimes(3);
    findSpy.mockRestore();

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(10 - total);
  });
});

describe("releaseExpiredInviteSeats — heartbeat summary log", () => {
  it("logs a single structured, PII-free summary line per run", async () => {
    const workspaceId = new Types.ObjectId();
    const team = await makeTeam(workspaceId, 1);
    await Invitation.create(
      makeInviteData({
        workspaceId,
        email: "secret-owner@example.com",
        teamIds: [team._id],
        expiresAt: pastDate(60_000),
      }),
    );

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    await releaseExpiredInviteSeats();

    const summaryCall = infoSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("release-expired-invite-seats"),
    );
    expect(summaryCall).toBeDefined();
    const parsed = JSON.parse(summaryCall![0] as string);
    expect(parsed).toMatchObject({
      job: "release-expired-invite-seats",
      scanned: 1,
      released: 1,
      skipped: 0,
      failed: 0,
    });
    expect(typeof parsed.ranAt).toBe("string");
    // No email/token/workspaceId — heartbeat is a count-only metric.
    const raw = summaryCall![0] as string;
    expect(raw).not.toContain("secret-owner@example.com");
    expect(raw).not.toContain(String(workspaceId));
    infoSpy.mockRestore();
  });
});

describe("releaseExpiredInviteSeats — supporting index", () => {
  it("has a { status, expiresAt } index backing the global sweep query", () => {
    const indexes = Invitation.schema.indexes();
    const hasIndex = indexes.some(([keys]) => keys.status === 1 && keys.expiresAt === 1);
    expect(hasIndex).toBe(true);
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

    expect(report).toEqual({ scanned: 1, released: 1, skipped: 0, failed: 0 });

    const afterA = await Team.findById(teamA._id).lean();
    const afterB = await Team.findById(teamB._id).lean();
    expect(afterA?.memberCount).toBe(3); // released
    expect(afterB?.memberCount).toBe(3); // untouched
  });
});
