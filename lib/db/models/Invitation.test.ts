import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Invitation } from "@/lib/db/models";
import { Types } from "mongoose";

beforeAll(async () => {
  await startInMemoryMongo();
  await Invitation.createIndexes();
});
afterAll(async () => { await stopInMemoryMongo(); });
afterEach(async () => { await clearCollections(); });

function makeInvite(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: new Types.ObjectId(),
    email: "alice@example.com",
    role: "staff",
    teamIds: [],
    leadOnTeamIds: [],
    tokenHash: `hash_${Math.random().toString(36).slice(2)}`,
    invitedByWorkosUserId: "user_owner_1",
    status: "pending",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

describe("Invitation model — basic CRUD", () => {
  it("creates an invitation with required fields", async () => {
    const inv = await Invitation.create(makeInvite());
    expect(inv._id).toBeDefined();
    expect(inv.status).toBe("pending");
    expect(inv.email).toBe("alice@example.com");
  });

  it("lowercases email on write", async () => {
    const inv = await Invitation.create(makeInvite({ email: "ALICE@Example.COM" }));
    expect(inv.email).toBe("alice@example.com");
  });

  it("defaults acceptedAt and revokedAt to null", async () => {
    const inv = await Invitation.create(makeInvite());
    expect(inv.acceptedAt).toBeNull();
    expect(inv.revokedAt).toBeNull();
  });

  it("rejects an invalid status", async () => {
    await expect(
      Invitation.create(makeInvite({ status: "unknown" }))
    ).rejects.toThrow();
  });

  it("rejects an invalid role", async () => {
    await expect(
      Invitation.create(makeInvite({ role: "superadmin" }))
    ).rejects.toThrow();
  });
});

describe("Invitation model — token hash uniqueness", () => {
  it("rejects duplicate tokenHash across workspaces", async () => {
    const hash = "fixed_hash_abc123";
    await Invitation.create(makeInvite({ tokenHash: hash }));
    await expect(
      Invitation.create(makeInvite({ tokenHash: hash, workspaceId: new Types.ObjectId() }))
    ).rejects.toThrow();
  });

  it("allows different hashes for the same workspace+email (after revoke)", async () => {
    const wsId = new Types.ObjectId();
    await Invitation.create(
      makeInvite({ workspaceId: wsId, tokenHash: "hash_a", status: "revoked" })
    );
    const inv2 = await Invitation.create(
      makeInvite({ workspaceId: wsId, tokenHash: "hash_b" })
    );
    expect(inv2._id).toBeDefined();
  });
});

describe("Invitation model — pending uniqueness per workspace+email", () => {
  it("rejects a second pending invite for the same workspace+email", async () => {
    const wsId = new Types.ObjectId();
    await Invitation.create(makeInvite({ workspaceId: wsId, tokenHash: "hash_x" }));
    await expect(
      Invitation.create(
        makeInvite({ workspaceId: wsId, tokenHash: "hash_y" })
      )
    ).rejects.toThrow();
  });

  it("allows a new pending invite once the previous one is accepted", async () => {
    const wsId = new Types.ObjectId();
    await Invitation.create(
      makeInvite({ workspaceId: wsId, tokenHash: "hash_p1", status: "accepted" })
    );
    const inv2 = await Invitation.create(
      makeInvite({ workspaceId: wsId, tokenHash: "hash_p2", status: "pending" })
    );
    expect(inv2._id).toBeDefined();
  });

  it("allows simultaneous pending invites for different workspaces", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    await Invitation.create(makeInvite({ workspaceId: wsA, tokenHash: "hash_wa" }));
    const inv2 = await Invitation.create(
      makeInvite({ workspaceId: wsB, tokenHash: "hash_wb" })
    );
    expect(inv2._id).toBeDefined();
  });
});

describe("Invitation model — expiry", () => {
  it("stores expiresAt and can be queried", async () => {
    const expiresAt = new Date(Date.now() + 1000);
    const inv = await Invitation.create(makeInvite({ expiresAt }));
    const found = await Invitation.findById(inv._id).lean();
    expect(found?.expiresAt.getTime()).toBe(expiresAt.getTime());
  });

  it("sweep query finds pending invites past their TTL", async () => {
    const past = new Date(Date.now() - 1000);
    const wsId = new Types.ObjectId();
    await Invitation.create(makeInvite({ workspaceId: wsId, expiresAt: past }));
    const expired = await Invitation.find({
      workspaceId: wsId,
      status: "pending",
      expiresAt: { $lt: new Date() },
    }).lean();
    expect(expired).toHaveLength(1);
  });
});
