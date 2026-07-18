/**
 * Tests for app/api/auth/callback/route.ts
 *
 * Covers the invite-cookie forwarding path (callback reads gw_invite_token and
 * redirects to /invite/accept with NO token in the URL) and the OAuth CSRF
 * binding (the oauth_csrf cookie nonce must match the signed-state nonce).
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
type MockCallbackUser = {
  memberships: { role: "owner" | "staff" }[];
  onboardingCompletedAt: Date | null;
};
const mockEnsureUser = vi.fn<() => Promise<MockCallbackUser>>(async () => ({
  memberships: [],
  onboardingCompletedAt: null,
}));

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
  // sealSession:true is requested, so the SDK returns a sealed session string,
  // which the route sets directly on the response as the wos-session cookie.
  sealedSession: "sealed_session_value_for_tests",
};

// Shared CSRF nonce — embedded in the signed state and mirrored in the cookie.
const NONCE = "csrf_nonce_test_abc123456789";

/** State carrying the shared CSRF nonce (so the callback's nonce check passes). */
function signedState(extra: Record<string, unknown> = {}): string {
  return signOAuthState({ locale: "en", nonce: NONCE, ...extra });
}

function makeReq(
  url: string,
  opts: { inviteCookieValue?: string; csrfCookieValue?: string | null } = {},
): NextRequest {
  const req = new NextRequest(url);
  // happy-dom does not propagate the Cookie header into NextRequest.cookies, so
  // set cookies directly on the request cookies store.
  if (opts.inviteCookieValue != null) {
    req.cookies.set("gw_invite_token", opts.inviteCookieValue);
  }
  // Default to a matching CSRF cookie so the nonce check passes. Tests that
  // exercise the rejection pass csrfCookieValue: null (absent) or a mismatch.
  const csrf = opts.csrfCookieValue === undefined ? NONCE : opts.csrfCookieValue;
  if (csrf != null) {
    req.cookies.set("oauth_csrf", csrf);
  }
  return req;
}

function buildCallbackUrl(params: { code?: string; state?: string }): string {
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
    mockEnsureUser.mockResolvedValue({
      memberships: [],
      onboardingCompletedAt: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /invite/accept (no token param) when gw_invite_token cookie is present", async () => {
    const { GET } = await loadRoute();
    const url = buildCallbackUrl({ code: "code_abc", state: signedState() });

    const res = await GET(makeReq(url, { inviteCookieValue: "raw_tok_xyz" }));

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/invite/accept");
    // Must NOT put any token in the URL.
    expect(location).not.toContain("token=");
    expect(location).not.toContain("raw_tok_xyz");
  });

  it("does NOT redirect to /invite/accept when gw_invite_token cookie is absent", async () => {
    const { GET } = await loadRoute();
    const url = buildCallbackUrl({ code: "code_abc", state: signedState() });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("/invite/accept");
    // Falls through to onboarding when the user has no workspace yet.
    expect(location).toContain("/onboarding");
  });

  it("defaults staff users to bookings when no returnTo is provided", async () => {
    mockEnsureUser.mockResolvedValueOnce({
      memberships: [{ role: "staff" }],
      onboardingCompletedAt: null,
    });
    const { GET } = await loadRoute();
    const url = buildCallbackUrl({ code: "code_staff", state: signedState() });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/bookings");
  });

  it("defaults completed owners to dashboard when no returnTo is provided", async () => {
    mockEnsureUser.mockResolvedValueOnce({
      memberships: [{ role: "owner" }],
      onboardingCompletedAt: new Date(),
    });
    const { GET } = await loadRoute();
    const url = buildCallbackUrl({ code: "code_owner", state: signedState() });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/dashboard");
  });

  it("respects returnTo over dashboard when no invite cookie and returnTo is valid", async () => {
    const { GET } = await loadRoute();
    const url = buildCallbackUrl({
      code: "code_abc",
      state: signedState({ returnTo: "/bookings" }),
    });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/bookings");
  });

  it("uses the configured public app origin instead of an internal request origin", async () => {
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://dev.gallurio.com/";
    try {
      const { GET } = await loadRoute();
      const url = buildCallbackUrl({ code: "code_abc", state: signedState() });

      const res = await GET(makeReq(url));

      expect(res.headers.get("location")).toBe("https://dev.gallurio.com/onboarding");
    } finally {
      if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
  });

  it("invite cookie takes priority over returnTo when both are present", async () => {
    const { GET } = await loadRoute();
    const url = buildCallbackUrl({
      code: "code_abc",
      state: signedState({ returnTo: "/bookings" }),
    });

    const res = await GET(makeReq(url, { inviteCookieValue: "tok_priority" }));

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/invite/accept");
    expect(location).not.toContain("token=");
  });

  it("redirects to sign-in on auth failure regardless of invite cookie", async () => {
    const { GET } = await loadRoute();
    mockAuthenticateWithCode.mockRejectedValue(new Error("auth failed"));

    const url = buildCallbackUrl({ code: "code_bad", state: signedState() });

    const res = await GET(makeReq(url, { inviteCookieValue: "tok_fail" }));

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/sign-in");
    expect(location).not.toContain("/invite/accept");
  });

  it("does not carry open-redirect risk from returnTo when invite cookie is absent", async () => {
    const { GET } = await loadRoute();
    // An open-redirect attempt — must be blocked.
    const url = buildCallbackUrl({
      code: "code_abc",
      state: signedState({ returnTo: "//evil.example.com/steal" }),
    });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("evil.example.com");
    expect(location).toContain("/onboarding");
  });
});

