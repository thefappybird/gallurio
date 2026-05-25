import { describe, expect, it } from "vitest";
import { splitCandleAtMidnight } from "./midnight-split";
import type { Candle } from "./candle-split";

function makeCandle(startISO: string, endISO: string, dayKey?: string): Candle {
  const start = new Date(startISO);
  return {
    start,
    end: new Date(endISO),
    dayKey: dayKey ?? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
  };
}

describe("splitCandleAtMidnight", () => {
  it("returns single unchanged entry for a same-day candle", () => {
    const candle = makeCandle("2026-08-15T10:00:00", "2026-08-15T14:00:00");
    const result = splitCandleAtMidnight(candle);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(candle);
  });

  it("returns single unchanged entry for a same-day candle ending at midnight boundary (23:59:59)", () => {
    const candle = makeCandle("2026-08-15T20:00:00", "2026-08-15T23:59:59");
    const result = splitCandleAtMidnight(candle);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(candle);
  });

  describe("overnight candle 22:00 → 04:00 next day", () => {
    const candle = makeCandle("2026-08-15T22:00:00", "2026-08-16T04:00:00", "2026-08-15");
    let result: ReturnType<typeof splitCandleAtMidnight>;

    // We recreate per-test to keep each assertion independent.
    it("returns exactly two halves", () => {
      result = splitCandleAtMidnight(candle);
      expect(result).toHaveLength(2);
    });

    it("first half (evening) has isEveningHead=true and isMorningContinuation undefined/false", () => {
      result = splitCandleAtMidnight(candle);
      expect(result[0].isEveningHead).toBe(true);
      expect(result[0].isMorningContinuation).toBeFalsy();
    });

    it("second half (morning) has isMorningContinuation=true and isEveningHead undefined/false", () => {
      result = splitCandleAtMidnight(candle);
      expect(result[1].isMorningContinuation).toBe(true);
      expect(result[1].isEveningHead).toBeFalsy();
    });

    it("evening half starts at original start (22:00 on day1)", () => {
      result = splitCandleAtMidnight(candle);
      expect(result[0].start).toEqual(new Date("2026-08-15T22:00:00"));
    });

    it("evening half ends at 23:59:59.999 on day1 (1ms before midnight)", () => {
      result = splitCandleAtMidnight(candle);
      // midnight of 2026-08-16 is 2026-08-16T00:00:00.000
      const midnight = new Date("2026-08-16T00:00:00.000").getTime();
      expect(result[0].end.getTime()).toBe(midnight - 1);
    });

    it("morning half starts at 00:00:00.000 on day2", () => {
      result = splitCandleAtMidnight(candle);
      expect(result[1].start).toEqual(new Date("2026-08-16T00:00:00.000"));
    });

    it("morning half ends at original end (04:00 on day2)", () => {
      result = splitCandleAtMidnight(candle);
      expect(result[1].end).toEqual(new Date("2026-08-16T04:00:00"));
    });

    it("both halves share the same dayKey", () => {
      result = splitCandleAtMidnight(candle);
      expect(result[0].dayKey).toBe("2026-08-15");
      expect(result[1].dayKey).toBe("2026-08-15");
    });

    it("sub-millisecond precision: evening end is exactly 1ms before midnight", () => {
      result = splitCandleAtMidnight(candle);
      const eveningEnd = result[0].end.getTime();
      const morningStart = result[1].start.getTime();
      expect(morningStart - eveningEnd).toBe(1);
    });
  });

  it("spans multiple days: only first midnight is split (start→next midnight, then midnight→end)", () => {
    // e.g. a candle starting 22:00 on Aug 15 and ending 02:00 on Aug 17
    // (two nights) — the helper splits at the first midnight only
    const candle = makeCandle("2026-08-15T22:00:00", "2026-08-17T02:00:00", "2026-08-15");
    const result = splitCandleAtMidnight(candle);
    // The function splits on startDay vs endDay mismatch — returns two entries
    expect(result).toHaveLength(2);
    expect(result[0].isEveningHead).toBe(true);
    expect(result[1].isMorningContinuation).toBe(true);
    // The morning half retains the original far-future end
    expect(result[1].end).toEqual(new Date("2026-08-17T02:00:00"));
  });
});
