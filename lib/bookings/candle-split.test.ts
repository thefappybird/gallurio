import { describe, expect, it } from "vitest";
import { splitSessionIntoCandles, type SessionInput } from "./candle-split";

function date(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

function todayAt(h: number, min = 0): Date {
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d;
}

function midnightToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayOffset(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

// ─── 1-day daytime ───────────────────────────────────────────────────────────

describe("1-day daytime session", () => {
  const session: SessionInput = {
    startAt: date(2026, 8, 15, 10, 0),
    endAt: date(2026, 8, 15, 17, 0),
  };
  const today = date(2026, 8, 20);

  it("produces 1 candle", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.candles).toHaveLength(1);
    expect(r.totalShiftDays).toBe(1);
  });

  it("candle covers the correct window", () => {
    const r = splitSessionIntoCandles(session, today);
    const [c] = r.candles;
    expect(c.start).toEqual(date(2026, 8, 15, 10, 0));
    expect(c.end).toEqual(date(2026, 8, 15, 17, 0));
    expect(c.dayKey).toBe("2026-08-15");
  });

  it("rangeStart and rangeEnd are the same day", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.rangeStart).toEqual(date(2026, 8, 15));
    expect(r.rangeEnd).toEqual(date(2026, 8, 15));
  });

  it("pastShiftDays is 1 (session is in the past)", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.pastShiftDays).toBe(1);
  });
});

// ─── 3-day daytime ───────────────────────────────────────────────────────────

describe("3-day daytime session", () => {
  const session: SessionInput = {
    startAt: date(2026, 8, 10, 10, 0),
    endAt: date(2026, 8, 12, 17, 0),
  };
  const today = date(2026, 8, 20);

  it("produces 3 candles", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.candles).toHaveLength(3);
    expect(r.totalShiftDays).toBe(3);
  });

  it("all candles have identical shift times", () => {
    const r = splitSessionIntoCandles(session, today);
    for (const c of r.candles) {
      expect(c.start.getHours()).toBe(10);
      expect(c.start.getMinutes()).toBe(0);
      expect(c.end.getHours()).toBe(17);
      expect(c.end.getMinutes()).toBe(0);
    }
  });

  it("candle dayKeys are Aug 10, 11, 12", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.candles.map((c) => c.dayKey)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
    ]);
  });

  it("rangeStart=Aug 10, rangeEnd=Aug 12", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.rangeStart).toEqual(date(2026, 8, 10));
    expect(r.rangeEnd).toEqual(date(2026, 8, 12));
  });

  it("all 3 past when today is after Aug 12", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.pastShiftDays).toBe(3);
  });
});

// ─── single overnight ─────────────────────────────────────────────────────────

describe("single overnight session (Day1 21:00 → Day2 04:00)", () => {
  const session: SessionInput = {
    startAt: date(2026, 8, 15, 21, 0),
    endAt: date(2026, 8, 16, 4, 0),
  };
  const today = date(2026, 8, 20);

  it("produces 1 candle", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.candles).toHaveLength(1);
    expect(r.totalShiftDays).toBe(1);
  });

  it("candle spans Day1 21:00 → Day2 04:00", () => {
    const r = splitSessionIntoCandles(session, today);
    const [c] = r.candles;
    expect(c.start).toEqual(date(2026, 8, 15, 21, 0));
    expect(c.end).toEqual(date(2026, 8, 16, 4, 0));
  });

  it("dayKey is the evening day (Aug 15)", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.candles[0].dayKey).toBe("2026-08-15");
  });

  it("rangeStart=Aug 15, rangeEnd=Aug 16", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.rangeStart).toEqual(date(2026, 8, 15));
    expect(r.rangeEnd).toEqual(date(2026, 8, 16));
  });

  it("pastShiftDays=1 when today is after Aug 16", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.pastShiftDays).toBe(1);
  });
});

// ─── two-night overnight ──────────────────────────────────────────────────────

describe("two-night overnight session (Day1 21:00 → Day3 04:00)", () => {
  const session: SessionInput = {
    startAt: date(2026, 8, 15, 21, 0),
    endAt: date(2026, 8, 17, 4, 0),
  };
  const today = date(2026, 8, 20);

  it("produces 2 candles", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.candles).toHaveLength(2);
    expect(r.totalShiftDays).toBe(2);
  });

  it("first candle spans Aug15 21:00 → Aug16 04:00", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.candles[0].start).toEqual(date(2026, 8, 15, 21, 0));
    expect(r.candles[0].end).toEqual(date(2026, 8, 16, 4, 0));
    expect(r.candles[0].dayKey).toBe("2026-08-15");
  });

  it("second candle spans Aug16 21:00 → Aug17 04:00", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.candles[1].start).toEqual(date(2026, 8, 16, 21, 0));
    expect(r.candles[1].end).toEqual(date(2026, 8, 17, 4, 0));
    expect(r.candles[1].dayKey).toBe("2026-08-16");
  });

  it("rangeStart=Aug 15, rangeEnd=Aug 17", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.rangeStart).toEqual(date(2026, 8, 15));
    expect(r.rangeEnd).toEqual(date(2026, 8, 17));
  });

  it("pastShiftDays=2 when today is after Aug 17", () => {
    const r = splitSessionIntoCandles(session, today);
    expect(r.pastShiftDays).toBe(2);
  });
});

// ─── pastShiftDays for straddling daytime session ─────────────────────────────

describe("pastShiftDays correctness — daytime session straddling today", () => {
  it("counts only shift-days strictly before today", () => {
    const now = midnightToday();
    // session: yesterday 10:00 → tomorrow 17:00 (3 days: yesterday, today, tomorrow)
    const startAt = dayOffset(now, -1);
    startAt.setHours(10, 0, 0, 0);
    const endAt = dayOffset(now, 1);
    endAt.setHours(17, 0, 0, 0);

    const r = splitSessionIntoCandles({ startAt, endAt }, now);
    expect(r.totalShiftDays).toBe(3);
    // Only yesterday is strictly before today
    expect(r.pastShiftDays).toBe(1);
  });
});

// ─── pastShiftDays for multi-night overnight straddling today ─────────────────

describe("pastShiftDays correctness — overnight session with today inside range", () => {
  it("counts shift-days (evenings) strictly before today", () => {
    const now = midnightToday();
    // overnight session: 2 nights ago 21:00 → tomorrow morning 04:00
    // shift-days: 2 nights ago (past), last night (past), tonight (not past yet)
    const startAt = dayOffset(now, -2);
    startAt.setHours(21, 0, 0, 0);
    const endAt = dayOffset(now, 1); // tomorrow 04:00
    endAt.setHours(4, 0, 0, 0);

    const r = splitSessionIntoCandles({ startAt, endAt }, now);
    // 3 shift-days: 2 nights ago, last night, tonight
    expect(r.totalShiftDays).toBe(3);
    // 2 nights ago and last night are before today (midnight)
    expect(r.pastShiftDays).toBe(2);
  });
});
