import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Controllable mock for next/headers. Each test sets what get(name) returns.
const headerValues = new Map<string, string | null>();
let headersThrows = false;

vi.mock("next/headers", () => ({
  headers: async () => {
    if (headersThrows) throw new Error("called outside request scope");
    return {
      get: (name: string) => headerValues.get(name.toLowerCase()) ?? null,
    };
  },
}));

const { authCookieSecure } = await import("./cookies");

const ORIGINAL_URI = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setHeader(name: string, value: string | null): void {
  headerValues.set(name.toLowerCase(), value);
}

beforeEach(() => {
  headerValues.clear();
  headersThrows = false;
});

afterEach(() => {
  if (ORIGINAL_URI === undefined) {
    delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
  } else {
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = ORIGINAL_URI;
  }
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", ORIGINAL_NODE_ENV ?? "");
});

describe("authCookieSecure — request-derived (primary path)", () => {
  it("returns true when x-forwarded-proto is https", async () => {
    setHeader("x-forwarded-proto", "https");
    setHeader("host", "app.gallurio.com");
    expect(await authCookieSecure()).toBe(true);
  });

  it("returns false when x-forwarded-proto is http", async () => {
    setHeader("x-forwarded-proto", "http");
    setHeader("host", "app.gallurio.com");
    expect(await authCookieSecure()).toBe(false);
  });

  it("uses the first proto when x-forwarded-proto is a comma list", async () => {
    setHeader("x-forwarded-proto", "https, http");
    expect(await authCookieSecure()).toBe(true);
  });

  it("returns false for http://localhost (no forwarded proto)", async () => {
    // The exact case that breaks `pnpm build && start` locally.
    setHeader("host", "localhost:3000");
    expect(await authCookieSecure()).toBe(false);
  });

  it("returns false for a 127.0.0.1 host", async () => {
    setHeader("host", "127.0.0.1:3000");
    expect(await authCookieSecure()).toBe(false);
  });

  it("returns true for a real host with no forwarded proto", async () => {
    setHeader("host", "app.gallurio.com");
    expect(await authCookieSecure()).toBe(true);
  });
});

describe("authCookieSecure — env fallback (no request context)", () => {
  beforeEach(() => {
    headersThrows = true; // simulate being outside a request scope
  });

  it("derives from an https redirect URI", async () => {
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI =
      "https://app.gallurio.com/api/auth/callback";
    expect(await authCookieSecure()).toBe(true);
  });

  it("derives from an http redirect URI", async () => {
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI =
      "http://localhost:3000/api/auth/callback";
    expect(await authCookieSecure()).toBe(false);
  });

  it("falls back to NODE_ENV=production when the URI is unset", async () => {
    delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    vi.stubEnv("NODE_ENV", "production");
    expect(await authCookieSecure()).toBe(true);
  });

  it("falls back to false when the URI is unset and not production", async () => {
    delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    vi.stubEnv("NODE_ENV", "development");
    expect(await authCookieSecure()).toBe(false);
  });
});
