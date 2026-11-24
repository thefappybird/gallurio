import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitForTests } from "@/lib/server/rateLimit";

const getMock = vi.fn();
vi.mock("@/lib/db/queries/discover", () => ({
  getDiscoverPortfolio: (slug: string) => getMock(slug),
}));

import { GET } from "./route";

function call(slug: string, ip = "1.2.3.4") {
  return GET(
    new Request("http://localhost/api/public/discover/x", { headers: { "x-forwarded-for": ip } }),
    { params: Promise.resolve({ slug }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimitForTests();
  getMock.mockResolvedValue({ slug: "amy", name: "Amy" });
});

describe("GET /api/public/discover/[slug]", () => {
  it("returns the detail with no-store, looking up the lowercased trimmed slug", async () => {
    const res = await call("  AmY ");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ slug: "amy", name: "Amy" });
    expect(getMock).toHaveBeenCalledWith("amy");
  });

  it.each(["", "   ", "a".repeat(101)])("returns 404 not_found without querying for slug %j", async (slug) => {
    const res = await call(slug);

    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ error: "not_found" });
    expect(getMock).not.toHaveBeenCalled();
  });

  it("throttles at 120 req/min per IP with 429, Retry-After and no-store before touching the query", async () => {
    const ip = "9.9.9.6";
    for (let i = 0; i < 120; i += 1) {
      await call("amy", ip);
    }
    getMock.mockClear();

    const res = await call("amy", ip);

    expect(res.status).toBe(429);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    await expect(res.json()).resolves.toEqual({ error: "rate_limited" });
    expect(getMock).not.toHaveBeenCalled();
  });

  it("returns 500 server_error with no detail and no-store when the query throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getMock.mockRejectedValueOnce(new Error("mongo secret detail"));

    const res = await call("amy");

    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ error: "server_error" });
  });

  it("returns 404 not_found with no-store when the query finds nothing", async () => {
    getMock.mockResolvedValueOnce(null);

    const res = await call("ghost");

    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ error: "not_found" });
  });
});