describe("GET /api/auth/callback — CSRF state binding", () => {
  beforeEach(() => {
    mockAuthenticateWithCode.mockResolvedValue(MOCK_AUTH_RESPONSE);
  });
  afterEach(() => vi.clearAllMocks());

  it("rejects to sign-in when the oauth_csrf cookie is absent", async () => {
    const { GET } = await loadRoute();
    const url = buildCallbackUrl({ code: "code_abc", state: signedState() });

    // No CSRF cookie on the request even though the state carries a nonce.
    const res = await GET(makeReq(url, { csrfCookieValue: null }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/sign-in");
    // The code must NOT be exchanged when the CSRF check fails.
    expect(mockAuthenticateWithCode).not.toHaveBeenCalled();
  });

  it("rejects to sign-in when the cookie nonce does not match the state nonce", async () => {
    const { GET } = await loadRoute();
    const url = buildCallbackUrl({ code: "code_abc", state: signedState() });

    const res = await GET(makeReq(url, { csrfCookieValue: "a-different-nonce" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/sign-in");
    expect(mockAuthenticateWithCode).not.toHaveBeenCalled();
  });

  it("rejects when the state has no nonce even if a cookie is present", async () => {
    const { GET } = await loadRoute();
    // State without a nonce (e.g. a forged/legacy state) must not pass.
    const stateNoNonce = signOAuthState({ locale: "en" });
    const url = buildCallbackUrl({ code: "code_abc", state: stateNoNonce });

    const res = await GET(makeReq(url, { csrfCookieValue: NONCE }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/sign-in");
    expect(mockAuthenticateWithCode).not.toHaveBeenCalled();
  });

  it("clears the oauth_csrf cookie on a successful exchange", async () => {
    const { GET } = await loadRoute();
    const url = buildCallbackUrl({ code: "code_abc", state: signedState() });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("oauth_csrf=");
    expect(setCookie.toLowerCase()).toMatch(/max-age=0|expires=/);
  });

  it("sets the wos-session cookie ON THE RESPONSE on a successful exchange", async () => {
    // Regression guard: saveSession()'s cookies()-store write is NOT merged into
    // a manually-returned NextResponse, so the session must be set on the
    // response object directly or the user is bounced straight back to sign-in.
    const { GET } = await loadRoute();
    const url = buildCallbackUrl({ code: "code_abc", state: signedState() });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    const sessionCookie = res.cookies.get("wos-session");
    expect(sessionCookie?.value).toBe("sealed_session_value_for_tests");
  });

  it("redirects to sign-in when the exchange returns no sealedSession", async () => {
    mockAuthenticateWithCode.mockResolvedValueOnce({
      user: MOCK_AUTH_RESPONSE.user,
      // sealedSession intentionally omitted
    });
    const { GET } = await loadRoute();
    const url = buildCallbackUrl({ code: "code_abc", state: signedState() });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/sign-in");
  });
});

describe("GET /api/auth/callback — missing code", () => {
  it("redirects to sign-in when code is absent", async () => {
    const { GET } = await loadRoute();
    const url = buildCallbackUrl({ state: signedState() });

    const res = await GET(makeReq(url));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });
});
