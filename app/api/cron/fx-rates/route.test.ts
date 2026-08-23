import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockRefresh } = vi.hoisted(() => ({
  mockRefresh: vi.fn().mockResolvedValue({ USD: 1, PHP: 58 }),
}));
vi.mock("@/lib/pricing/fxRates", () => ({
  refreshFxRateTable: mockRefresh,
}));

function makeReq(auth?: string) {
  return new Request("http://test/api/cron/fx-rates", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/fx-rates — auth", () => {
  it("returns 401 when the bearer token does not match CRON_SECRET", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeReq("Bearer wrong-secret"));

    expect(res.status).toBe(401);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeReq());

    expect(res.status).toBe(401);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("returns 500 without running the refresh when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { GET } = await import("./route");
    const res = await GET(makeReq("Bearer anything"));

    expect(res.status).toBe(500);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/fx-rates — success", () => {
  it("returns 200 when the bearer token matches and the fetch succeeds", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeReq("Bearer test-secret"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, currencies: 2 });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when the upstream fetch fails", async () => {
    mockRefresh.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET(makeReq("Bearer test-secret"));

    expect(res.status).toBe(502);
  });

  it("returns 500 with the error message when the refresh throws", async () => {
    mockRefresh.mockRejectedValueOnce(new Error("db exploded"));
    const { GET } = await import("./route");
    const res = await GET(makeReq("Bearer test-secret"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "db exploded" });
  });
});
