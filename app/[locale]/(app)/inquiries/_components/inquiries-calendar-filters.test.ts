import { describe, it, expect } from "vitest";
import { calendarEventMatchesFilters, mergeConflict } from "./inquiries-calendar-manager";
import type { CalendarEvent } from "../../bookings/_components/booking-calendar";

function makeEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "1",
    title: "Test",
    start: new Date(),
    end: new Date(),
    status: "booked",
    clientName: "",
    clientEmail: null,
    rangeStart: new Date(),
    rangeEnd: new Date(),
    sessionIndex: 0,
    sessionStartAt: new Date(),
    sessionEndAt: new Date(),
    sessionDayCount: 1,
    sessionPastDayCount: 0,
    bookingId: "bk1",
    teamId: null,
    kind: "inquiry",
    hasConflict: false,
    inquiryId: "inq1",
    ...overrides,
  } as CalendarEvent;
}

// inquiry candle with no conflict (represents a "new" inquiry)
const newCandle = makeEvent({ kind: "inquiry", hasConflict: false });
// inquiry candle with a conflict
const conflictedCandle = makeEvent({ kind: "inquiry", hasConflict: true });
// booking candle (kind omitted = undefined, treated as non-inquiry)
const bookingCandle = makeEvent({ kind: undefined, hasConflict: false });

describe("mergeConflict", () => {
  it("preserves server hasConflict=true even when conflictIds is empty (Booked chip OFF scenario)", () => {
    const ev = makeEvent({ kind: "inquiry", hasConflict: true });
    const result = mergeConflict(ev, new Set<string>());
    expect(result.hasConflict).toBe(true);
  });

  it("sets hasConflict=true when client detector finds the id", () => {
    const ev = makeEvent({ id: "ev1", kind: undefined, hasConflict: false });
    const result = mergeConflict(ev, new Set(["ev1"]));
    expect(result.hasConflict).toBe(true);
  });

  it("returns same reference when no change needed", () => {
    const ev = makeEvent({ hasConflict: false });
    const result = mergeConflict(ev, new Set<string>());
    expect(result).toBe(ev);
  });
});

describe("calendarEventMatchesFilters", () => {
  it("shows everything when all chips are ON", () => {
    expect(calendarEventMatchesFilters(newCandle, true, true, true)).toBe(true);
    expect(calendarEventMatchesFilters(conflictedCandle, true, true, true)).toBe(true);
    expect(calendarEventMatchesFilters(bookingCandle, true, true, true)).toBe(true);
  });

  it("hides booking when showBooked is OFF", () => {
    expect(calendarEventMatchesFilters(bookingCandle, true, false, true)).toBe(false);
  });

  it("shows booking when showBooked is ON", () => {
    expect(calendarEventMatchesFilters(bookingCandle, false, true, false)).toBe(true);
  });

  it("only Conflicted ON: shows conflicted New, hides non-conflicted New and Booking", () => {
    expect(calendarEventMatchesFilters(conflictedCandle, false, false, true)).toBe(true);
    expect(calendarEventMatchesFilters(newCandle, false, false, true)).toBe(false);
    expect(calendarEventMatchesFilters(bookingCandle, false, false, true)).toBe(false);
  });

  it("only New ON: shows both conflicted and non-conflicted inquiry candles, hides Booking", () => {
    expect(calendarEventMatchesFilters(newCandle, true, false, false)).toBe(true);
    expect(calendarEventMatchesFilters(conflictedCandle, true, false, false)).toBe(true);
    expect(calendarEventMatchesFilters(bookingCandle, true, false, false)).toBe(false);
  });

  it("all OFF: hides everything", () => {
    expect(calendarEventMatchesFilters(newCandle, false, false, false)).toBe(false);
    expect(calendarEventMatchesFilters(conflictedCandle, false, false, false)).toBe(false);
    expect(calendarEventMatchesFilters(bookingCandle, false, false, false)).toBe(false);
  });
});