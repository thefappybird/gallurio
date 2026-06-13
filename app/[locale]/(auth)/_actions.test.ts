import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { __resetAuthRateLimitForTests } from "@/lib/server/authRateLimit";

// ---------------------------------------------------------------------------
// Hoist shared state so vi.mock factories can access it before initialization
// ---------------------------------------------------------------------------

const {
  mockCookieJar,
  mockHeaders,
  mockWorkos,
  getTurnstileResult,
  setTurnstileResult,
} = vi.hoisted(() => {
  const mockCookieJar: Record<string, string> = {};
  const mockHeaders: Record<string, string> = { "x-forwarded-for": "127.0.0.1" };
  let turnstileResult = true;

  const mockWorkos = {
    userManagement: {
      authenticateWithPassword: vi.fn(),
      authenticateWithTotp: vi.fn(),
      authenticateWithEmailVerification: vi.fn(),
      createUser: vi.fn(),
      createPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
      sendVerificationEmail: vi.fn(),
      getAuthorizationUrl: vi.fn(),
    },
    multiFactorAuth: {
      listUserAuthFactors: vi.fn(),
      challengeFactor: vi.fn(),
    },
  };

  return {
    mockCookieJar,
    mockHeaders,
    mockWorkos,
    getTurnstileResult: () => turnstileResult,
    setTurnstileResult: (v: boolean) => { turnstileResult = v; },
  };
});

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      mockCookieJar[name] ? { value: mockCookieJar[name] } : undefined,
    set: (name: string, value: string) => {
      mockCookieJar[name] = value;
    },
    delete: (name: string) => {
      delete mockCookieJar[name];
    },
  })),
  headers: vi.fn(async () => ({
    get: (name: string) => mockHeaders[name] ?? null,
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "en"),
  getTranslations: vi.fn(async () => (key: string, params?: Record<string, unknown>) => {
    if (key === "errors.tooManyAttempts")
      return `Too many attempts. Try again in ${params?.seconds ?? 0} seconds.`;
    if (key === "errors.invalidCredentials") return "Invalid email or password.";
    if (key === "errors.botCheck") return "Bot check failed. Please try again.";
    if (key === "errors.passwordMismatch") return "Passwords do not match.";
    if (key === "errors.invalidCode") return "Invalid or expired code. Please try again.";
    if (key === "errors.sessionExpired") return "Your session has expired. Please sign in again.";
    if (key === "errors.resetTokenInvalid") return "This link is invalid or has expired.";
    if (key === "errors.invalidInput") return "Please check your input and try again.";
    if (key === "errors.generic") return "Something went wrong. Please try again.";
    return key;
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock("@/lib/server/turnstile", () => ({
  verifyTurnstileToken: vi.fn(async () => getTurnstileResult()),
}));

vi.mock("@/lib/workos", () => ({ workos: mockWorkos }));

vi.mock("@/lib/auth/ensureUser", () => ({
  ensureUser: vi.fn(async () => ({ _id: "mongo-user-id" })),
}));

vi.mock("@/lib/auth/oauthState", () => ({
  signOAuthState: vi.fn(() => "signed-state-token"),
}));

// authkit-nextjs imports next/cache which is not resolvable in the test env.
// Mock the whole package — we don't use it directly in _actions.ts.
vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: null })),
  saveSession: vi.fn(async () => undefined),
}));

// getAuthUser uses @workos-inc/authkit-nextjs internally; mock it at the module level.
vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn(async () => ({
    workosUserId: "wos-user-123",
    email: "test@example.com",
    name: "Test User",
    avatarUrl: null,
  })),
}));

// ---------------------------------------------------------------------------
// Import actions AFTER mocks
// ---------------------------------------------------------------------------

import {
  signInAction,
  signUpAction,
  forgotPasswordAction,
  resetPasswordAction,
  verifyEmailAction,
  mfaChallengeAction,
  googleSignInAction,
} from "@/app/[locale]/(auth)/_actions";
import { signOAuthState } from "@/lib/auth/oauthState";
import { AuthenticationException } from "@workos-inc/node";

// Helper: build FormData
function fd(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    form.set(k, v);
  }
  return form;
}

function sealedResponse(overrides: Partial<{
  sealedSession: string;
  user: { id: string; email: string; firstName: string; lastName: string; profilePictureUrl: string | null };
}> = {}) {
  return {
    sealedSession: "sealed-session-token",
    user: {
      id: "wos-user-123",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      profilePictureUrl: null,
    },
    accessToken: "at",
    refreshToken: "rt",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
  await __resetAuthRateLimitForTests();
  // Reset cookie jar
  for (const k of Object.keys(mockCookieJar)) delete mockCookieJar[k];
  vi.clearAllMocks();
  setTurnstileResult(true);
});

