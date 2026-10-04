import { describe, it, expect } from "vitest";
import { buildBookingCalendarEvents, type BookingEventInput } from "./build-booking-events";

const TZ = "Asia/Manila";
const TODAY = new Date();

function idOf(s: string): { toString(): string } {
  return { toString: () => s };
}

function makeBooking(
  id: string,
  sessions: { startAt: Date; endAt: Date }[],
  overrides: Partial<BookingEventInput> = {}
): BookingEventInput {
  return {
    _id: idOf(id),
    title: "Test Booking",
    clientName: "Ada",
    clientId: idOf("client1"),
    status: "booked",
    sessions,
    ...overrides,
  };
}

describe("buildBookingCalendarEvents", () => {
  it("does not ship a clientEmail field (never rendered, PII stays server-side)", () => {
    const booking = makeBooking("b1", [
      { startAt: new Date("2026-08-15T01:00:00Z"), endAt: new Date("2026-08-15T09:00:00Z") },
    ]);
    const events = buildBookingCalendarEvents([booking], { today: TODAY, tz: TZ });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => !("clientEmail" in e))).toBe(true);
  });

  it("returns empty array for empty bookings", () => {
    const result = buildBookingCalendarEvents([], { today: TODAY, tz: TZ });
    expect(result).toEqual([]);
  });

  it("sets workspaceTz on every constructed event to the passed tz", () => {
    const booking = makeBooking("b1", [
      { startAt: new Date("2026-08-15T01:00:00Z"), endAt: new Date("2026-08-15T09:00:00Z") },
    ]);
    const events = buildBookingCalendarEvents([booking], {
      today: TODAY,
      tz: TZ,
    });
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) {
      expect(ev.workspaceTz).toBe(TZ);
    }
  });

  it("propagates a different tz value unchanged", () => {
    const booking = makeBooking("b1", [
      { startAt: new Date("2026-08-15T01:00:00Z"), endAt: new Date("2026-08-15T09:00:00Z") },
    ]);
    const [event] = buildBookingCalendarEvents([booking], {
      today: TODAY,
      tz: "America/New_York",
    });
    expect(event.workspaceTz).toBe("America/New_York");
  });

  it("sets event id to <bookingId>_s<sessionIdx>_<dayKey>", () => {
    const booking = makeBooking("b1", [
      { startAt: new Date("2026-08-15T01:00:00Z"), endAt: new Date("2026-08-15T09:00:00Z") },
    ]);
    const [event] = buildBookingCalendarEvents([booking], {
      today: TODAY,
      tz: TZ,
    });
    expect(event.id).toBe("b1_s0_2026-08-15");
  });

  it("returns one event per session for a multi-session booking with same-day sessions", () => {
    const booking = makeBooking("b1", [
      { startAt: new Date("2026-08-15T01:00:00Z"), endAt: new Date("2026-08-15T09:00:00Z") },
      { startAt: new Date("2026-08-16T01:00:00Z"), endAt: new Date("2026-08-16T09:00:00Z") },
    ]);
    const events = buildBookingCalendarEvents([booking], {
      today: TODAY,
      tz: TZ,
    });
    expect(events).toHaveLength(2);
    expect(events[0].sessionIndex).toBe(0);
    expect(events[1].sessionIndex).toBe(1);
  });
});

describe("buildBookingCalendarEvents updatedAt", () => {
  it("carries the booking updatedAt as an ISO string on every candle", () => {
    const booking = makeBooking(
      "b1",
      [{ startAt: new Date("2026-08-15T01:00:00Z"), endAt: new Date("2026-08-15T09:00:00Z") }],
      { updatedAt: new Date("2026-08-01T12:00:00.123Z") }
    );
    const events = buildBookingCalendarEvents([booking], { today: TODAY, tz: TZ });
    expect(events[0].updatedAt).toBe("2026-08-01T12:00:00.123Z");
  });
});
