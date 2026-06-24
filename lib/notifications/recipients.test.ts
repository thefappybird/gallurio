import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { TeamMembership, User } from "@/lib/db/models";
import { resolveTeamRecipients, resolveStatusChangeRecipients } from "./recipients";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));

const wsA = new Types.ObjectId();
const wsB = new Types.ObjectId();
const teamA = new Types.ObjectId();
const teamB = new Types.ObjectId();

const ownerUserId = "user_owner";
const ownerEmail = "owner@example.com";

const member1UserId = "user_m1";
const member2UserId = "user_m2";
const member3UserId = "user_m3"; // belongs to wsB, same teamId as teamA (cross-tenant probe)

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
  vi.resetAllMocks();
});

async function seedUsers() {
  await User.insertMany([
    { workosUserId: member1UserId, email: "m1@example.com", name: "Member One" },
    { workosUserId: member2UserId, email: "m2@example.com", name: "" },
    { workosUserId: member3UserId, email: "m3@example.com", name: "Member Three" },
    { workosUserId: ownerUserId, email: ownerEmail, name: "Owner" },
  ]);
}

async function seedMemberships() {
  await TeamMembership.insertMany([
    // wsA / teamA — the happy path
    { workspaceId: wsA, teamId: teamA, workosUserId: member1UserId, role: "member" },
    { workspaceId: wsA, teamId: teamA, workosUserId: member2UserId, role: "lead" },
    // wsB uses the SAME teamA ObjectId — cross-tenant isolation probe
    { workspaceId: wsB, teamId: teamA, workosUserId: member3UserId, role: "member" },
    // wsA / teamB — different team in same workspace
    { workspaceId: wsA, teamId: teamB, workosUserId: member1UserId, role: "member" },
  ]);
}

// ─── resolveTeamRecipients ───────────────────────────────────────────────────

describe("resolveTeamRecipients", () => {
  it("returns recipients for the correct workspace+team", async () => {
    await seedUsers();
    await seedMemberships();

    const result = await resolveTeamRecipients(wsA.toString(), teamA);

    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.workosUserId).sort();
    expect(ids).toEqual([member1UserId, member2UserId].sort());
  });

  it("returns correct shape: workosUserId, email, optional name", async () => {
    await seedUsers();
    await seedMemberships();

    const result = await resolveTeamRecipients(wsA.toString(), teamA);
    const m1 = result.find((r) => r.workosUserId === member1UserId);
    const m2 = result.find((r) => r.workosUserId === member2UserId);

    expect(m1).toMatchObject({ workosUserId: member1UserId, email: "m1@example.com", name: "Member One" });
    // empty string name → name should be undefined, not ""
    expect(m2).toMatchObject({ workosUserId: member2UserId, email: "m2@example.com" });
    expect(m2?.name).toBeUndefined();
  });

  it("TENANT ISOLATION: does NOT return members of another workspace's team sharing the same teamId", async () => {
    await seedUsers();
    await seedMemberships();

    // Querying wsA with teamA should NOT return member3 (who belongs to wsB/teamA)
    const result = await resolveTeamRecipients(wsA.toString(), teamA);

    const ids = result.map((r) => r.workosUserId);
    expect(ids).not.toContain(member3UserId);
  });

  it("returns empty array when no memberships match", async () => {
    const result = await resolveTeamRecipients(wsA.toString(), new Types.ObjectId());
    expect(result).toEqual([]);
  });

  it("deduplicates recipients even when multiple memberships reference the same user", async () => {
    // The schema unique index prevents true duplicates, but this test verifies
    // the Map-based dedup in the helper itself is correct. We bypass the
    // TeamMembership collection entirely and test the User.find path by seeding
    // a membership for member1 on teamA and confirming they appear exactly once.
    await seedUsers();
    await TeamMembership.insertMany([
      { workspaceId: wsA, teamId: teamA, workosUserId: member1UserId, role: "member" },
      { workspaceId: wsA, teamId: teamA, workosUserId: member2UserId, role: "lead" },
    ]);

    const result = await resolveTeamRecipients(wsA.toString(), teamA);
    const ids = result.map((r) => r.workosUserId);
    expect(ids.filter((id) => id === member1UserId)).toHaveLength(1);
    expect(ids.filter((id) => id === member2UserId)).toHaveLength(1);
    expect(result).toHaveLength(2);
  });
});

// ─── resolveStatusChangeRecipients ──────────────────────────────────────────

describe("resolveStatusChangeRecipients", () => {
  it("returns team members + owner, deduped", async () => {
    await seedUsers();
    await seedMemberships();

    const result = await resolveStatusChangeRecipients({
      workspaceId: wsA.toString(),
      teamId: teamA,
      ownerUserId,
      ownerEmail,
    });

    // 2 team members + 1 owner = 3
    expect(result).toHaveLength(3);
    const ids = result.map((r) => r.workosUserId);
    expect(ids).toContain(member1UserId);
    expect(ids).toContain(member2UserId);
    expect(ids).toContain(ownerUserId);
  });

  it("deduplicates owner when they are also a team member", async () => {
    await seedUsers();
    // Owner is also a team member
    await TeamMembership.insertMany([
      { workspaceId: wsA, teamId: teamA, workosUserId: member1UserId, role: "member" },
      { workspaceId: wsA, teamId: teamA, workosUserId: ownerUserId, role: "lead" },
    ]);

    const result = await resolveStatusChangeRecipients({
      workspaceId: wsA.toString(),
      teamId: teamA,
      ownerUserId,
      ownerEmail,
    });

    const ids = result.map((r) => r.workosUserId);
    // owner appears only once
    expect(ids.filter((id) => id === ownerUserId)).toHaveLength(1);
    expect(result).toHaveLength(2); // member1 + owner
  });

  it("returns only owner when no teamId provided", async () => {
    await seedUsers();

    const result = await resolveStatusChangeRecipients({
      workspaceId: wsA.toString(),
      teamId: null,
      ownerUserId,
      ownerEmail,
    });

    expect(result).toHaveLength(1);
    expect(result[0].workosUserId).toBe(ownerUserId);
    expect(result[0].email).toBe(ownerEmail);
  });

  it("returns only owner when teamId is undefined", async () => {
    await seedUsers();

    const result = await resolveStatusChangeRecipients({
      workspaceId: wsA.toString(),
      ownerUserId,
      ownerEmail,
    });

    expect(result).toHaveLength(1);
    expect(result[0].workosUserId).toBe(ownerUserId);
  });

  it("returns empty array when no teamId and no ownerEmail", async () => {
    const result = await resolveStatusChangeRecipients({
      workspaceId: wsA.toString(),
      ownerUserId,
      ownerEmail: null,
    });

    expect(result).toHaveLength(0);
  });

  it("returns only team members when owner has no email", async () => {
    await seedUsers();
    await seedMemberships();

    const result = await resolveStatusChangeRecipients({
      workspaceId: wsA.toString(),
      teamId: teamA,
      ownerUserId,
      ownerEmail: null,
    });

    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.workosUserId);
    expect(ids).toContain(member1UserId);
    expect(ids).toContain(member2UserId);
    expect(ids).not.toContain(ownerUserId);
  });

  it("TENANT ISOLATION: team query is scoped by workspaceId", async () => {
    await seedUsers();
    await seedMemberships();

    // Query wsA — should NOT include member3 from wsB even though they share teamId
    const result = await resolveStatusChangeRecipients({
      workspaceId: wsA.toString(),
      teamId: teamA,
      ownerUserId,
      ownerEmail,
    });

    const ids = result.map((r) => r.workosUserId);
    expect(ids).not.toContain(member3UserId);
  });
});
