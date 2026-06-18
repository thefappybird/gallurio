import crypto from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";
import { Invitation } from "@/lib/db/models/Invitation";
import { TeamMembership } from "@/lib/db/models/teamMembership";

const WORKSPACE_ID = new Types.ObjectId();
const OTHER_WORKSPACE_ID = new Types.ObjectId();
const OWNER_USER_ID = "user_owner_workos";

// --- Mocks ---

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

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
      plan: "starter",
      name: "Test Workspace",
      country: "us",
    },
  })),
}));

// Mock Resend transport — controlled per-test via the exported spy.
const mockSendEmail = vi.fn().mockResolvedValue({ ok: true, id: "email_1" });
vi.mock("@/lib/email/send", () => ({
  sendEmail: mockSendEmail,
}));

// Stub NEXT_PUBLIC_APP_URL so the accept link is deterministic.
vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");

// --- Helpers ---

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  vi.clearAllMocks();
  mockSendEmail.mockResolvedValue({ ok: true, id: "email_1" });
});

async function makeTeam(
  overrides: Partial<{ workspaceId: Types.ObjectId; memberCount: number }> = {},
) {
  return Team.create({
    workspaceId: overrides.workspaceId ?? WORKSPACE_ID,
    name: "Crew",
    color: TEAM_COLOR_PALETTE[0],
    isDefault: false,
    memberCount: overrides.memberCount ?? 0,
    createdByWorkosUserId: OWNER_USER_ID,
  });
}

async function makeFullTeam(max = 10) {
  // "starter" plan max per team is 10. Fill to the limit.
  return Team.create({
    workspaceId: WORKSPACE_ID,
    name: "Full Crew",
    color: TEAM_COLOR_PALETTE[1],
    isDefault: false,
    memberCount: max,
    createdByWorkosUserId: OWNER_USER_ID,
  });
}

