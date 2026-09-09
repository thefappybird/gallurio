import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

const requestDirectUpload = vi.fn();
vi.mock("@/lib/storage/cloudflareImages", () => ({
  requestDirectUpload: (...args: unknown[]) => requestDirectUpload(...args),
  DEMO_UPLOAD_SUBFOLDER: "portfolio-maker-demo",
}));

import { POST } from "./route";
import { __resetRateLimitForTests } from "@/lib/server/rateLimit";

function makeReq(body: unknown, ip = "1.2.3.4") {
  return new Request("http://test/api/portfolio-maker-demo/upload", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  __resetRateLimitForTests();
  requestDirectUpload.mockReset();
  requestDirectUpload.mockResolvedValue({ imageId: "img_1", uploadURL: "https://upload.example/img_1" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/portfolio-maker-demo/upload", () => {
  it("returns 200 with imageId/uploadURL on a valid request", async () => {
    const sessionId = randomUUID();
    const res = await POST(makeReq({ demoSessionId: sessionId }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ imageId: "img_1", uploadURL: "https://upload.example/img_1" });
    expect(requestDirectUpload).toHaveBeenCalledWith(sessionId, "portfolio-maker-demo");
  });

  it("returns 400 when demoSessionId is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(requestDirectUpload).not.toHaveBeenCalled();
  });

  it("returns image_cap_reached (400) on the 11th image for the same demoSessionId", async () => {
    const sessionId = randomUUID();
    for (let i = 0; i < 10; i += 1) {
      const res = await POST(makeReq({ demoSessionId: sessionId }, `10.0.0.${i + 1}`));
      expect(res.status).toBe(200);
    }
    requestDirectUpload.mockClear();
    const eleventh = await POST(makeReq({ demoSessionId: sessionId }, "10.0.0.99"));
    expect(eleventh.status).toBe(400);
    const json = await eleventh.json();
    expect(json).toEqual({ error: "image_cap_reached" });
    expect(requestDirectUpload).not.toHaveBeenCalled();
  });

  it("gives two different demoSessionIds independent 10-image budgets", async () => {
    const sessionA = randomUUID();
    const sessionB = randomUUID();
    for (let i = 0; i < 10; i += 1) {
      const res = await POST(makeReq({ demoSessionId: sessionA }, `10.1.0.${i + 1}`));
      expect(res.status).toBe(200);
    }
    const capped = await POST(makeReq({ demoSessionId: sessionA }, "10.1.0.99"));
    expect(capped.status).toBe(400);

    const otherSession = await POST(makeReq({ demoSessionId: sessionB }, "10.1.0.100"));
    expect(otherSession.status).toBe(200);
  });

  it("returns 429 with Retry-After when the per-IP limit is exceeded", async () => {
    for (let i = 0; i < 30; i += 1) {
      const res = await POST(makeReq({ demoSessionId: randomUUID() }, "20.0.0.1"));
      expect(res.status).toBe(200);
    }
    const blocked = await POST(makeReq({ demoSessionId: randomUUID() }, "20.0.0.1"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    const json = await blocked.json();
    expect(json).toEqual({ ok: false, error: "rate_limited" });
  });

  it("returns 500 with a generic error body when requestDirectUpload throws", async () => {
    requestDirectUpload.mockRejectedValueOnce(new Error("CF request timed out after 15000ms: /v2/direct_upload"));
    const res = await POST(makeReq({ demoSessionId: randomUUID() }, "30.0.0.1"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: "upload_failed" });
    expect(JSON.stringify(json)).not.toContain("CF request timed out");
  });
});
