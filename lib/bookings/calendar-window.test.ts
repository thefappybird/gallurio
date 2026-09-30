import { describe, expect, it } from "vitest";
import { calendarWindow, isRangeInsideWindow } from "./calendar-window";

describe("isRangeInsideWindow", () => {
  it("accepts contained ranges and rejects ones poking out either side", () => {
    const w = calendarWindow(new Date("2026-09-15T04:00:00Z"), "Asia/Manila");
    expect(isRangeInsideWindow({ start: w.start, end: w.end }, w)).toBe(true);
    expect(isRangeInsideWindow({ start: new Date(w.start.getTime() - 1), end: w.end }, w)).toBe(false);
    expect(isRangeInsideWindow({ start: w.start, end: new Date(w.end.getTime() + 1) }, w)).toBe(false);
  });
});

describe("calendarWindow", () => {
  it("pads the Sunday-aligned month grid by 31 days, day bounds in Manila", () => {
    const w = calendarWindow(new Date("2026-09-15T04:00:00Z"), "Asia/Manila");
    // Sep 2026 grid = Sun Aug 30 .. Sat Oct 3; +/-31d.
    expect(w.startDate).toBe("2026-07-30");
    expect(w.endDate).toBe("2026-11-03");
    expect(w.start.toISOString()).toBe("2026-07-29T16:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-11-03T15:59:59.999Z");
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
    expect(feb.startDate).toBe("2027-12-30"); // grid starts Sun Jan 30, -31
    expect(feb.endDate).toBe("2028-04-04"); // grid ends Sat Mar 4, +31
  });

  it("uses DST-correct day bounds in America/New_York", () => {
    const w = calendarWindow(new Date("2026-03-15T12:00:00Z"), "America/New_York");
    // Mar 2026 grid = Sun Mar 1 .. Sat Apr 4; start Jan 29 (EST), end May 5 (EDT).
    expect(w.startDate).toBe("2026-01-29");
    expect(w.endDate).toBe("2026-05-05");
    expect(w.start.toISOString()).toBe("2026-01-29T05:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-05-06T03:59:59.999Z");
  });
});
