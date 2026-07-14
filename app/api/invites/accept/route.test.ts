/**
 * Tests for app/api/invites/accept/route.ts
 *
 * Focus: security-critical cookie behavior introduced in the invite-token
 * hardening (no token in OAuth state / URL after initial email link).
 *
 * DB interactions are mocked; the in-memory Mongo harness is not needed for
 * these unit-level assertions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = "test-secret-invite-accept";
// NODE_ENV is set by the test runner; no override needed.

// ---------------------------------------------------------------------------
// Module mocks (hoisted before any import)
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

// Default: no authenticated user. Tests that need one override via
// mockGetAuthUser.mockResolvedValueOnce(...)
vi.mock("@/lib/auth/session", () => ({ getAuthUser: vi.fn(async () => null) }));

// Default: invitation not found. Tests override per-case.
vi.mock("@/lib/db/models/Invitation", () => ({
  Invitation: {
    findOne: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => null),
    })),
    // The route chains .select(...).lean() on this inside the transaction.
    findOneAndUpdate: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => null),
    })),
  },
}));

vi.mock("@/lib/db/models/User", () => ({
  User: {
    // Pre-transaction membership check — no existing memberships by default.
    findOne: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => ({ memberships: [] })),
    })),
    findOneAndUpdate: vi.fn(async () => ({
      workosUserId: "wos_user_1",
      memberships: [],
    })),
    updateOne: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/db/models/teamMembership", () => ({
  TeamMembership: { create: vi.fn(async () => undefined) },
}));

vi.mock("@/lib/auth/activeWorkspace", () => ({
  setActiveWorkspace: vi.fn(async () => undefined),
}));

// Mongoose session + transaction
vi.mock("mongoose", async (importActual) => {
  const actual = await importActual<typeof import("mongoose")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      startSession: vi.fn(async () => ({
        withTransaction: vi.fn(async (fn: () => Promise<void>) => fn()),
        endSession: vi.fn(async () => undefined),
      })),
    },
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { getAuthUser } from "@/lib/auth/session";
import { Invitation } from "@/lib/db/models/Invitation";
import { User } from "@/lib/db/models/User";

const mockGetAuthUser = vi.mocked(getAuthUser);
const mockInvitationFindOne = vi.mocked(Invitation.findOne);
const mockInvitationFindOneAndUpdate = vi.mocked(Invitation.findOneAndUpdate);
const mockUserFindOne = vi.mocked(User.findOne);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(
  url: string,
  opts: { inviteCookieValue?: string } = {},
): NextRequest {
  const req = new NextRequest(url);
  // happy-dom does not propagate the Cookie header into NextRequest.cookies, so
  // set the cookie directly on the request cookies store.
  if (opts.inviteCookieValue != null) {
    req.cookies.set("gw_invite_token", opts.inviteCookieValue);
  }
  return req;
}

function wireValidInvitation(email = "invitee@example.com") {
  mockInvitationFindOne.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    lean: vi.fn(async () => ({
      _id: "inv_1",
      workspaceId: "ws_1",
      email,
      role: "staff",
      teamIds: [],
      leadOnTeamIds: [],
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })),
  } as never);
  // Route chains .select(...).lean() on findOneAndUpdate inside the transaction.
  mockInvitationFindOneAndUpdate.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    lean: vi.fn(async () => ({ _id: "inv_1" })),
  } as never);
}

async function loadRoute() {
  // Dynamic import so mocks are applied before module evaluation.
  return import("./route");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/invites/accept — missing token", () => {
  it("redirects to error=invalid when no token and no cookie", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeReq("http://localhost/api/invites/accept"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid");
  });
});

describe("GET /api/invites/accept — non-pending invitation status", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to error=revoked when the invitation status is revoked", async () => {
    const { GET } = await loadRoute();
    mockInvitationFindOne.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => ({
        _id: "inv_revoked",
        workspaceId: "ws_1",
        email: "revoked@example.com",
        role: "staff",
        teamIds: [],
        leadOnTeamIds: [],
        status: "revoked",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })),
    } as never);

    const res = await GET(
      makeReq("http://localhost/api/invites/accept?token=tok_revoked"),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=revoked");
  });

  it("redirects to error=expired when the invitation status is already expired (pre-flipped by the sweep)", async () => {
    const { GET } = await loadRoute();
    mockInvitationFindOne.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => ({
        _id: "inv_expired",
        workspaceId: "ws_1",
        email: "expired@example.com",
        role: "staff",
        teamIds: [],
        leadOnTeamIds: [],
        status: "expired",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })),
    } as never);

    const res = await GET(
      makeReq("http://localhost/api/invites/accept?token=tok_expired"),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=expired");
  });
});

describe("GET /api/invites/accept — unauthenticated branch (cookie hardening)", () => {
  beforeEach(() => {
    mockGetAuthUser.mockResolvedValue(null);
    wireValidInvitation();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sets gw_invite_token httpOnly cookie on the redirect response", async () => {
    const { GET } = await loadRoute();
    const rawToken = "raw_invite_token_abc123";
    const res = await GET(
      makeReq(`http://localhost/api/invites/accept?token=${rawToken}`),
    );

    expect(res.status).toBe(307);

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("gw_invite_token=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain("Max-Age=900");
    // The raw token must be present in the cookie value.
    expect(setCookie).toContain(rawToken);
  });

  it("does NOT put the raw token in the redirect URL", async () => {
    const { GET } = await loadRoute();
    const rawToken = "raw_invite_token_abc123";
    const res = await GET(
      makeReq(`http://localhost/api/invites/accept?token=${rawToken}`),
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    // Token must NOT appear in the Location header (OAuth sign-up URL).
    expect(location).not.toContain(rawToken);
    // It should redirect to the sign-up page.
    expect(location).toContain("/sign-up");
  });

  it("prefills the invited email on the sign-up redirect", async () => {
    const { GET } = await loadRoute();
    const rawToken = "raw_invite_token_prefill";
    const res = await GET(
      makeReq(`http://localhost/api/invites/accept?token=${rawToken}`),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toContain("/sign-up");
    expect(location.searchParams.get("email")).toBe("invitee@example.com");
  });

  it("does NOT embed the token in the signed OAuth state query param", async () => {
    const { GET } = await loadRoute();
    const rawToken = "tok_state_check";
    const res = await GET(
      makeReq(`http://localhost/api/invites/accept?token=${rawToken}`),
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    const locationUrl = new URL(location);
    const state = locationUrl.searchParams.get("state") ?? "";

    // Decode the base64url payload and verify no inviteToken field.
    const dot = state.lastIndexOf(".");
    expect(dot).toBeGreaterThan(0);
    const encoded = state.slice(0, dot);
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4;
    const decoded = Buffer.from(
      pad ? padded + "=".repeat(4 - pad) : padded,
      "base64",
    ).toString("utf8");
    const payload = JSON.parse(decoded);

    expect(payload).not.toHaveProperty("inviteToken");
    // The raw token must not appear anywhere in the state string.
    expect(state).not.toContain(rawToken);
  });
});

describe("GET /api/invites/accept — one workspace per email", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to error=already_member when the user already belongs to a different workspace", async () => {
    const { GET } = await loadRoute();
    wireValidInvitation("member@example.com");
    mockGetAuthUser.mockResolvedValue({
      workosUserId: "wos_user_elsewhere",
      email: "member@example.com",
      name: "Member User",
      avatarUrl: null,
    });
    mockUserFindOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => ({
        memberships: [{ workspaceId: "ws_other", role: "staff" }],
      })),
    } as never);

    const res = await GET(
      makeReq("http://localhost/api/invites/accept?token=tok_already_member"),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=already_member");
  });

  it("proceeds when the user's only membership is to this same invited workspace", async () => {
    const { GET } = await loadRoute();
    wireValidInvitation("resident@example.com");
    mockGetAuthUser.mockResolvedValue({
      workosUserId: "wos_user_resident",
      email: "resident@example.com",
      name: "Resident User",
      avatarUrl: null,
    });
    mockUserFindOne.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => ({
        memberships: [{ workspaceId: "ws_1", role: "staff" }],
      })),
    } as never);

    const res = await GET(
      makeReq("http://localhost/api/invites/accept?token=tok_resident"),
    );

    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("error=already_member");
    expect(location).toContain("/bookings");
  });
});

describe("GET /api/invites/accept — returning from OAuth (cookie path)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reads the token from the cookie when query param is absent", async () => {
    const { GET } = await loadRoute();
    const rawToken = "tok_from_cookie";

    // Wire a valid invitation for this token.
    mockInvitationFindOne.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => ({
        _id: "inv_cookie",
        workspaceId: "ws_cookie",
        email: "user@example.com",
        role: "staff",
        teamIds: [],
        leadOnTeamIds: [],
        status: "pending",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })),
    } as never);
    mockInvitationFindOneAndUpdate.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => ({ _id: "inv_cookie" })),
    } as never);

    // Authenticated user so the route proceeds past the auth check.
    mockGetAuthUser.mockResolvedValue({
      workosUserId: "wos_user_cookie",
      email: "user@example.com",
      name: "User Name",
      avatarUrl: null,
    });

    // No ?token= in the URL — only the cookie.
    const res = await GET(
      makeReq("http://localhost/api/invites/accept", {
        inviteCookieValue: rawToken,
      }),
    );

    // Should NOT redirect to invalid — it found the invitation via the cookie.
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("error=invalid");
    // The URL should NOT contain the raw token at any point.
    expect(location).not.toContain(rawToken);
  });

  it("clears the gw_invite_token cookie on successful accept (cookie path)", async () => {
    const { GET } = await loadRoute();
    const rawToken = "tok_clear_on_success";

    mockInvitationFindOne.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => ({
        _id: "inv_clear",
        workspaceId: "ws_clear",
        email: "clear@example.com",
        role: "staff",
        teamIds: [],
        leadOnTeamIds: [],
        status: "pending",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })),
    } as never);
    mockInvitationFindOneAndUpdate.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => ({ _id: "inv_clear" })),
    } as never);
    mockGetAuthUser.mockResolvedValue({
      workosUserId: "wos_user_clear",
      email: "clear@example.com",
      name: "Clear User",
      avatarUrl: null,
    });

    const res = await GET(
      makeReq("http://localhost/api/invites/accept", {
        inviteCookieValue: rawToken,
      }),
    );

    // Success redirect (to /bookings).
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/bookings");

    // The Set-Cookie header must expire the invite cookie.
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("gw_invite_token=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("does NOT set a clear cookie when token came from query param (not cookie)", async () => {
    const { GET } = await loadRoute();
    const rawToken = "tok_query_param_path";

    mockInvitationFindOne.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => ({
        _id: "inv_qp",
        workspaceId: "ws_qp",
        email: "qp@example.com",
        role: "staff",
        teamIds: [],
        leadOnTeamIds: [],
        status: "pending",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })),
    } as never);
    mockInvitationFindOneAndUpdate.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => ({ _id: "inv_qp" })),
    } as never);
    mockGetAuthUser.mockResolvedValue({
      workosUserId: "wos_user_qp",
      email: "qp@example.com",
      name: "QP User",
      avatarUrl: null,
    });

    // Token in the query param, no cookie.
    const res = await GET(
      makeReq(`http://localhost/api/invites/accept?token=${rawToken}`),
    );

    // Success redirect.
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/bookings");

    // No Set-Cookie for the invite token on this path.
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).not.toContain("gw_invite_token");
  });
});
