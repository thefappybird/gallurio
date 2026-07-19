import { describe, expect, it } from "vitest";
import {
  splitDayOut,
  shiftSession,
  shiftSessionTimes,
  countDays,
  countPastDays,
  startOfDay,
  type Session,
} from "./session-edits";

// ─── helpers ─────────────────────────────────────────────────────────────────

function date(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

function today(): Date {
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return n;
}

function tomorrow(): Date {
  const d = today();
  d.setDate(d.getDate() + 1);
  return d;
}

function yesterday(): Date {
  const d = today();
  d.setDate(d.getDate() - 1);
  return d;
}

function daysAgo(n: number): Date {
  const d = today();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = today();
  d.setDate(d.getDate() + n);
  return d;
}

// ─── countDays ───────────────────────────────────────────────────────────────

describe("countDays", () => {
  it("returns 1 for a single-day session", () => {
    const s: Session = { startAt: date(2026, 8, 15, 10), endAt: date(2026, 8, 15, 18) };
    expect(countDays(s)).toBe(1);
  });

  it("returns 5 for a Mon-Fri session", () => {
    const s: Session = { startAt: date(2026, 8, 10, 10), endAt: date(2026, 8, 14, 18) };
    expect(countDays(s)).toBe(5);
  });
});

// ─── countPastDays ────────────────────────────────────────────────────────────

describe("countPastDays", () => {
  it("returns 0 for an all-future session", () => {
    const start = daysFromNow(1);
    start.setHours(10, 0, 0, 0);
    const end = daysFromNow(3);
    end.setHours(18, 0, 0, 0);
    expect(countPastDays({ startAt: start, endAt: end }, today())).toBe(0);
  });

  it("returns day-count for an all-past session", () => {
    const start = daysAgo(3);
    start.setHours(10, 0, 0, 0);
    const end = daysAgo(1);
    end.setHours(18, 0, 0, 0);
    // 3 days ago to 1 day ago = 3 days
    expect(countPastDays({ startAt: start, endAt: end }, today())).toBe(3);
  });

  it("returns only the past portion for a straddling session", () => {
    const start = daysAgo(2);
    start.setHours(10, 0, 0, 0);
    const end = daysFromNow(2);
    end.setHours(18, 0, 0, 0);
    // 2 days ago + yesterday = 2 past days
    expect(countPastDays({ startAt: start, endAt: end }, today())).toBe(2);
  });
});

// ─── splitDayOut ─────────────────────────────────────────────────────────────

describe("splitDayOut", () => {
  const session: Session = {
    startAt: date(2026, 8, 10, 9, 0),   // Mon, 09:00
    endAt:   date(2026, 8, 14, 17, 0),  // Fri, 17:00
  };
  const newStart = date(2026, 8, 12, 11, 0);
  const newEnd   = date(2026, 8, 12, 16, 0);

  it("returns three sessions when touching a middle day", () => {
    const result = splitDayOut(session, date(2026, 8, 12), newStart, newEnd);
    expect(result).toHaveLength(3);

    // Before: Mon-Tue at original times
    expect(startOfDay(result[0].startAt).getTime()).toBe(
      startOfDay(date(2026, 8, 10)).getTime()
    );
    expect(startOfDay(result[0].endAt).getTime()).toBe(
      startOfDay(date(2026, 8, 11)).getTime()
    );
    expect(result[0].endAt.getHours()).toBe(17); // original end time

    // Touched day
    expect(result[1].startAt.getTime()).toBe(newStart.getTime());
    expect(result[1].endAt.getTime()).toBe(newEnd.getTime());

    // After: Thu-Fri at original times
    expect(startOfDay(result[2].startAt).getTime()).toBe(
      startOfDay(date(2026, 8, 13)).getTime()
    );
    expect(result[2].startAt.getHours()).toBe(9); // original start time
    expect(startOfDay(result[2].endAt).getTime()).toBe(
      startOfDay(date(2026, 8, 14)).getTime()
    );
  });

  it("returns two sessions when touching the first day", () => {
    const firstNewStart = date(2026, 8, 10, 11, 0);
    const firstNewEnd   = date(2026, 8, 10, 16, 0);
    const result = splitDayOut(session, date(2026, 8, 10), firstNewStart, firstNewEnd);
    expect(result).toHaveLength(2);
    // No "before" portion
    expect(result[0].startAt.getTime()).toBe(firstNewStart.getTime());
    expect(result[1].startAt.getHours()).toBe(9); // original start time on Tue
  });

  it("returns two sessions when touching the last day", () => {
    const lastNewStart = date(2026, 8, 14, 11, 0);
    const lastNewEnd   = date(2026, 8, 14, 16, 0);
    const result = splitDayOut(session, date(2026, 8, 14), lastNewStart, lastNewEnd);
    expect(result).toHaveLength(2);
    expect(result[1].startAt.getTime()).toBe(lastNewStart.getTime());
    expect(result[1].endAt.getTime()).toBe(lastNewEnd.getTime());
  });

  it("returns exactly one session when touching the only day", () => {
    const single: Session = {
      startAt: date(2026, 8, 12, 9, 0),
      endAt:   date(2026, 8, 12, 17, 0),
    };
    const result = splitDayOut(single, date(2026, 8, 12), newStart, newEnd);
    expect(result).toHaveLength(1);
    expect(result[0].startAt.getTime()).toBe(newStart.getTime());
    expect(result[0].endAt.getTime()).toBe(newEnd.getTime());
  });
});

// ─── shiftSession ─────────────────────────────────────────────────────────────

describe("shiftSession", () => {
  const oneDay = 86_400_000;

  it("shifts an all-future session by exactly shiftMs", () => {
    const start = daysFromNow(2);
    start.setHours(10, 0, 0, 0);
    const end = daysFromNow(4);
    end.setHours(17, 0, 0, 0);
    const session: Session = { startAt: start, endAt: end };

    const result = shiftSession(session, oneDay, today());
    expect(result).toHaveLength(1);
    expect(result[0].startAt.getTime()).toBe(start.getTime() + oneDay);
    expect(result[0].endAt.getTime()).toBe(end.getTime() + oneDay);
  });

  it("returns unchanged session for an all-past session", () => {
    const start = daysAgo(5);
    start.setHours(10, 0, 0, 0);
    const end = daysAgo(3);
    end.setHours(17, 0, 0, 0);
    const session: Session = { startAt: start, endAt: end };

    const result = shiftSession(session, oneDay, today());
    expect(result).toHaveLength(1);
    expect(result[0].startAt.getTime()).toBe(start.getTime());
    expect(result[0].endAt.getTime()).toBe(end.getTime());
  });

  it("splits a straddling session into past (original) + future (shifted)", () => {
    const start = daysAgo(2);
    start.setHours(10, 0, 0, 0);
    const end = daysFromNow(2);
    end.setHours(17, 0, 0, 0);
    const session: Session = { startAt: start, endAt: end };

    const result = shiftSession(session, oneDay, today());
    expect(result).toHaveLength(2);

    // Past portion: original startAt, ends yesterday at original end-time
    expect(result[0].startAt.getTime()).toBe(start.getTime());
    expect(startOfDay(result[0].endAt).getTime()).toBe(
      startOfDay(yesterday()).getTime()
    );
    expect(result[0].endAt.getHours()).toBe(17); // original end hour

    // Future portion: starts today, shifted by 1 day
    expect(startOfDay(result[1].startAt).getTime()).toBe(
      startOfDay(tomorrow()).getTime()
    );
    expect(result[1].endAt.getTime()).toBe(end.getTime() + oneDay);
  });
});

// ─── shiftSessionTimes ────────────────────────────────────────────────────────

describe("shiftSessionTimes", () => {
  function timeDate(h: number, min: number): Date {
    return date(2000, 1, 1, h, min);
  }

  it("applies new times to an all-future session", () => {
    const start = daysFromNow(2);
    start.setHours(10, 0, 0, 0);
    const end = daysFromNow(4);
    end.setHours(17, 0, 0, 0);
    const session: Session = { startAt: start, endAt: end };

    const result = shiftSessionTimes(session, timeDate(11, 0), timeDate(18, 0), today());
    expect(result).toHaveLength(1);
    expect(result[0].startAt.getHours()).toBe(11);
    expect(result[0].endAt.getHours()).toBe(18);
    // Date portion unchanged
    expect(startOfDay(result[0].startAt).getTime()).toBe(startOfDay(start).getTime());
    expect(startOfDay(result[0].endAt).getTime()).toBe(startOfDay(end).getTime());
  });

  it("returns unchanged session for an all-past session", () => {
    const start = daysAgo(4);
    start.setHours(10, 0, 0, 0);
    const end = daysAgo(2);
    end.setHours(17, 0, 0, 0);
    const session: Session = { startAt: start, endAt: end };

    const result = shiftSessionTimes(session, timeDate(11, 0), timeDate(18, 0), today());
    expect(result).toHaveLength(1);
    expect(result[0].startAt.getTime()).toBe(start.getTime());
    expect(result[0].endAt.getTime()).toBe(end.getTime());
  });

  it("splits a straddling session — past at original times, future at new times", () => {
    const start = daysAgo(2);
    start.setHours(10, 0, 0, 0);
    const end = daysFromNow(2);
    end.setHours(17, 0, 0, 0);
    const session: Session = { startAt: start, endAt: end };

    const result = shiftSessionTimes(session, timeDate(11, 0), timeDate(18, 0), today());
    expect(result).toHaveLength(2);

    // Past portion retains original hours
    expect(result[0].startAt.getTime()).toBe(start.getTime());
    expect(result[0].endAt.getHours()).toBe(17);

    // Future portion has new hours
    expect(result[1].startAt.getHours()).toBe(11);
    expect(result[1].endAt.getHours()).toBe(18);
    expect(startOfDay(result[1].startAt).getTime()).toBe(startOfDay(today()).getTime());
  });
});
