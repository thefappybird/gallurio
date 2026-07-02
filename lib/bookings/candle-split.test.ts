import { describe, expect, it } from "vitest";
import { splitSessionIntoCandles, type SessionInput } from "./candle-split";

// UTC-anchored so these tests are independent of the runner's local timezone —
// timeZone: "UTC" makes wall-clock-in-tz equal to the instant's own UTC parts.
function date(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min, 0, 0));
}

function midnightTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function dayOffset(base: Date, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

const UTC = "UTC";

// ─── 1-day daytime ───────────────────────────────────────────────────────────

describe("1-day daytime session", () => {
  const session: SessionInput = {
    startAt: date(2026, 8, 15, 10, 0),
    endAt: date(2026, 8, 15, 17, 0),
  };
  const today = date(2026, 8, 20);

  it("produces 1 candle", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.candles).toHaveLength(1);
    expect(r.totalShiftDays).toBe(1);
  });

  it("candle covers the correct window", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    const [c] = r.candles;
    expect(c.start).toEqual(date(2026, 8, 15, 10, 0));
    expect(c.end).toEqual(date(2026, 8, 15, 17, 0));
    expect(c.dayKey).toBe("2026-08-15");
  });

  it("rangeStart and rangeEnd are the same day", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.rangeStart).toEqual(date(2026, 8, 15));
    expect(r.rangeEnd).toEqual(date(2026, 8, 15));
  });

  it("pastShiftDays is 1 (session is in the past)", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
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
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.candles).toHaveLength(3);
    expect(r.totalShiftDays).toBe(3);
  });

  it("all candles have identical shift times", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    for (const c of r.candles) {
      expect(c.start.getUTCHours()).toBe(10);
      expect(c.start.getUTCMinutes()).toBe(0);
      expect(c.end.getUTCHours()).toBe(17);
      expect(c.end.getUTCMinutes()).toBe(0);
    }
  });

  it("candle dayKeys are Aug 10, 11, 12", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.candles.map((c) => c.dayKey)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
    ]);
  });

  it("rangeStart=Aug 10, rangeEnd=Aug 12", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.rangeStart).toEqual(date(2026, 8, 10));
    expect(r.rangeEnd).toEqual(date(2026, 8, 12));
  });

  it("all 3 past when today is after Aug 12", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
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
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.candles).toHaveLength(1);
    expect(r.totalShiftDays).toBe(1);
  });

  it("candle spans Day1 21:00 → Day2 04:00", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    const [c] = r.candles;
    expect(c.start).toEqual(date(2026, 8, 15, 21, 0));
    expect(c.end).toEqual(date(2026, 8, 16, 4, 0));
  });

  it("dayKey is the evening day (Aug 15)", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.candles[0].dayKey).toBe("2026-08-15");
  });

  it("rangeStart=Aug 15, rangeEnd=Aug 16", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.rangeStart).toEqual(date(2026, 8, 15));
    expect(r.rangeEnd).toEqual(date(2026, 8, 16));
  });

  it("pastShiftDays=1 when today is after Aug 16", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
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
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.candles).toHaveLength(2);
    expect(r.totalShiftDays).toBe(2);
  });

  it("first candle spans Aug15 21:00 → Aug16 04:00", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.candles[0].start).toEqual(date(2026, 8, 15, 21, 0));
    expect(r.candles[0].end).toEqual(date(2026, 8, 16, 4, 0));
    expect(r.candles[0].dayKey).toBe("2026-08-15");
  });

  it("second candle spans Aug16 21:00 → Aug17 04:00", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.candles[1].start).toEqual(date(2026, 8, 16, 21, 0));
    expect(r.candles[1].end).toEqual(date(2026, 8, 17, 4, 0));
    expect(r.candles[1].dayKey).toBe("2026-08-16");
  });

  it("rangeStart=Aug 15, rangeEnd=Aug 17", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.rangeStart).toEqual(date(2026, 8, 15));
    expect(r.rangeEnd).toEqual(date(2026, 8, 17));
  });

  it("pastShiftDays=2 when today is after Aug 17", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.pastShiftDays).toBe(2);
  });
});

// ─── pastShiftDays for straddling daytime session ─────────────────────────────

describe("pastShiftDays correctness — daytime session straddling today", () => {
  it("counts only shift-days strictly before today", () => {
    const now = midnightTodayUTC();
    // session: yesterday 10:00 → tomorrow 17:00 (3 days: yesterday, today, tomorrow)
    const startAt = dayOffset(now, -1);
    startAt.setUTCHours(10, 0, 0, 0);
    const endAt = dayOffset(now, 1);
    endAt.setUTCHours(17, 0, 0, 0);

    const r = splitSessionIntoCandles({ startAt, endAt }, now, UTC);
    expect(r.totalShiftDays).toBe(3);
    // Only yesterday is strictly before today
    expect(r.pastShiftDays).toBe(1);
  });
});

