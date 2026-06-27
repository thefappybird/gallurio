import { describe, expect, it } from "vitest";
import { parseDashboardRange } from "./date-range";

// Asia/Manila is UTC+8 with no DST, so a local-day boundary is a clean -8h shift.
const TZ = "Asia/Manila";

describe("parseDashboardRange", () => {
  it("resolves day mode to a single local day", () => {
    const day = parseDashboardRange({ df: "day", d: "2026-06-15" }, TZ);
    expect(day.mode).toBe("day");
    expect(day.from?.toISOString()).toBe("2026-06-14T16:00:00.000Z");
    expect(day.to?.toISOString()).toBe("2026-06-15T15:59:59.999Z");
  });

  it("resolves month mode to the full local month", () => {
    const month = parseDashboardRange({ df: "month", m: "2026-06" }, TZ);
    expect(month.mode).toBe("month");
    expect(month.from?.toISOString()).toBe("2026-05-31T16:00:00.000Z");
    expect(month.to?.toISOString()).toBe("2026-06-30T15:59:59.999Z");
  });

  it("resolves year mode to the full local year", () => {
    const year = parseDashboardRange({ df: "year", y: "2026" }, TZ);
    expect(year.mode).toBe("year");
    expect(year.from?.toISOString()).toBe("2025-12-31T16:00:00.000Z");
    expect(year.to?.toISOString()).toBe("2026-12-31T15:59:59.999Z");
  });

  it("resolves custom mode to explicit from/to local days", () => {
    const custom = parseDashboardRange(
      { df: "custom", from: "2026-06-01", to: "2026-06-30" },
      TZ
    );
    expect(custom.mode).toBe("custom");
    expect(custom.from?.toISOString()).toBe("2026-05-31T16:00:00.000Z");
    expect(custom.to?.toISOString()).toBe("2026-06-30T15:59:59.999Z");
  });

  it("treats an explicit all-time filter as unbounded", () => {
    const all = parseDashboardRange({ df: "all" }, TZ);
    expect(all.mode).toBe("all");
    expect(all.from).toBeNull();
    expect(all.to).toBeNull();
  });

  it("defaults to the current month when no filter is given", () => {
    const now = new Date("2026-06-15T10:00:00Z"); // 18:00 Jun 15 in Manila
    const def = parseDashboardRange({}, TZ, now);
    expect(def.mode).toBe("month");
    expect(def.from?.toISOString()).toBe("2026-05-31T16:00:00.000Z");
    expect(def.to?.toISOString()).toBe("2026-06-30T15:59:59.999Z");
  });
});
