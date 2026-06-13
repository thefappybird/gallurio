import { describe, it, expect, beforeEach, vi } from "vitest";

process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = "test-secret-oauth-state";

const { signOAuthState, verifyOAuthState } = await import("./oauthState");

describe("oauthState — sign and verify", () => {
  it("round-trips a full payload including the CSRF nonce", () => {
    const payload = {
      locale: "en",
      returnTo: "/dashboard",
      nonce: "csrf-nonce-abc123",
    };
    const state = signOAuthState(payload);
    const result = verifyOAuthState(state);

    expect(result).not.toBeNull();
    expect(result?.locale).toBe("en");
    expect(result?.returnTo).toBe("/dashboard");
    expect(result?.nonce).toBe("csrf-nonce-abc123");
  });

  it("round-trips a minimal payload (locale only)", () => {
    const state = signOAuthState({ locale: "fil" });
    const result = verifyOAuthState(state);

    expect(result).not.toBeNull();
    expect(result?.locale).toBe("fil");
    expect(result?.returnTo).toBeUndefined();
  });

  it("does not carry an inviteToken field", () => {
    // inviteToken was removed from OAuthStatePayload — verify it is absent.
    const state = signOAuthState({ locale: "en" });
    const result = verifyOAuthState(state);

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("inviteToken");
  });

  it("accepts an explicit issuedAt", () => {
    const now = Date.now();
    const state = signOAuthState({ locale: "ms", issuedAt: now });
    const result = verifyOAuthState(state);

    expect(result).not.toBeNull();
    expect(result?.issuedAt).toBe(now);
  });
});

describe("oauthState — tamper detection", () => {
  it("returns null for a tampered payload (modified base64 content)", () => {
    const state = signOAuthState({ locale: "en" });
    const dot = state.lastIndexOf(".");
    const tampered = `xxx${state.slice(3, dot)}.${state.slice(dot + 1)}`;

    expect(verifyOAuthState(tampered)).toBeNull();
  });

  it("returns null for a tampered signature", () => {
    const state = signOAuthState({ locale: "en" });
    const dot = state.lastIndexOf(".");
    const tamperedSig = state.slice(0, dot) + ".deadbeefdeadbeefdeadbeefdeadbeef";

    expect(verifyOAuthState(tamperedSig)).toBeNull();
  });

  it("returns null for a string with no dot separator", () => {
    expect(verifyOAuthState("nodothere")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(verifyOAuthState("")).toBeNull();
  });

  it("returns null for a state signed with a different secret", async () => {
    // signOAuthState reads the secret at call time, so we temporarily swap it.
    const original = process.env.ACTIVE_WORKSPACE_COOKIE_SECRET;
    process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = "different-secret";
    const { signOAuthState: signWithDifferent } = await import("./oauthState");
    const foreignState = signWithDifferent({ locale: "en" });
    process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = original;

    // Verify against the original secret — must fail.
    expect(verifyOAuthState(foreignState)).toBeNull();
  });
});

describe("oauthState — TTL / expiry", () => {
  it("returns null for a state older than 10 minutes", () => {
    const expired = Date.now() - 11 * 60 * 1000; // 11 min ago
    const state = signOAuthState({ locale: "en", issuedAt: expired });

    expect(verifyOAuthState(state)).toBeNull();
  });

  it("accepts a state issued exactly 1 second ago", () => {
    const recent = Date.now() - 1000;
    const state = signOAuthState({ locale: "en", issuedAt: recent });
    const result = verifyOAuthState(state);

    expect(result).not.toBeNull();
  });

  it("returns null when issuedAt is missing from payload", async () => {
    // Manually construct a payload without issuedAt and sign it.
    const { createHmac } = await import("crypto");
    const secret = process.env.ACTIVE_WORKSPACE_COOKIE_SECRET!;

    const raw = JSON.stringify({ locale: "en" }); // no issuedAt
    const encoded = Buffer.from(raw).toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const mac = createHmac("sha256", secret).update(encoded).digest("hex");
    const state = `${encoded}.${mac}`;

    expect(verifyOAuthState(state)).toBeNull();
  });
});