// ─── pastShiftDays for multi-night overnight straddling today ─────────────────

describe("pastShiftDays correctness — overnight session with today inside range", () => {
  it("counts shift-days (evenings) strictly before today", () => {
    const now = midnightTodayUTC();
    // overnight session: 2 nights ago 21:00 → tomorrow morning 04:00
    // shift-days: 2 nights ago (past), last night (past), tonight (not past yet)
    const startAt = dayOffset(now, -2);
    startAt.setUTCHours(21, 0, 0, 0);
    const endAt = dayOffset(now, 1); // tomorrow 04:00
    endAt.setUTCHours(4, 0, 0, 0);

    const r = splitSessionIntoCandles({ startAt, endAt }, now, UTC);
    // 3 shift-days: 2 nights ago, last night, tonight
    expect(r.totalShiftDays).toBe(3);
    // 2 nights ago and last night are before today (midnight)
    expect(r.pastShiftDays).toBe(2);
  });
});

// ─── midnight boundary edge cases ─────────────────────────────────────────────

describe("midnight boundary — session ending exactly at midnight", () => {
  // Aug 15 21:00 → Aug 16 00:00: endHour(0) < startHour(21) so isOvernight=true.
  // lastShiftDay = startOfDay(Aug16 - 1 day) = Aug15, so loop runs once (Aug15 only).
  const session: SessionInput = {
    startAt: date(2026, 8, 15, 21, 0),
    endAt: date(2026, 8, 16, 0, 0),
  };
  const today = date(2026, 8, 20);

  it("is flagged as overnight (endHour 0 < startHour 21)", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    // Overnight flag causes the single candle to span into the next day.
    expect(r.candles).toHaveLength(1);
  });

  it("produces 1 candle", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.totalShiftDays).toBe(1);
  });

  it("candle ends at Aug 16 00:00 (the exact midnight)", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    const [c] = r.candles;
    expect(c.end).toEqual(date(2026, 8, 16, 0, 0));
  });
});

describe("zero-duration same-day session (start === end)", () => {
  // startAt and endAt are identical: same hour, same minute.
  // endHour(12) === startHour(12) and endMin(0) === startMin(0) → isOvernight=false.
  // lastShiftDay = startOfDay(Aug15), loop runs once producing 1 candle.
  const session: SessionInput = {
    startAt: date(2026, 8, 15, 12, 0),
    endAt: date(2026, 8, 15, 12, 0),
  };
  const today = date(2026, 8, 20);

  it("produces 1 candle (not 0)", () => {
    // Zero-duration is treated as a point-in-time event, not skipped.
    const r = splitSessionIntoCandles(session, today, UTC);
    expect(r.candles).toHaveLength(1);
  });

  it("candle start and end are both 12:00", () => {
    const r = splitSessionIntoCandles(session, today, UTC);
    const [c] = r.candles;
    expect(c.start).toEqual(date(2026, 8, 15, 12, 0));
    expect(c.end).toEqual(date(2026, 8, 15, 12, 0));
  });
});

// ─── timezone correctness — split boundary follows the workspace tz, not the
// runner's local tz ─────────────────────────────────────────────────────────

describe("timezone-aware day-boundary splitting", () => {
  // 2026-08-15T17:00:00Z → 2026-08-16T01:00:00Z.
  //  - In Asia/Manila (UTC+8) this is 01:00 → 09:00 on Aug 16: a same-day,
  //    non-overnight session that should produce exactly 1 candle keyed Aug 16.
  //  - In UTC this is 17:00 Aug 15 → 01:00 Aug 16: an overnight session that
  //    should produce exactly 1 candle keyed Aug 15.
  // Same UTC instants, different (correct) split depending on which tz is
  // passed in — proving the split is driven by the workspace tz parameter,
  // not by native Date getters (which would read the runner's local tz).
  const session: SessionInput = {
    startAt: new Date("2026-08-15T17:00:00Z"),
    endAt: new Date("2026-08-16T01:00:00Z"),
  };
  const today = new Date("2026-08-20T00:00:00Z");

  it("splits as a single same-day candle keyed Aug 16 in Asia/Manila", () => {
    const r = splitSessionIntoCandles(session, today, "Asia/Manila");
    expect(r.candles).toHaveLength(1);
    expect(r.candles[0].dayKey).toBe("2026-08-16");
    expect(r.candles[0].start).toEqual(session.startAt);
    expect(r.candles[0].end).toEqual(session.endAt);
  });

  it("splits as a single overnight candle keyed Aug 15 in UTC", () => {
    const r = splitSessionIntoCandles(session, today, "UTC");
    expect(r.candles).toHaveLength(1);
    expect(r.candles[0].dayKey).toBe("2026-08-15");
    expect(r.candles[0].start).toEqual(session.startAt);
    expect(r.candles[0].end).toEqual(session.endAt);
  });
});
