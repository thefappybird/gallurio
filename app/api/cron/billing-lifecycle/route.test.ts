import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockRun } = vi.hoisted(() => ({
  mockRun: vi.fn().mockResolvedValue({
    preExpiryWarned: 0,
    lapsed: 0,
    expiredNotified: 0,
    remind1Sent: 0,
    remind2Sent: 0,
    wiped: 0,
  }),
}));
vi.mock("@/lib/db/jobs/billing-lifecycle-sweep", () => ({
  runBillingLifecycleSweep: mockRun,
}));

function makeReq(auth?: string) {
  return new Request("http://test/api/cron/billing-lifecycle", {
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

describe("GET /api/cron/billing-lifecycle — auth", () => {
  it("returns 401 when the bearer token does not match CRON_SECRET", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeReq("Bearer wrong-secret"));

    expect(res.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeReq());

    expect(res.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("returns 500 without running the sweep when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { GET } = await import("./route");
    const res = await GET(makeReq("Bearer anything"));

    expect(res.status).toBe(500);
    expect(mockRun).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/billing-lifecycle — success", () => {
  it("returns 200 with the sweep report when the bearer token matches", async () => {
    mockRun.mockResolvedValueOnce({
      preExpiryWarned: 1,
      lapsed: 2,
      expiredNotified: 3,
      remind1Sent: 4,
      remind2Sent: 5,
      wiped: 6,
    });
    const { GET } = await import("./route");
    const res = await GET(makeReq("Bearer test-secret"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      preExpiryWarned: 1,
      lapsed: 2,
      expiredNotified: 3,
      remind1Sent: 4,
      remind2Sent: 5,
      wiped: 6,
    });
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("returns 500 with the error message when the sweep throws", async () => {
    mockRun.mockRejectedValueOnce(new Error("db exploded"));
    const { GET } = await import("./route");
    const res = await GET(makeReq("Bearer test-secret"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "db exploded" });
  });
});
