/**
 * Tests for app/api/auth/callback/route.ts
 *
 * Focus: the invite-cookie forwarding path introduced in the invite-token
 * hardening (callback reads gw_invite_token cookie and redirects to
 * /invite/accept with NO token in the URL).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signOAuthState } from "@/lib/auth/oauthState";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = "test-secret-callback";
process.env.WORKOS_COOKIE_PASSWORD = "test-cookie-password-at-least-32-chars!";
// NODE_ENV is set by the test runner; no override needed.

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

const mockAuthenticateWithCode = vi.fn();
const mockSaveSession = vi.fn(async () => undefined);
const mockEnsureUser = vi.fn(async () => undefined);

vi.mock("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: vi.fn(() => ({
    userManagement: {
      authenticateWithCode: mockAuthenticateWithCode,
    },
  })),
  saveSession: mockSaveSession,
}));

vi.mock("@/lib/auth/ensureUser", () => ({
  ensureUser: mockEnsureUser,
}));

// Routing — supply a minimal stub so the import doesn't blow up.
vi.mock("@/lib/i18n/routing", () => ({
  routing: { defaultLocale: "en" },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_AUTH_RESPONSE = {
  user: {
    id: "wos_user_callback_1",
    email: "callback@example.com",
    firstName: "Callback",
    lastName: "User",
    profilePictureUrl: null,
  },
};

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

function buildCallbackUrl(params: {
  code?: string;
  state?: string;
}): string {
  const u = new URL("http://localhost/api/auth/callback");
  if (params.code) u.searchParams.set("code", params.code);
  if (params.state) u.searchParams.set("state", params.state);
  return u.toString();
}

async function loadRoute() {
  return import("./route");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/callback — invite cookie forwarding", () => {
  beforeEach(() => {
    mockAuthenticateWithCode.mockResolvedValue(MOCK_AUTH_RESPONSE);
    mockSaveSession.mockResolvedValue(undefined);
    mockEnsureUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /invite/accept (no token param) when gw_invite_token cookie is present", async () => {
    const { GET } = await loadRoute();
    const state = signOAuthState({ locale: "en" });
    const url = buildCallbackUrl({ code: "code_abc", state });

    const res = await GET(
      makeReq(url, { inviteCookieValue: "raw_tok_xyz" }),
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/invite/accept");
    // Must NOT put any token in the URL.
    expect(location).not.toContain("token=");
    expect(location).not.toContain("raw_tok_xyz");
  });

  it("does NOT redirect to /invite/accept when gw_invite_token cookie is absent", async () => {
    const { GET } = await loadRoute();
    const state = signOAuthState({ locale: "en" });
    const url = buildCallbackUrl({ code: "code_abc", state });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("/invite/accept");
    // Falls through to the localized dashboard.
    expect(location).toContain("/dashboard");
  });

  it("respects returnTo over dashboard when no invite cookie and returnTo is valid", async () => {
    const { GET } = await loadRoute();
    const state = signOAuthState({ locale: "en", returnTo: "/bookings" });
    const url = buildCallbackUrl({ code: "code_abc", state });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/bookings");
  });

  it("invite cookie takes priority over returnTo when both are present", async () => {
    const { GET } = await loadRoute();
    const state = signOAuthState({ locale: "en", returnTo: "/bookings" });
    const url = buildCallbackUrl({ code: "code_abc", state });

    const res = await GET(
      makeReq(url, { inviteCookieValue: "tok_priority" }),
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/invite/accept");
    expect(location).not.toContain("token=");
  });

  it("redirects to sign-in on auth failure regardless of invite cookie", async () => {
    const { GET } = await loadRoute();
    mockAuthenticateWithCode.mockRejectedValue(new Error("auth failed"));

    const state = signOAuthState({ locale: "en" });
    const url = buildCallbackUrl({ code: "code_bad", state });

    const res = await GET(
      makeReq(url, { inviteCookieValue: "tok_fail" }),
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/sign-in");
    expect(location).not.toContain("/invite/accept");
  });

  it("does not carry open-redirect risk from returnTo when invite cookie is absent", async () => {
    const { GET } = await loadRoute();
    // An open-redirect attempt — must be blocked.
    const state = signOAuthState({
      locale: "en",
      returnTo: "//evil.example.com/steal",
    });
    const url = buildCallbackUrl({ code: "code_abc", state });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("evil.example.com");
    expect(location).toContain("/dashboard");
  });
});

describe("GET /api/auth/callback — missing code", () => {
  it("redirects to sign-in when code is absent", async () => {
    const { GET } = await loadRoute();
    const state = signOAuthState({ locale: "en" });
    const url = buildCallbackUrl({ state });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });
});
