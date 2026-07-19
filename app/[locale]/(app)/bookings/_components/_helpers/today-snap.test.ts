import { describe, it, expect } from "vitest";
import {
  todayIso,
  isToday,
  nextHalfHourFromNow,
  applyTodaySnap,
} from "./today-snap";

function makeDate(h: number, m: number, dateStr?: string): Date {
  const base = dateStr ?? "2026-05-25";
  return new Date(`${base}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
}

describe("todayIso", () => {
  it("returns YYYY-MM-DD in local time", () => {
    const d = new Date("2026-05-25T10:00:00");
    expect(todayIso(d)).toBe("2026-05-25");
  });
});

describe("isToday", () => {
  it("returns true when the date matches today", () => {
    const d = new Date("2026-05-25T10:00:00");
    expect(isToday("2026-05-25", d)).toBe(true);
  });

  it("returns false for a different date", () => {
    const d = new Date("2026-05-25T10:00:00");
    expect(isToday("2026-05-26", d)).toBe(false);
  });
});

describe("nextHalfHourFromNow", () => {
  it("11:27 → 11:30 same day", () => {
    const result = nextHalfHourFromNow(makeDate(11, 27));
    expect(result.startTime).toBe("11:30");
    expect(result.startDate).toBe("2026-05-25");
  });

  it("11:30 → 12:00 same day (strictly after, not at)", () => {
    const result = nextHalfHourFromNow(makeDate(11, 30));
    expect(result.startTime).toBe("12:00");
    expect(result.startDate).toBe("2026-05-25");
  });

  it("11:31 → 12:00 same day", () => {
    const result = nextHalfHourFromNow(makeDate(11, 31));
    expect(result.startTime).toBe("12:00");
    expect(result.startDate).toBe("2026-05-25");
  });

  it("11:00 → 11:30 same day", () => {
    const result = nextHalfHourFromNow(makeDate(11, 0));
    expect(result.startTime).toBe("11:30");
    expect(result.startDate).toBe("2026-05-25");
  });

  it("23:45 → 00:00 tomorrow", () => {
    const result = nextHalfHourFromNow(makeDate(23, 45));
    expect(result.startTime).toBe("00:00");
    expect(result.startDate).toBe("2026-05-26");
  });

  it("23:59 → 00:00 tomorrow", () => {
    const result = nextHalfHourFromNow(makeDate(23, 59));
    expect(result.startTime).toBe("00:00");
    expect(result.startDate).toBe("2026-05-26");
  });

  it("23:30 → 00:00 tomorrow (exactly at :30 boundary)", () => {
    const result = nextHalfHourFromNow(makeDate(23, 30));
    expect(result.startTime).toBe("00:00");
    expect(result.startDate).toBe("2026-05-26");
  });

  it("00:00 → 00:30 same day", () => {
    const result = nextHalfHourFromNow(makeDate(0, 0));
    expect(result.startTime).toBe("00:30");
    expect(result.startDate).toBe("2026-05-25");
  });
});

describe("applyTodaySnap", () => {
  it("same-day duration preserved: 10:00-17:00 with now=14:27 → 14:30-21:30 same day", () => {
    const result = applyTodaySnap({
      prevStartDate: "2026-05-25",
      prevStartTime: "10:00",
      prevEndDate: "",
      prevEndTime: "17:00",
      now: makeDate(14, 27),
    });
    expect(result.startDate).toBe("2026-05-25");
    expect(result.startTime).toBe("14:30");
    expect(result.endDate).toBe("2026-05-25");
    expect(result.endTime).toBe("21:30");
  });

  it("cross-midnight snap advances both start and end dates", () => {
    // now=23:45, prev 10:00-17:00, snap → tomorrow 00:00-07:00
    const result = applyTodaySnap({
      prevStartDate: "2026-05-25",
      prevStartTime: "10:00",
      prevEndDate: "",
      prevEndTime: "17:00",
      now: makeDate(23, 45),
    });
    expect(result.startDate).toBe("2026-05-26");
    expect(result.startTime).toBe("00:00");
    expect(result.endDate).toBe("2026-05-26");
    expect(result.endTime).toBe("07:00");
  });

  it("multi-day session keeps same calendar-day diff", () => {
    // prev: 2026-05-20 10:00 → 2026-05-22 17:00 (2-day span), snap at 11:27 today
    const result = applyTodaySnap({
      prevStartDate: "2026-05-20",
      prevStartTime: "10:00",
      prevEndDate: "2026-05-22",
      prevEndTime: "17:00",
      now: makeDate(11, 27),
    });
    // Duration = 2 days + 7 hours = 55 hours
    // Start snaps to 11:30 on 2026-05-25, end = 11:30 + 55h = 18:30 on 2026-05-27
    expect(result.startDate).toBe("2026-05-25");
    expect(result.startTime).toBe("11:30");
    expect(result.endDate).toBe("2026-05-27");
    expect(result.endTime).toBe("18:30");
  });

  it("no valid prev end (prevEndTime empty, prevEndDate same day) falls back to 7-hour default", () => {
    // prevEndDate resolves to prevStartDate, prevEndTime resolves to 00:00 which is BEFORE
    // prevStartTime 10:00 → negative duration → 7-hour fallback.
    const result = applyTodaySnap({
      prevStartDate: "2026-05-25",
      prevStartTime: "10:00",
      prevEndDate: "",
      prevEndTime: "",
      now: makeDate(10, 0),
    });
    expect(result.startTime).toBe("10:30");
    expect(result.endTime).toBe("17:30"); // 10:30 + 7h
    expect(result.endDate).toBe(result.startDate);
  });

  // Regression: first date pick where prevStartDate === "" (new session, no prior value).
  // Should fall back to 7-hour default duration instead of zero/invalid duration.
  it("empty prevStartDate (first pick, now=14:27) → today 14:30–21:30", () => {
    const result = applyTodaySnap({
      prevStartDate: "",
      prevStartTime: "",
      prevEndDate: "",
      prevEndTime: "",
      now: makeDate(14, 27),
    });
    expect(result.startDate).toBe("2026-05-25");
    expect(result.startTime).toBe("14:30");
    expect(result.endDate).toBe("2026-05-25");
    expect(result.endTime).toBe("21:30");
  });

  it("empty prevStartDate (first pick, now=23:45) → tomorrow 00:00–07:00", () => {
    const result = applyTodaySnap({
      prevStartDate: "",
      prevStartTime: "",
      prevEndDate: "",
      prevEndTime: "",
      now: makeDate(23, 45),
    });
    expect(result.startDate).toBe("2026-05-26");
    expect(result.startTime).toBe("00:00");
    expect(result.endDate).toBe("2026-05-26");
    expect(result.endTime).toBe("07:00");
  });
});
