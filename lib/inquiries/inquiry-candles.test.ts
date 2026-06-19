import { describe, it, expect } from "vitest";
import { buildInquiryCalendarEvents, type InquiryCalendarInput } from "./inquiry-candles";

// Use dates 2 days ahead to avoid timezone-boundary flakiness.
const FUTURE_DATE = new Date(Date.now() + 2 * 86400000);
const futureStr = FUTURE_DATE.toISOString().slice(0, 10);

const YESTERDAY = new Date(Date.now() - 86400000);
const yesterdayStr = YESTERDAY.toISOString().slice(0, 10);

const TZ = "Asia/Manila";
const TODAY = new Date();

function makeInquiry(
  id: string,
  sessions: InquiryCalendarInput["sessions"],
  overrides: Partial<InquiryCalendarInput> = {}
): InquiryCalendarInput {
  return { _id: id, eventName: "Test Event", clientName: "Ada", sessions, ...overrides };
}

describe("buildInquiryCalendarEvents", () => {
  it("returns empty array for empty inquiries", () => {
    const result = buildInquiryCalendarEvents([], { today: TODAY, tz: TZ });
    expect(result).toEqual([]);
  });

  it("returns exactly 1 event for one inquiry with one session", () => {
    const inq = makeInquiry("abc123", [
      { startDate: futureStr, startTime: "09:00", endTime: "17:00" },
    ]);
    const result = buildInquiryCalendarEvents([inq], { today: TODAY, tz: TZ });
    expect(result).toHaveLength(1);
  });

  it("sets kind to 'inquiry', inquiryId, and colorOverride to var(--event-inquiry) for active inquiries", () => {
    const inq = makeInquiry("abc123", [
      { startDate: futureStr, startTime: "09:00", endTime: "17:00" },
    ], { status: "new" });
    const [event] = buildInquiryCalendarEvents([inq], { today: TODAY, tz: TZ });
    expect(event.kind).toBe("inquiry");
    expect(event.inquiryId).toBe("abc123");
    expect(event.colorOverride).toBe("var(--event-inquiry)");
  });

  it("sets colorOverride to var(--danger) for conflicted unbooked inquiries", () => {
    const inq = makeInquiry("abc123", [
      { startDate: futureStr, startTime: "09:00", endTime: "17:00" },
    ], { status: "new", hasConflict: true });
    const [event] = buildInquiryCalendarEvents([inq], { today: TODAY, tz: TZ });
    expect(event.colorOverride).toBe("var(--danger)");
  });

  it("sets colorOverride to var(--event-inquiry) for non-conflicted unbooked inquiries", () => {
    const inq = makeInquiry("abc123", [
      { startDate: futureStr, startTime: "09:00", endTime: "17:00" },
    ], { status: "new", hasConflict: false });
    const [event] = buildInquiryCalendarEvents([inq], { today: TODAY, tz: TZ });
    expect(event.colorOverride).toBe("var(--event-inquiry)");
  });

  it("omits colorOverride for booked inquiries so they render like bookings", () => {
    const inq = makeInquiry("abc123", [
      { startDate: futureStr, startTime: "09:00", endTime: "17:00" },
    ], { status: "booked" });
    const [event] = buildInquiryCalendarEvents([inq], { today: TODAY, tz: TZ });
    expect(event.kind).toBe("inquiry");
    expect(event.colorOverride).toBeUndefined();
  });

  it("sets event id to <inquiryId>_s<sessionIdx>", () => {
    const inq = makeInquiry("abc123", [
      { startDate: futureStr, startTime: "09:00", endTime: "17:00" },
    ]);
    const [event] = buildInquiryCalendarEvents([inq], { today: TODAY, tz: TZ });
    expect(event.id).toBe("abc123_s0");
  });

  it("returns 2 events for one inquiry with 2 sessions, one per session", () => {
    const nextDay = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const inq = makeInquiry("abc123", [
      { startDate: futureStr, startTime: "09:00", endTime: "12:00" },
      { startDate: nextDay, startTime: "13:00", endTime: "17:00" },
    ]);
    const result = buildInquiryCalendarEvents([inq], { today: TODAY, tz: TZ });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("abc123_s0");
    expect(result[1].id).toBe("abc123_s1");
  });

  it("sets sessionPastDayCount to 1 for a past session", () => {
    const inq = makeInquiry("abc123", [
      { startDate: yesterdayStr, startTime: "09:00", endTime: "17:00" },
    ]);
    const result = buildInquiryCalendarEvents([inq], { today: TODAY, tz: TZ });
    expect(result).toHaveLength(1);
    expect(result[0].sessionPastDayCount).toBe(1);
  });

  it("sets sessionPastDayCount to 0 for a future session", () => {
    const inq = makeInquiry("abc123", [
      { startDate: futureStr, startTime: "09:00", endTime: "17:00" },
    ]);
    const [event] = buildInquiryCalendarEvents([inq], { today: TODAY, tz: TZ });
    expect(event.sessionPastDayCount).toBe(0);
  });
});
