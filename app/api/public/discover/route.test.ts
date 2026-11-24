import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitForTests } from "@/lib/server/rateLimit";

const listMock = vi.fn();
vi.mock("@/lib/db/queries/discover", () => ({
  listDiscoverPortfolios: (opts: unknown) => listMock(opts),
}));

import { GET } from "./route";

function req(qs = "", ip = "1.2.3.4") {
  return new Request(`http://localhost/api/public/discover${qs}`, {
    headers: { "x-forwarded-for": ip },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimitForTests();
  listMock.mockResolvedValue({ items: [], nextCursor: null });
});

describe("GET /api/public/discover", () => {
  it("returns the page of cards with no-store", async () => {
    listMock.mockResolvedValueOnce({ items: [{ slug: "a" }], nextCursor: "c1" });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ items: [{ slug: "a" }], nextCursor: "c1" });
  });

  it("passes parsed cursor, category, trimmed q and numeric limit to the query", async () => {
    await GET(req("?cursor=abc&category=venue&q=%20rose%20&limit=12"));

    expect(listMock).toHaveBeenCalledWith({ cursor: "abc", category: "venue", q: "rose", limit: 12 });
  });

  it("rejects q over 60 chars after trim with 400 invalid_query but accepts 60 padded with spaces", async () => {
    const bad = await GET(req(`?q=${"a".repeat(61)}`));
    expect(bad.status).toBe(400);
    await expect(bad.json()).resolves.toEqual({ error: "invalid_query" });

    const ok = await GET(req(`?q=%20${"a".repeat(60)}%20`));
    expect(ok.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith({ q: "a".repeat(60) });
  });

  it.each(["limit=0", "limit=49", "limit=abc", "limit=1.5", `cursor=${"c".repeat(201)}`])(
    "rejects %s with 400 invalid_query",
    async (qs) => {
      const res = await GET(req(`?${qs}`));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "invalid_query" });
      expect(listMock).not.toHaveBeenCalled();
    },
  );

  it("throttles at 120 req/min per IP with 429, Retry-After and no-store before touching the query", async () => {
    const ip = "9.9.9.6";
    for (let i = 0; i < 120; i += 1) {
      await GET(req("", ip));
    }
    listMock.mockClear();

    const res = await GET(req("", ip));

    expect(res.status).toBe(429);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    await expect(res.json()).resolves.toEqual({ error: "rate_limited" });
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns 500 server_error with no detail and no-store when the query throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    listMock.mockRejectedValueOnce(new Error("mongo secret detail"));

    const res = await GET(req());

    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ error: "server_error" });
  });

  it("rejects category=other (not a listable category)", async () => {
    const res = await GET(req("?category=other"));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown category with 400 invalid_query, no-store, and no query call", async () => {
    const res = await GET(req("?category=florist"));

    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ error: "invalid_query" });
    expect(listMock).not.toHaveBeenCalled();
  });
});
