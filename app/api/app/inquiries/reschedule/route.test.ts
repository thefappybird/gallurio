import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const reschedule = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthUser: () => auth() }));
vi.mock("@/app/[locale]/(app)/inquiries/_actions", () => ({
  rescheduleInquirySessionAction: (input: unknown, signal: AbortSignal) => reschedule(input, signal),
}));

import { PATCH } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ workosUserId: "user_1" });
});

describe("PATCH inquiry reschedule", () => {
  it("rejects unauthenticated requests before invoking the mutation", async () => {
    auth.mockResolvedValue(null);
    const response = await PATCH(new Request("http://localhost/api/app/inquiries/reschedule", { method: "PATCH", body: "{}" }));
    expect(response.status).toBe(401);
    expect(reschedule).not.toHaveBeenCalled();
  });

  it("forwards a valid JSON body to the workspace scoped mutation", async () => {
    const input = { inquiryId: "inquiry_1", sessionIndex: 0, startDate: "2027-09-19", startTime: "10:00", endTime: "12:00" };
    reschedule.mockResolvedValue({ ok: true, draftBookingId: "booking_1" });
    const response = await PATCH(new Request("http://localhost/api/app/inquiries/reschedule", {
      method: "PATCH", body: JSON.stringify(input), headers: { "Content-Type": "application/json" },
    }));
    expect(response.status).toBe(200);
    expect(reschedule).toHaveBeenCalledWith(input, expect.any(AbortSignal));
  });

  it.each([
    ["not_found", 404],
    ["stale", 409],
    ["conflict", 409],
    ["conflict_check_failed", 500],
    ["reschedule_failed", 500],
    ["not_reschedulable", 400],
    ["session_index_out_of_range", 400],
    ["aborted", 400],
    ["Invalid date", 400],
  ])("maps action error %s to HTTP %i", async (error, status) => {
    reschedule.mockResolvedValue({ error });
    const response = await PATCH(new Request("http://localhost/api/app/inquiries/reschedule", {
      method: "PATCH", body: JSON.stringify({ inquiryId: "inquiry_1" }),
    }));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });

  it("returns 400 invalid_input for malformed JSON without invoking the mutation", async () => {
    const response = await PATCH(new Request("http://localhost/api/app/inquiries/reschedule", {
      method: "PATCH", body: "{not json",
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_input" });
    expect(reschedule).not.toHaveBeenCalled();
  });

  it("returns a conflict response with the current version for a stale drop", async () => {
    reschedule.mockResolvedValue({ error: "stale", updatedAt: "2027-09-15T01:00:00.000Z" });
    const response = await PATCH(new Request("http://localhost/api/app/inquiries/reschedule", {
      method: "PATCH", body: JSON.stringify({ inquiryId: "inquiry_1" }),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "stale", updatedAt: "2027-09-15T01:00:00.000Z" });
  });
});