// ---------------------------------------------------------------------------
// signInAction
// ---------------------------------------------------------------------------

describe("signInAction", () => {
  it("rejects on Turnstile failure", async () => {
    setTurnstileResult(false);
    const result = await signInAction(null, fd({
      email: "test@example.com",
      password: "Password1!",
      "cf-turnstile-response": "bad-token",
    }));
    expect(result).toMatchObject({ error: expect.stringContaining("Bot check") });
    expect(mockWorkos.userManagement.authenticateWithPassword).not.toHaveBeenCalled();
  });

  it("rejects on rate-limit breach (email)", async () => {
    mockWorkos.userManagement.authenticateWithPassword.mockResolvedValue(
      sealedResponse(),
    );
    // Exhaust email rate limit (5 attempts per window)
    for (let i = 0; i < 5; i++) {
      await signInAction(null, fd({
        email: "ratelimited@example.com",
        password: "Password1!",
        "cf-turnstile-response": "valid-token",
      })).catch(() => null);
    }
    const result = await signInAction(null, fd({
      email: "ratelimited@example.com",
      password: "Password1!",
      "cf-turnstile-response": "valid-token",
    }));
    expect(result).toMatchObject({ error: expect.stringContaining("Too many attempts") });
  });

  it("returns generic error for wrong password — no enumeration", async () => {
    const ex = Object.assign(new Error("auth failed"), {
      code: "invalid_credentials",
    });
    Object.setPrototypeOf(ex, AuthenticationException.prototype);
    (ex as { rawData?: unknown }).rawData = {};
    mockWorkos.userManagement.authenticateWithPassword.mockRejectedValue(ex);

    const result = await signInAction(null, fd({
      email: "test@example.com",
      password: "WrongPassword1!",
      "cf-turnstile-response": "valid-token",
    }));
    expect(result).toMatchObject({ error: "Invalid email or password." });
  });

  it("returns same generic error for nonexistent email — no enumeration", async () => {
    const ex = Object.assign(new Error("auth failed"), {
      code: "invalid_credentials",
    });
    Object.setPrototypeOf(ex, AuthenticationException.prototype);
    (ex as { rawData?: unknown }).rawData = {};
    mockWorkos.userManagement.authenticateWithPassword.mockRejectedValue(ex);

    const result = await signInAction(null, fd({
      email: "nobody@nowhere.invalid",
      password: "Password1!",
      "cf-turnstile-response": "valid-token",
    }));
    expect(result).toMatchObject({ error: "Invalid email or password." });
  });

  it("sets sealed session cookie on success", async () => {
    mockWorkos.userManagement.authenticateWithPassword.mockResolvedValue(
      sealedResponse(),
    );
    let caught: Error | null = null;
    try {
      await signInAction(null, fd({
        email: "test@example.com",
        password: "Password1!",
        "cf-turnstile-response": "valid-token",
      }));
    } catch (e) {
      caught = e as Error;
    }
    // Should redirect
    expect(caught?.message).toMatch(/^REDIRECT:/);
    // Cookie must have been set
    const cookieName = "wos-session";
    expect(mockCookieJar[cookieName]).toBe("sealed-session-token");
  });

  it("calls ensureUser after successful sign-in", async () => {
    const { ensureUser } = await import("@/lib/auth/ensureUser");
    mockWorkos.userManagement.authenticateWithPassword.mockResolvedValue(
      sealedResponse(),
    );
    try {
      await signInAction(null, fd({
        email: "test@example.com",
        password: "Password1!",
        "cf-turnstile-response": "valid-token",
      }));
    } catch {
      // redirect throws
    }
    expect(ensureUser).toHaveBeenCalledWith(
      expect.objectContaining({ workosUserId: "wos-user-123" }),
    );
  });

  it("redirects to MFA page on mfa_challenge code", async () => {
    const ex = Object.assign(new Error("mfa required"), {
      code: "mfa_challenge",
      pendingAuthenticationToken: "pending-token-abc",
      rawData: { user: { id: "wos-user-mfa" } },
    });
    Object.setPrototypeOf(ex, AuthenticationException.prototype);
    mockWorkos.userManagement.authenticateWithPassword.mockRejectedValue(ex);
    mockWorkos.multiFactorAuth.listUserAuthFactors.mockResolvedValue({
      data: [{ id: "factor-1", type: "totp" }],
    });
    mockWorkos.multiFactorAuth.challengeFactor.mockResolvedValue({
      id: "challenge-1",
    });

    let caught: Error | null = null;
    try {
      await signInAction(null, fd({
        email: "mfa@example.com",
        password: "Password1!",
        "cf-turnstile-response": "valid-token",
      }));
    } catch (e) {
      caught = e as Error;
    }
    expect(caught?.message).toMatch(/REDIRECT:.*mfa/);
    // Should have set the MFA pending cookie
    expect(mockCookieJar["wos-mfa-pending"]).toBeDefined();
    const mfaData = JSON.parse(mockCookieJar["wos-mfa-pending"]) as {
      pendingToken: string;
      challengeId: string;
    };
    expect(mfaData.pendingToken).toBe("pending-token-abc");
    expect(mfaData.challengeId).toBe("challenge-1");
  });
});

