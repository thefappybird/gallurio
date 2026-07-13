import { describe, expect, it, vi } from "vitest";

const connectDB = vi.fn();
vi.mock("@/lib/db/mongoose", () => ({
  connectDB: (...args: unknown[]) => connectDB(...args),
}));

const worldReady = vi.fn();
vi.mock("@/lib/workflows/world", () => ({
  worldReady: (...args: unknown[]) => worldReady(...args),
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

  it("readiness returns 200 with checks:{db:true, world:true} when both are healthy", async () => {
    connectDB.mockResolvedValue(healthyConn);
    worldReady.mockResolvedValue({ healthy: true });

    const res = await GET(new Request("http://test/api/health?ready=1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ status: "healthy", checks: { db: true, world: true } });
  });

  it("readiness returns 503 with checks:{db:false} when the DB is down", async () => {
    connectDB.mockRejectedValue(new Error("mongo://user:pass@host/db unreachable"));
    worldReady.mockResolvedValue({ healthy: true });

    const res = await GET(new Request("http://test/api/health?ready=1"));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toEqual({ status: "unhealthy", checks: { db: false, world: true } });
  });

  it("readiness returns 503 with checks:{world:false} when the world is down", async () => {
    connectDB.mockResolvedValue(healthyConn);
    worldReady.mockResolvedValue({ healthy: false, error: "queue unreachable" });

    const res = await GET(new Request("http://test/api/health?ready=1"));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toEqual({ status: "unhealthy", checks: { db: true, world: false } });
  });

  it("never leaks connection strings or raw error text in the response body", async () => {
    connectDB.mockRejectedValue(new Error("mongo://user:pass@host/db unreachable"));
    worldReady.mockResolvedValue({ healthy: false, error: "postgres://u:p@host/wf timed out" });

    const res = await GET(new Request("http://test/api/health?ready=1"));
    const text = await res.text();
    expect(text).not.toMatch(/mongo:\/\/|postgres:\/\/|user:pass|:p@/);
  });
});
