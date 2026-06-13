import { describe, it, expect, vi, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Stub fetch before importing the module under test
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

process.env.TURNSTILE_SECRET_KEY = "test-turnstile-secret";

const { verifyTurnstileToken } = await import("./turnstile");

afterEach(() => {
  mockFetch.mockReset();
  vi.restoreAllMocks();
});

function mockSuccess() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true }),
  });
}

function mockFailure(reason = "invalid-input-response") {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: false, "error-codes": [reason] }),
  });
}

// ---------------------------------------------------------------------------
// Fail-closed — invalid / missing inputs
// ---------------------------------------------------------------------------

describe("verifyTurnstileToken — fail closed", () => {
  it("returns false for a null token (no fetch)", async () => {
    const result = await verifyTurnstileToken(null);
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false for an empty string token (no fetch)", async () => {
    const result = await verifyTurnstileToken("");
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false for an undefined token (no fetch)", async () => {
    const result = await verifyTurnstileToken(undefined);
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false when TURNSTILE_SECRET_KEY is not set", async () => {
    const saved = process.env.TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    const result = await verifyTurnstileToken("some-token");
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    process.env.TURNSTILE_SECRET_KEY = saved;
  });

  it("returns false on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await verifyTurnstileToken("token-x");
    expect(result).toBe(false);
  });

  it("returns false when Cloudflare reports success: false", async () => {
    mockFailure();
    const result = await verifyTurnstileToken("bad-token");
    expect(result).toBe(false);
  });

  it("returns false when fetch throws a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network failure"));
    const result = await verifyTurnstileToken("token-y");
    expect(result).toBe(false);
  });

  it("returns false when response JSON is malformed", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new SyntaxError("bad json"); },
    });
    const result = await verifyTurnstileToken("token-z");
    expect(result).toBe(false);
  });

  it("returns false when response JSON has unexpected shape", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: "ok" }), // missing 'success' field
    });
    const result = await verifyTurnstileToken("token-q");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("verifyTurnstileToken — success", () => {
  it("returns true for a valid token", async () => {
    mockSuccess();
    const result = await verifyTurnstileToken("valid-token");
    expect(result).toBe(true);
  });

  it("forwards the ip parameter to the request body", async () => {
    mockSuccess();
    await verifyTurnstileToken("token-with-ip", "203.0.113.1");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("remoteip")).toBe("203.0.113.1");
  });

  it("does not include remoteip when ip is omitted", async () => {
    mockSuccess();
    await verifyTurnstileToken("token-no-ip");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.has("remoteip")).toBe(false);
  });

  it("always posts to the canonical siteverify URL", async () => {
    mockSuccess();
    await verifyTurnstileToken("url-check-token");

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  });
});
