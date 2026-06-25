import { describe, it, expect } from "vitest";
import { areAllSessionsPast } from "./session-past";

describe("areAllSessionsPast", () => {
  it("returns true when all sessions ended before now", () => {
    const sessions = [{ startDate: "2020-01-01", endTime: "10:00" }];
    expect(areAllSessionsPast(sessions, "UTC", new Date("2026-01-01"))).toBe(true);
  });
});
