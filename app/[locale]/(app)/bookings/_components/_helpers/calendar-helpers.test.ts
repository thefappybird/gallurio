import { describe, it, expect } from "vitest";
import {
  toMinutes,
  overlappingShifts,
  isoDate,
  isoDateInTz,
  dateToTzMinutes,
  reconstructSessions,
  detectConflictIds,
} from "./calendar-helpers";
import type { CalendarEvent } from "../booking-calendar";

// ── toMinutes ─────────────────────────────────────────────────────────────────

describe("toMinutes", () => {
  it("converts 13:30 to 810", () => {
    expect(toMinutes("13:30")).toBe(810);
  });

  it("converts 00:00 to 0", () => {
    expect(toMinutes("00:00")).toBe(0);
  });

  it("converts 23:59 to 1439", () => {
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("returns null for empty string", () => {
    expect(toMinutes("")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(toMinutes("ab:cd")).toBeNull();
  });

  it("returns null for missing colon", () => {
    expect(toMinutes("1330")).toBeNull();
  });

  it("returns null for out-of-range hours (24:00)", () => {
    expect(toMinutes("24:00")).toBeNull();
  });

  it("returns null for out-of-range minutes (12:60)", () => {
    expect(toMinutes("12:60")).toBeNull();
  });
});

// ── overlappingShifts ─────────────────────────────────────────────────────────

function shift(
  id: string,
  shiftStart: string,
  shiftEnd: string
) {
  return { id, title: "Test", shiftStart, shiftEnd };
}

describe("overlappingShifts", () => {
  it("detects an overlapping shift in the middle", () => {
    const result = overlappingShifts(
      [shift("a", "13:00", "14:00")],
      600, // 10:00
      1020 // 17:00
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  it("returns empty for adjacent-exact boundary (aEnd === bStart)", () => {
    // 10:00–13:00 ends exactly when 13:00–17:00 begins — no overlap.
    const result = overlappingShifts(
      [shift("a", "13:00", "17:00")],
      600,  // 10:00
      780   // 13:00
    );
    expect(result).toHaveLength(0);
  });

  it("returns empty for a shift entirely before the range", () => {
    const result = overlappingShifts(
      [shift("a", "08:00", "09:00")],
      600,  // 10:00
      1020  // 17:00
    );
    expect(result).toHaveLength(0);
  });

  it("returns empty for a shift entirely after the range", () => {
    const result = overlappingShifts(
      [shift("a", "18:00", "20:00")],
      600,  // 10:00
      1020  // 17:00
    );
    expect(result).toHaveLength(0);
  });

  it("returns multiple overlapping shifts", () => {
    const result = overlappingShifts(
      [shift("a", "11:00", "12:00"), shift("b", "14:00", "15:00"), shift("c", "18:00", "19:00")],
      600,  // 10:00
      1020  // 17:00
    );
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("returns empty when shifts list is empty", () => {
    expect(overlappingShifts([], 600, 1020)).toHaveLength(0);
  });

  it("ignores shifts with unparseable shiftStart/shiftEnd", () => {
    const result = overlappingShifts(
      [shift("a", "bad", "input")],
      600,
      1020
    );
    expect(result).toHaveLength(0);
  });
});

// ── isoDateInTz ───────────────────────────────────────────────────────────────

describe("isoDateInTz", () => {
  it("returns the date as seen in the given IANA timezone", () => {
    // UTC midnight on Aug 16 is still Aug 15 in Manila (UTC+8 → 08:00 Aug 16,
    // but use a UTC time that is Aug 15 in Manila to keep it simple).
    // 2026-08-15T01:00:00Z → Aug 15 09:00 in Manila (UTC+8). Should be "2026-08-15".
    const d = new Date("2026-08-15T01:00:00Z");
    expect(isoDateInTz(d, "Asia/Manila")).toBe("2026-08-15");
  });

  it("crosses the date boundary for east-of-UTC zones", () => {
    // 2026-08-15T16:01:00Z → 2026-08-16 00:01 in Manila (UTC+8).
    const d = new Date("2026-08-15T16:01:00Z");
    expect(isoDateInTz(d, "Asia/Manila")).toBe("2026-08-16");
  });

  it("crosses the date boundary for west-of-UTC zones (LA, UTC-7/8)", () => {
    // 2026-08-15T06:00:00Z → 2026-08-14 23:00 in LA (PDT = UTC-7).
    const d = new Date("2026-08-15T06:00:00Z");
    expect(isoDateInTz(d, "America/Los_Angeles")).toBe("2026-08-14");
  });
});

// ── dateToTzMinutes ───────────────────────────────────────────────────────────

describe("dateToTzMinutes", () => {
  it("returns correct minutes for 10:30 Manila time", () => {
    // 2026-08-15T02:30:00Z → 10:30 Manila (UTC+8).
    const d = new Date("2026-08-15T02:30:00Z");
    expect(dateToTzMinutes(d, "Asia/Manila")).toBe(10 * 60 + 30);
  });

  it("returns 0 for 00:00 in the given timezone", () => {
    // 2026-08-15T16:00:00Z → 00:00 Manila on 2026-08-16.
    const d = new Date("2026-08-15T16:00:00Z");
    expect(dateToTzMinutes(d, "Asia/Manila")).toBe(0);
  });
});

// ── isoDate ───────────────────────────────────────────────────────────────────

describe("isoDate", () => {
  it("returns YYYY-MM-DD in local time", () => {
    // Construct a date at noon local time to avoid any UTC boundary issues.
    const d = new Date(2026, 4, 25, 12, 0, 0); // May 25, 2026 noon local
    expect(isoDate(d)).toBe("2026-05-25");
  });

  it("zero-pads month and day", () => {
    const d = new Date(2026, 0, 5, 12, 0, 0); // Jan 5, 2026
    expect(isoDate(d)).toBe("2026-01-05");
  });

  it("handles end-of-year boundary", () => {
    const d = new Date(2026, 11, 31, 12, 0, 0); // Dec 31, 2026
    expect(isoDate(d)).toBe("2026-12-31");
  });
});

// ── reconstructSessions ───────────────────────────────────────────────────────

function makeEvent(
  bookingId: string,
  sessionIndex: number,
  startAt: Date,
  endAt: Date,
  idSuffix = ""
): CalendarEvent {
  return {
    id: `${bookingId}_s${sessionIndex}_2026-05-25${idSuffix}`,
    bookingId,
    teamId: null,
    title: "Test Shoot",
    start: startAt,
    end: endAt,
    status: "booked",
    clientName: "Test Client",
    clientEmail: null,
    rangeStart: startAt,
    rangeEnd: endAt,
    sessionIndex,
    sessionStartAt: startAt,
    sessionEndAt: endAt,
    sessionDayCount: 1,
    sessionPastDayCount: 0,
  };
}

describe("reconstructSessions", () => {
  const s0Start = new Date(2026, 4, 25, 10, 0, 0);
  const s0End = new Date(2026, 4, 25, 17, 0, 0);
  const s1Start = new Date(2026, 4, 26, 10, 0, 0);
  const s1End = new Date(2026, 4, 26, 17, 0, 0);

  it("returns sessions sorted by sessionIndex", () => {
    const events: CalendarEvent[] = [
      makeEvent("b1", 1, s1Start, s1End),
      makeEvent("b1", 0, s0Start, s0End),
    ];
    const sessions = reconstructSessions(events, "b1");
    expect(sessions).toHaveLength(2);
    expect(sessions[0].startAt).toEqual(s0Start);
    expect(sessions[1].startAt).toEqual(s1Start);
  });

  it("deduplicates multiple candles with the same sessionIndex", () => {
    // Session 0 has two candles (multi-day booking rendered as two candles).
    const events: CalendarEvent[] = [
      makeEvent("b1", 0, s0Start, s0End, "_day1"),
      makeEvent("b1", 0, s0Start, s0End, "_day2"),
    ];
    const sessions = reconstructSessions(events, "b1");
    expect(sessions).toHaveLength(1);
  });

  it("ignores events belonging to other bookings", () => {
    const events: CalendarEvent[] = [
      makeEvent("b1", 0, s0Start, s0End),
      makeEvent("b2", 0, s1Start, s1End),
    ];
    const sessions = reconstructSessions(events, "b1");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].startAt).toEqual(s0Start);
  });

  it("returns empty array when no events match the bookingId", () => {
    const events: CalendarEvent[] = [makeEvent("b1", 0, s0Start, s0End)];
    expect(reconstructSessions(events, "b999")).toHaveLength(0);
  });

  it("returns empty array for an empty events list", () => {
    expect(reconstructSessions([], "b1")).toHaveLength(0);
  });
});

// ── detectConflictIds ─────────────────────────────────────────────────────────

function makeConflictEvent(
  id: string,
  bookingId: string,
  start: Date,
  end: Date,
  kind?: 'inquiry' | 'booking'
): CalendarEvent {
  return {
    id,
    bookingId,
    teamId: null,
    title: 'Event',
    start,
    end,
    status: 'booked',
    clientName: 'Client',
    clientEmail: null,
    rangeStart: start,
    rangeEnd: end,
    sessionIndex: 0,
    sessionStartAt: start,
    sessionEndAt: end,
    sessionDayCount: 1,
    sessionPastDayCount: 0,
    kind,
  };
}

describe('detectConflictIds', () => {
  const t = (h: number, m = 0) => new Date(2026, 4, 25, h, m, 0);

  it('returns empty for non-overlapping events', () => {
    const events: CalendarEvent[] = [
      makeConflictEvent('a', 'b1', t(10), t(12)),
      makeConflictEvent('b', 'b2', t(13), t(15)),
    ];
    expect(detectConflictIds(events).size).toBe(0);
  });

  it('flags two overlapping booking events', () => {
    const events: CalendarEvent[] = [
      makeConflictEvent('a', 'b1', t(10), t(14)),
      makeConflictEvent('b', 'b2', t(12), t(16)),
    ];
    const ids = detectConflictIds(events);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(true);
  });

  it('does NOT flag two overlapping inquiry events as conflicts', () => {
    const events: CalendarEvent[] = [
      makeConflictEvent('a', 'i1', t(10), t(14), 'inquiry'),
      makeConflictEvent('b', 'i2', t(12), t(16), 'inquiry'),
    ];
    const ids = detectConflictIds(events);
    expect(ids.size).toBe(0);
  });

  it('flags an inquiry overlapping a booking', () => {
    const events: CalendarEvent[] = [
      makeConflictEvent('a', 'i1', t(10), t(14), 'inquiry'),
      makeConflictEvent('b', 'b1', t(12), t(16)),
    ];
    const ids = detectConflictIds(events);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(true);
  });

  it('does not flag events with the same bookingId', () => {
    const events: CalendarEvent[] = [
      makeConflictEvent('a1', 'b1', t(10), t(14)),
      makeConflictEvent('a2', 'b1', t(12), t(16)),
    ];
    expect(detectConflictIds(events).size).toBe(0);
  });

  it('does not flag adjacent-exact boundary (end === start) as conflict', () => {
    const events: CalendarEvent[] = [
      makeConflictEvent('a', 'b1', t(10), t(12)),
      makeConflictEvent('b', 'b2', t(12), t(14)),
    ];
    expect(detectConflictIds(events).size).toBe(0);
  });

  it('booking-vs-booking still conflicts when kind is undefined', () => {
    const events: CalendarEvent[] = [
      makeConflictEvent('a', 'b1', t(10), t(14), undefined),
      makeConflictEvent('b', 'b2', t(12), t(16), undefined),
    ];
    const ids = detectConflictIds(events);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(true);
  });
});
