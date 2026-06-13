import { afterEach, describe, expect, it, vi } from "vitest";
import { authCookieSecure } from "./cookies";

// authCookieSecure() reads process.env at call time, so each test can set the
// relevant vars and restore them afterward.
const ORIGINAL_URI = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined): void {
  // NODE_ENV is read-only in the Node types; assign through a cast.
  vi.stubEnv("NODE_ENV", value ?? "");
}

afterEach(() => {
  if (ORIGINAL_URI === undefined) {
    delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
  } else {
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = ORIGINAL_URI;
  }
  vi.unstubAllEnvs();
  setNodeEnv(ORIGINAL_NODE_ENV);
});

describe("authCookieSecure", () => {
  it("returns true for an https redirect URI", () => {
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI =
      "https://app.gallurio.com/api/auth/callback";
    expect(authCookieSecure()).toBe(true);
  });

  it("returns false for an http (localhost) redirect URI", () => {
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI =
      "http://localhost:3000/api/auth/callback";
    expect(authCookieSecure()).toBe(false);
  });

  it("derives from protocol regardless of NODE_ENV (prod build over http)", () => {
    // The bug this fixes: NODE_ENV=production but the origin is plaintext HTTP.
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI =
      "http://localhost:3000/api/auth/callback";
    expect(authCookieSecure()).toBe(false);
  });

  it("falls back to NODE_ENV=production when the URI is unset", () => {
    delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    setNodeEnv("production");
    expect(authCookieSecure()).toBe(true);
  });

  it("falls back to false when the URI is unset and not production", () => {
    delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    setNodeEnv("development");
    expect(authCookieSecure()).toBe(false);
  });

  it("falls back to NODE_ENV when the URI is unparseable", () => {
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = "not-a-valid-url";
    setNodeEnv("production");
    expect(authCookieSecure()).toBe(true);
  });
});