// ---------------------------------------------------------------------------
// signUpAction
// ---------------------------------------------------------------------------

describe("signUpAction", () => {
  it("rejects on Turnstile failure", async () => {
    setTurnstileResult(false);
    const result = await signUpAction(null, fd({
      firstName: "Test",
      email: "new@example.com",
      password: "Password1!",
      confirmPassword: "Password1!",
      "cf-turnstile-response": "bad-token",
    }));
    expect(result).toMatchObject({ error: expect.stringContaining("Bot check") });
  });

  it("rejects when passwords do not match", async () => {
    const result = await signUpAction(null, fd({
      firstName: "Test",
      email: "new@example.com",
      password: "Password1!",
      confirmPassword: "Different1!",
      "cf-turnstile-response": "valid-token",
    }));
    expect(result).toMatchObject({ error: "Passwords do not match." });
    expect(mockWorkos.userManagement.createUser).not.toHaveBeenCalled();
  });

  it("calls createUser and authenticateWithPassword on valid signup", async () => {
    mockWorkos.userManagement.createUser.mockResolvedValue({ id: "new-user" });
    mockWorkos.userManagement.authenticateWithPassword.mockResolvedValue(
      sealedResponse(),
    );
    try {
      await signUpAction(null, fd({
        firstName: "Test",
        email: "new@example.com",
        password: "Password12345!",
        confirmPassword: "Password12345!",
        "cf-turnstile-response": "valid-token",
      }));
    } catch {
      // redirect
    }
    expect(mockWorkos.userManagement.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@example.com" }),
    );
    expect(mockWorkos.userManagement.authenticateWithPassword).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// forgotPasswordAction — no enumeration
// ---------------------------------------------------------------------------

describe("forgotPasswordAction", () => {
  it("always returns ok even for unknown email — no enumeration", async () => {
    mockWorkos.userManagement.createPasswordReset.mockRejectedValue(
      new Error("user not found"),
    );
    const result = await forgotPasswordAction(null, fd({
      email: "nobody@nowhere.invalid",
      "cf-turnstile-response": "valid-token",
    }));
    expect(result).toMatchObject({ ok: true });
  });

  it("returns ok for known email", async () => {
    mockWorkos.userManagement.createPasswordReset.mockResolvedValue({
      passwordResetToken: "tok",
      passwordResetUrl: "https://api.workos.com/reset",
    });
    const result = await forgotPasswordAction(null, fd({
      email: "known@example.com",
      "cf-turnstile-response": "valid-token",
    }));
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects on Turnstile failure", async () => {
    setTurnstileResult(false);
    const result = await forgotPasswordAction(null, fd({
      email: "test@example.com",
      "cf-turnstile-response": "bad-token",
    }));
    expect(result).toMatchObject({ error: expect.stringContaining("Bot check") });
  });

  it("rejects on rate-limit (IP-only)", async () => {
    // 20 IP attempts per window
    mockWorkos.userManagement.createPasswordReset.mockResolvedValue({
      passwordResetToken: "tok",
      passwordResetUrl: "https://api.workos.com/reset",
    });
    for (let i = 0; i < 20; i++) {
      await forgotPasswordAction(null, fd({
        email: `user${i}@example.com`,
        "cf-turnstile-response": "valid-token",
      })).catch(() => null);
    }
    const result = await forgotPasswordAction(null, fd({
      email: "another@example.com",
      "cf-turnstile-response": "valid-token",
    }));
    expect(result).toMatchObject({ error: expect.stringContaining("Too many attempts") });
  });
});

// ---------------------------------------------------------------------------
// resetPasswordAction
// ---------------------------------------------------------------------------

describe("resetPasswordAction", () => {
  it("returns invalidInput when passwords mismatch", async () => {
    const result = await resetPasswordAction(null, fd({
      token: "valid-token",
      password: "NewPass1!",
      confirmPassword: "Different1!",
    }));
    expect(result).toMatchObject({ error: "Passwords do not match." });
  });

  it("returns error when WorkOS rejects the token", async () => {
    mockWorkos.userManagement.resetPassword.mockRejectedValue(
      new Error("invalid token"),
    );
    const result = await resetPasswordAction(null, fd({
      token: "expired-token",
      password: "NewPass1!",
      confirmPassword: "NewPass1!",
    }));
    expect(result).toMatchObject({ error: expect.stringContaining("invalid or has expired") });
  });

  it("returns ok on success", async () => {
    mockWorkos.userManagement.resetPassword.mockResolvedValue({ user: { id: "u1" } });
    const result = await resetPasswordAction(null, fd({
      token: "valid-reset-token",
      password: "NewPass1!",
      confirmPassword: "NewPass1!",
    }));
    expect(result).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// verifyEmailAction
// ---------------------------------------------------------------------------

describe("verifyEmailAction", () => {
  it("returns sessionExpired when no pending cookie", async () => {
    const result = await verifyEmailAction(null, fd({ code: "123456" }));
    expect(result).toMatchObject({ error: "Your session has expired. Please sign in again." });
  });

  it("verifies and sets session cookie when cookie exists", async () => {
    mockCookieJar["wos-email-verify-pending"] = "pending-email-token";
    mockWorkos.userManagement.authenticateWithEmailVerification.mockResolvedValue(
      sealedResponse(),
    );

    let caught: Error | null = null;
    try {
      await verifyEmailAction(null, fd({ code: "123456" }));
    } catch (e) {
      caught = e as Error;
    }

    expect(caught?.message).toMatch(/^REDIRECT:/);
    expect(mockCookieJar["wos-session"]).toBe("sealed-session-token");
    expect(mockCookieJar["wos-email-verify-pending"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// mfaChallengeAction
// ---------------------------------------------------------------------------

describe("mfaChallengeAction", () => {
  it("returns sessionExpired when no MFA pending cookie", async () => {
    const result = await mfaChallengeAction(null, fd({ code: "123456" }));
    expect(result).toMatchObject({ error: "Your session has expired. Please sign in again." });
  });

  it("verifies TOTP and sets session cookie", async () => {
    mockCookieJar["wos-mfa-pending"] = JSON.stringify({
      pendingToken: "pending-mfa",
      challengeId: "challenge-xyz",
    });
    mockWorkos.userManagement.authenticateWithTotp.mockResolvedValue(
      sealedResponse(),
    );

    let caught: Error | null = null;
    try {
      await mfaChallengeAction(null, fd({ code: "654321" }));
    } catch (e) {
      caught = e as Error;
    }

    expect(caught?.message).toMatch(/^REDIRECT:/);
    expect(mockCookieJar["wos-session"]).toBe("sealed-session-token");
    expect(mockCookieJar["wos-mfa-pending"]).toBeUndefined();
  });

  it("returns invalidCode on bad TOTP", async () => {
    mockCookieJar["wos-mfa-pending"] = JSON.stringify({
      pendingToken: "pending-mfa",
      challengeId: "challenge-xyz",
    });
    mockWorkos.userManagement.authenticateWithTotp.mockRejectedValue(
      new Error("invalid code"),
    );
    const result = await mfaChallengeAction(null, fd({ code: "000000" }));
    expect(result).toMatchObject({ error: "Invalid or expired code. Please try again." });
  });
});

// ---------------------------------------------------------------------------
// googleSignInAction
// ---------------------------------------------------------------------------

describe("googleSignInAction", () => {
  it("returns authorization URL", async () => {
    mockWorkos.userManagement.getAuthorizationUrl.mockReturnValue(
      "https://api.workos.com/sso/authorize?...",
    );
    const result = await googleSignInAction();
    expect(result).toMatchObject({ url: expect.stringContaining("workos") });
    expect(mockWorkos.userManagement.getAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "GoogleOAuth",
        state: "signed-state-token",
      }),
    );
  });

  it("sets a CSRF nonce cookie bound to the signed state", async () => {
    mockWorkos.userManagement.getAuthorizationUrl.mockReturnValue(
      "https://api.workos.com/sso/authorize?...",
    );
    await googleSignInAction();

    // A high-entropy nonce is stored in the oauth_csrf cookie...
    const nonce = mockCookieJar["oauth_csrf"];
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBeGreaterThan(20);

    // ...and the SAME nonce is embedded in the signed OAuth state.
    expect(vi.mocked(signOAuthState)).toHaveBeenCalledWith(
      expect.objectContaining({ nonce }),
    );
  });
});
