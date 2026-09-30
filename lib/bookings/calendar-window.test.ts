import { describe, expect, it } from "vitest";
import { calendarWindow, isRangeInsideWindow, visibleGridRange } from "./calendar-window";

describe("isRangeInsideWindow", () => {
  it("accepts contained ranges and rejects ones poking out either side", () => {
    const w = calendarWindow(new Date("2026-09-15T04:00:00Z"), "Asia/Manila");
    expect(isRangeInsideWindow({ start: w.start, end: w.end }, w)).toBe(true);
    expect(isRangeInsideWindow({ start: new Date(w.start.getTime() - 1), end: w.end }, w)).toBe(false);
    expect(isRangeInsideWindow({ start: w.start, end: new Date(w.end.getTime() + 1) }, w)).toBe(false);
  });
});

describe("calendarWindow", () => {
  it("pads the Sunday-aligned month grid by 37 days, day bounds in Manila", () => {
    const w = calendarWindow(new Date("2026-09-15T04:00:00Z"), "Asia/Manila");
    // Sep 2026 grid = Sun Aug 30 .. Sat Oct 3; +/-31d.
    expect(w.startDate).toBe("2026-07-24");
    expect(w.endDate).toBe("2026-11-09");
    expect(w.start.toISOString()).toBe("2026-07-23T16:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-11-09T15:59:59.999Z");
  });

  it("covers every spill-over grid day with >= 15 days pad, across year edges and leap Feb", () => {
    const DAY = 86_400_000;
    for (const tz of ["Asia/Manila", "America/New_York"]) {
      for (let y = 2023; y <= 2028; y++) {
        for (let m = 0; m < 12; m++) {
          const w = calendarWindow(new Date(Date.UTC(y, m, 10, 12)), tz);
          const first = Date.UTC(y, m, 1);
          const gridStart = first - new Date(first).getUTCDay() * DAY;
          const last = Date.UTC(y, m + 1, 0);
          const gridEnd = last + (6 - new Date(last).getUTCDay()) * DAY;
          expect(gridStart - Date.parse(`${w.startDate}T00:00:00Z`)).toBeGreaterThanOrEqual(15 * DAY);
          expect(Date.parse(`${w.endDate}T00:00:00Z`) - gridEnd).toBeGreaterThanOrEqual(15 * DAY);
        }
      }
    }
    const feb = calendarWindow(new Date("2028-02-29T12:00:00Z"), "UTC");
    expect(feb.startDate).toBe("2027-12-24"); // grid starts Sun Jan 30, -37
    expect(feb.endDate).toBe("2028-04-10"); // grid ends Sat Mar 4, +37
  });

  it("uses DST-correct day bounds in America/New_York", () => {
    const w = calendarWindow(new Date("2026-03-15T12:00:00Z"), "America/New_York");
    // Mar 2026 grid = Sun Mar 1 .. Sat Apr 4; start Jan 23 (EST), end May 11 (EDT).
    expect(w.startDate).toBe("2026-01-23");
    expect(w.endDate).toBe("2026-05-11");
    expect(w.start.toISOString()).toBe("2026-01-23T05:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-05-12T03:59:59.999Z");
  });
});

describe("calendarWindow adjacent months", () => {
  it("contains the previous and next month's full grid for Jan 2024..Dec 2030", () => {
    for (const tz of ["Asia/Manila", "America/Los_Angeles"]) {
      for (let y = 2024; y <= 2030; y++) {
        for (let m = 0; m < 12; m++) {
          const w = calendarWindow(new Date(Date.UTC(y, m, 1, 12)), tz);
          const prev = visibleGridRange(new Date(y, m - 1, 15, 12), "month", tz);
          const next = visibleGridRange(new Date(y, m + 1, 15, 12), "month", tz);
          expect(isRangeInsideWindow(prev, w), `${tz} ${y}-${m + 1} prev`).toBe(true);
          expect(isRangeInsideWindow(next, w), `${tz} ${y}-${m + 1} next`).toBe(true);
        }
      }
    }
  });
});

describe("visibleGridRange", () => {
  it("month view spans the Sunday-aligned grid incl. spill-over days, tz day bounds", () => {
    const r = visibleGridRange(new Date(2026, 8, 15, 12), "month", "Asia/Manila");
    expect(r.start.toISOString()).toBe("2026-08-29T16:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-03T15:59:59.999Z");
  });

  it("week = Sun..Sat, day = the single day", () => {
    const w = visibleGridRange(new Date(2026, 8, 16, 9), "week", "UTC");
    expect([w.start.toISOString(), w.end.toISOString()]).toEqual(["2026-09-13T00:00:00.000Z", "2026-09-19T23:59:59.999Z"]);
    const d = visibleGridRange(new Date(2026, 8, 16, 9), "day", "UTC");
    expect([d.start.toISOString(), d.end.toISOString()]).toEqual(["2026-09-16T00:00:00.000Z", "2026-09-16T23:59:59.999Z"]);
  });
});
