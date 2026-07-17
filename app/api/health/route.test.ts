import { describe, expect, it, vi } from "vitest";

const connectDB = vi.fn();
vi.mock("@/lib/db/mongoose", () => ({
  connectDB: (...args: unknown[]) => connectDB(...args),
}));

const healthyConn = {
  connection: {
    readyState: 1,
    db: { admin: () => ({ ping: async () => ({ ok: 1 }) }) },
  },
};

import { GET } from "./route";

describe("GET /api/health", () => {
  it("liveness (no ?ready) returns 200 with a minimal ok body", async () => {
    const res = await GET(new Request("http://test/api/health"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ status: "ok" });
  });

  it("readiness returns 200 with checks:{db:true} when the DB is healthy", async () => {
    connectDB.mockResolvedValue(healthyConn);

    const res = await GET(new Request("http://test/api/health?ready=1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ status: "healthy", checks: { db: true } });
  });

  it("readiness returns 503 with checks:{db:false} when the DB is down", async () => {
    connectDB.mockRejectedValue(new Error("mongo://user:pass@host/db unreachable"));

    const res = await GET(new Request("http://test/api/health?ready=1"));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toEqual({ status: "unhealthy", checks: { db: false } });
  });

  it("never leaks connection strings or raw error text in the response body", async () => {
    connectDB.mockRejectedValue(new Error("mongo://user:pass@host/db unreachable"));

    const res = await GET(new Request("http://test/api/health?ready=1"));
    const text = await res.text();
    expect(text).not.toMatch(/mongo:\/\/|user:pass/);
  });
});