function sha256Hex(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

// --- Tests ---

describe("inviteMemberAction — basic success path", () => {
  it("creates an Invitation, reserves seats, sends email, stores hash not raw token", async () => {
    const team = await makeTeam();
    const { inviteMemberAction } = await import("./_invite-action");

    const result = await inviteMemberAction({
      email: "alice@example.com",
      teamIds: [String(team._id)],
      leadOnTeamIds: [],
    });

    expect(result.ok).toBe(true);

    const invite = await Invitation.findOne({
      workspaceId: WORKSPACE_ID,
      email: "alice@example.com",
    }).lean();
    expect(invite).toBeTruthy();
    expect(invite?.status).toBe("pending");
    expect(invite?.teamIds).toHaveLength(1);
    expect(invite?.tokenHash).toBeTruthy();
    // tokenHash is SHA-256 hex (64 chars), never the raw base64url token.
    expect(invite?.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    // Seat was reserved — memberCount incremented.
    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(1);

    // Email was sent and contains the accept URL.
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const emailArg = mockSendEmail.mock.calls[0]?.[0] as { to: string; html: string; text: string };
    expect(emailArg.to).toBe("alice@example.com");
    expect(emailArg.text).toContain("https://app.test/invite/accept?token=");

    // The raw token appears in the email but NOT in the DB.
    const rawInEmailMatch = emailArg.text.match(/token=([A-Za-z0-9_-]+)/);
    expect(rawInEmailMatch).toBeTruthy();
    const rawToken = rawInEmailMatch![1]!;
    expect(invite?.tokenHash).toBe(sha256Hex(decodeURIComponent(rawToken)));
    // The raw token itself is not stored anywhere.
    expect(invite?.tokenHash).not.toBe(rawToken);
  });
});

describe("inviteMemberAction — re-invite revokes prior", () => {
  it("revokes the old pending invite and releases seats, then creates a fresh one", async () => {
    const team1 = await Team.create({
      workspaceId: WORKSPACE_ID,
      name: "Alpha Crew",
      color: TEAM_COLOR_PALETTE[0],
      isDefault: false,
      memberCount: 0,
      createdByWorkosUserId: OWNER_USER_ID,
    });
    const team2 = await Team.create({
      workspaceId: WORKSPACE_ID,
      name: "Beta Crew",
      color: TEAM_COLOR_PALETTE[1],
      isDefault: false,
      memberCount: 0,
      createdByWorkosUserId: OWNER_USER_ID,
    });

    const { inviteMemberAction } = await import("./_invite-action");

    // First invite — team1 only.
    const first = await inviteMemberAction({
      email: "bob@example.com",
      teamIds: [String(team1._id)],
      leadOnTeamIds: [],
    });
    expect(first.ok).toBe(true);

    const t1Before = await Team.findById(team1._id).lean();
    expect(t1Before?.memberCount).toBe(1);

    // Re-invite — team2 only.
    const second = await inviteMemberAction({
      email: "bob@example.com",
      teamIds: [String(team2._id)],
      leadOnTeamIds: [],
    });
    expect(second.ok).toBe(true);

    // Old invite is revoked.
    const invites = await Invitation.find({
      workspaceId: WORKSPACE_ID,
      email: "bob@example.com",
    }).lean();
    expect(invites).toHaveLength(2);
    const revokedInvite = invites.find((i) => i.status === "revoked");
    const newInvite = invites.find((i) => i.status === "pending");
    expect(revokedInvite).toBeTruthy();
    expect(newInvite).toBeTruthy();
    expect(newInvite?.teamIds).toHaveLength(1);

    // Team1 seat was released, team2 seat reserved.
    const t1After = await Team.findById(team1._id).lean();
    const t2After = await Team.findById(team2._id).lean();
    expect(t1After?.memberCount).toBe(0);
    expect(t2After?.memberCount).toBe(1);
  });
});

describe("inviteMemberAction — seat cap failure", () => {
  it("does not create invite and returns TEAM_SEAT_CAP_EXCEEDED when team is full", async () => {
    const fullTeam = await makeFullTeam();
    const { inviteMemberAction } = await import("./_invite-action");

    const result = await inviteMemberAction({
      email: "carol@example.com",
      teamIds: [String(fullTeam._id)],
      leadOnTeamIds: [],
    });

    expect(result.error).toBe("TEAM_SEAT_CAP_EXCEEDED");

    const invite = await Invitation.findOne({
      workspaceId: WORKSPACE_ID,
      email: "carol@example.com",
    }).lean();
    expect(invite).toBeNull();

    // No seat was reserved.
    const teamAfter = await Team.findById(fullTeam._id).lean();
    expect(teamAfter?.memberCount).toBe(10);
  });
});

describe("inviteMemberAction — email send failure", () => {
  it("revokes the invitation and releases seats when email fails", async () => {
    mockSendEmail.mockResolvedValue({ ok: false, error: "resend_503" });

    const team = await makeTeam();
    const { inviteMemberAction } = await import("./_invite-action");

    const result = await inviteMemberAction({
      email: "dave@example.com",
      teamIds: [String(team._id)],
      leadOnTeamIds: [],
    });

    expect(result.error).toBe("EMAIL_SEND_FAILED");

    // Invitation was revoked so the never-received token can't be exploited.
    const invite = await Invitation.findOne({
      workspaceId: WORKSPACE_ID,
      email: "dave@example.com",
    }).lean();
    expect(invite?.status).toBe("revoked");

    // Seat was released.
    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(0);
  });
});

describe("inviteMemberAction — tenant isolation", () => {
  it("rejects teamIds belonging to another workspace", async () => {
    const foreignTeam = await makeTeam({ workspaceId: OTHER_WORKSPACE_ID });
    const { inviteMemberAction } = await import("./_invite-action");

    const result = await inviteMemberAction({
      email: "eve@example.com",
      teamIds: [String(foreignTeam._id)],
      leadOnTeamIds: [],
    });

    expect(result.error).toBe("TEAM_NOT_FOUND");

    const invite = await Invitation.findOne({
      email: "eve@example.com",
    }).lean();
    expect(invite).toBeNull();
  });
});

describe("revokeInviteAction — basic", () => {
  it("marks pending invite revoked and releases seats", async () => {
    const team = await makeTeam();
    const { inviteMemberAction, revokeInviteAction } = await import("./_invite-action");

    const inviteResult = await inviteMemberAction({
      email: "frank@example.com",
      teamIds: [String(team._id)],
      leadOnTeamIds: [],
    });
    expect(inviteResult.ok).toBe(true);

    const invite = await Invitation.findOne({
      workspaceId: WORKSPACE_ID,
      email: "frank@example.com",
      status: "pending",
    }).lean();
    expect(invite).toBeTruthy();

    const revokeResult = await revokeInviteAction({
      invitationId: String(invite!._id),
    });
    expect(revokeResult.ok).toBe(true);

    const after = await Invitation.findById(invite!._id).lean();
    expect(after?.status).toBe("revoked");
    expect(after?.revokedAt).toBeInstanceOf(Date);

    const teamAfter = await Team.findById(team._id).lean();
    expect(teamAfter?.memberCount).toBe(0);
  });

  it("returns INVITE_NOT_FOUND when invitationId belongs to another workspace", async () => {
    const team = await makeTeam({ workspaceId: OTHER_WORKSPACE_ID });
    // Create invite directly in other workspace.
    const foreignInvite = await Invitation.create({
      workspaceId: OTHER_WORKSPACE_ID,
      email: "spy@example.com",
      role: "staff",
      teamIds: [team._id],
      leadOnTeamIds: [],
      tokenHash: sha256Hex("foreign-token-xyz"),
      invitedByWorkosUserId: "user_other_owner",
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const { revokeInviteAction } = await import("./_invite-action");
    const result = await revokeInviteAction({
      invitationId: String(foreignInvite._id),
    });
    expect(result.error).toBe("INVITE_NOT_FOUND");

    // Foreign invite is untouched.
    const after = await Invitation.findById(foreignInvite._id).lean();
    expect(after?.status).toBe("pending");
  });
});

describe("inviteMemberAction â€” lead uniqueness", () => {
  it("rejects lead assignment when the team already has a lead member", async () => {
    const team = await makeTeam();
    await TeamMembership.create({
      workspaceId: WORKSPACE_ID,
      teamId: team._id,
      workosUserId: "existing-lead",
      role: "lead",
    });
    const { inviteMemberAction } = await import("./_invite-action");

    const result = await inviteMemberAction({
      email: "lead-blocked@example.com",
      teamIds: [String(team._id)],
      leadOnTeamIds: [String(team._id)],
    });

    expect(result.error).toBe("TEAM_ALREADY_HAS_LEAD");
    expect(result.leadTakenTeamNames).toEqual(["Crew"]);
    expect(
      await Invitation.findOne({
        workspaceId: WORKSPACE_ID,
        email: "lead-blocked@example.com",
      }).lean(),
    ).toBeNull();
  });

  it("rejects lead assignment when a pending invite already claims team lead", async () => {
    const team = await makeTeam();
    await Invitation.create({
      workspaceId: WORKSPACE_ID,
      email: "pending@example.com",
      role: "staff",
      teamIds: [team._id],
      leadOnTeamIds: [team._id],
      tokenHash: sha256Hex("pending-lead-token"),
      invitedByWorkosUserId: OWNER_USER_ID,
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const { inviteMemberAction } = await import("./_invite-action");

    const result = await inviteMemberAction({
      email: "next@example.com",
      teamIds: [String(team._id)],
      leadOnTeamIds: [String(team._id)],
    });

    expect(result.error).toBe("TEAM_ALREADY_HAS_LEAD");
    expect(result.leadTakenTeamNames).toEqual(["Crew"]);
  });
});
