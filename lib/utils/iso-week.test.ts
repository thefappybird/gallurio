import { describe, expect, it } from "vitest";
import { addDaysStr, weekStartMonday, isoWeekOf, isoWeekStartDate } from "./iso-week";

describe("addDaysStr", () => {
  it("adds days across a month boundary", () => {
    expect(addDaysStr("2026-06-30", 1)).toBe("2026-07-01");
  });
});

describe("weekStartMonday", () => {
  it("resolves the Monday of the week containing a mid-week date", () => {
    expect(weekStartMonday("2026-06-17")).toBe("2026-06-15"); // Wed -> Mon
  });
});

describe("isoWeekOf", () => {
  it("resolves a mid-year Monday to its ISO week", () => {
    expect(isoWeekOf("2026-06-15")).toEqual({ isoYear: 2026, isoWeek: 25 });
  });

  it("resolves an early-January date to the previous ISO year's last week", () => {
    // 2027-01-01 is a Friday; its Thursday falls in 2026 -> ISO week 53 of 2026.
    expect(isoWeekOf("2027-01-01")).toEqual({ isoYear: 2026, isoWeek: 53 });
  });

  it("resolves a late-December date to next year's week 1", () => {
    // 2025-12-29 is a Monday; its Thursday (Jan 1, 2026) -> ISO week 1 of 2026.
    expect(isoWeekOf("2025-12-29")).toEqual({ isoYear: 2026, isoWeek: 1 });
  });
});

describe("isoWeekStartDate", () => {
  it("resolves the Monday of a mid-year ISO week", () => {
    expect(isoWeekStartDate(2026, 25)).toBe("2026-06-15");
  });

  it("round-trips through isoWeekOf for sampled (year, week) pairs, including a 53-week year", () => {
    const samples: [number, number][] = [
      [2026, 25],
      [2026, 1],
      [2026, 53],
      [2025, 1],
    ];
    for (const [isoYear, isoWeek] of samples) {
      const monday = isoWeekStartDate(isoYear, isoWeek);
      expect(isoWeekOf(monday)).toEqual({ isoYear, isoWeek });
    }
  });
});
