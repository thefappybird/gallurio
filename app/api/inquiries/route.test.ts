import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const submitInquiry = vi.fn();
vi.mock("@/lib/server/inquirySubmission", () => ({
  submitInquiry: (...args: unknown[]) => submitInquiry(...args),
}));

import { POST } from "./route";
import { __resetRateLimitForTests } from "@/lib/server/rateLimit";

function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    workspaceSlug: "studio-aurora",
    name: "Emma Carter",
    email: "emma@example.com",
    phone: "+63 900 000 0000",
    preferredContact: "email",
    sessions: [{ startDate: "2030-08-15", startTime: "10:00", endTime: "18:00" }],
    eventType: "wedding",
    guestCount: 120,
    location: "Tagaytay",
    description: "Looking for full-day coverage please.",
    company_name: "",
    ...overrides,
  };
}

function makeReq(body: unknown, ip = "1.2.3.4") {
  return new Request("http://test/api/inquiries", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  __resetRateLimitForTests();
  submitInquiry.mockReset();
  submitInquiry.mockResolvedValue({
    ok: true,
    inquiryId: "inq_1",
    draftBookingId: "bk_1",
    clientId: "cl_1",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/inquiries", () => {
  it("returns 200 with ids on a valid submission", async () => {
    const res = await POST(makeReq(makeBody()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, inquiryId: "inq_1" });
    expect(submitInquiry).toHaveBeenCalledOnce();
  });

  it("returns 400 when workspaceSlug is missing", async () => {
    const res = await POST(makeReq(makeBody({ workspaceSlug: "" })));
    expect(res.status).toBe(400);
    expect(submitInquiry).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid payload", async () => {
    const res = await POST(makeReq(makeBody({ email: "not-an-email" })));
    expect(res.status).toBe(400);
    expect(submitInquiry).not.toHaveBeenCalled();
  });

  it("returns 400 when the honeypot is filled, without calling the helper", async () => {
    const res = await POST(makeReq(makeBody({ company_name: "ACME Bot Co" })));
    expect(res.status).toBe(400);
    expect(submitInquiry).not.toHaveBeenCalled();
  });

  it("returns 404 when the workspace is not found / unpublished", async () => {
    submitInquiry.mockResolvedValue({ ok: false, error: "workspace_not_found" });
    const res = await POST(makeReq(makeBody()));
    expect(res.status).toBe(404);
  });

  it("returns 500 when submission fails internally", async () => {
    submitInquiry.mockResolvedValue({ ok: false, error: "submission_failed" });
    const res = await POST(makeReq(makeBody()));
    expect(res.status).toBe(500);
  });

  it("rate-limits to 5 submissions per IP, then 429s", async () => {
    for (let i = 0; i < 5; i += 1) {
      const ok = await POST(makeReq(makeBody(), "9.9.9.9"));
      expect(ok.status).toBe(200);
    }
    const sixth = await POST(makeReq(makeBody(), "9.9.9.9"));
    expect(sixth.status).toBe(429);
    expect(sixth.headers.get("Retry-After")).toBeTruthy();
  });

  it("rate-limits per IP independently", async () => {
    for (let i = 0; i < 5; i += 1) await POST(makeReq(makeBody(), "5.5.5.5"));
    const blocked = await POST(makeReq(makeBody(), "5.5.5.5"));
    expect(blocked.status).toBe(429);
    // A different IP is unaffected.
    const other = await POST(makeReq(makeBody(), "6.6.6.6"));
    expect(other.status).toBe(200);
  });

  it("returns 400 on non-JSON body", async () => {
    const req = new Request("http://test/api/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
