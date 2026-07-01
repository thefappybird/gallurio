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
  it("returns empty array for empty bookings", () => {
    const result = buildBookingCalendarEvents([], { today: TODAY, emailByClientId: new Map(), tz: TZ });
    expect(result).toEqual([]);
  });

  it("sets workspaceTz on every constructed event to the passed tz", () => {
    const booking = makeBooking("b1", [
      { startAt: new Date("2026-08-15T01:00:00Z"), endAt: new Date("2026-08-15T09:00:00Z") },
    ]);
    const events = buildBookingCalendarEvents([booking], {
      today: TODAY,
      emailByClientId: new Map(),
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
      emailByClientId: new Map(),
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
      emailByClientId: new Map(),
      tz: TZ,
    });
    expect(event.id).toBe("b1_s0_2026-08-15");
  });

  it("resolves clientEmail from emailByClientId when clientId is set", () => {
    const booking = makeBooking("b1", [
      { startAt: new Date("2026-08-15T01:00:00Z"), endAt: new Date("2026-08-15T09:00:00Z") },
    ]);
    const [event] = buildBookingCalendarEvents([booking], {
      today: TODAY,
      emailByClientId: new Map([["client1", "ada@example.com"]]),
      tz: TZ,
    });
    expect(event.clientEmail).toBe("ada@example.com");
  });

  it("sets clientEmail to null when clientId is absent", () => {
    const booking = makeBooking(
      "b1",
      [{ startAt: new Date("2026-08-15T01:00:00Z"), endAt: new Date("2026-08-15T09:00:00Z") }],
      { clientId: null }
    );
    const [event] = buildBookingCalendarEvents([booking], {
      today: TODAY,
      emailByClientId: new Map(),
      tz: TZ,
    });
    expect(event.clientEmail).toBeNull();
  });

  it("returns one event per session for a multi-session booking with same-day sessions", () => {
    const booking = makeBooking("b1", [
      { startAt: new Date("2026-08-15T01:00:00Z"), endAt: new Date("2026-08-15T09:00:00Z") },
      { startAt: new Date("2026-08-16T01:00:00Z"), endAt: new Date("2026-08-16T09:00:00Z") },
    ]);
    const events = buildBookingCalendarEvents([booking], {
      today: TODAY,
      emailByClientId: new Map(),
      tz: TZ,
    });
    expect(events).toHaveLength(2);
    expect(events[0].sessionIndex).toBe(0);
    expect(events[1].sessionIndex).toBe(1);
  });
});
