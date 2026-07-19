import { describe, expect, it } from "vitest";
import {
  dayBoundInTz,
  resolveWorkspaceTimezone,
  wallTimeInTzToUtc,
  localDayStart,
  FALLBACK_TZ,
} from "./timezone";

describe("localDayStart", () => {
  it("returns the UTC instant of the current local day's midnight", () => {
    // 2026-06-01 20:00 UTC is already 2026-06-02 04:00 in Manila (UTC+8),
    // so the local day is June 2 and its midnight is June 1 16:00 UTC.
    expect(
      localDayStart("Asia/Manila", new Date("2026-06-01T20:00:00Z")).toISOString()
    ).toBe("2026-06-01T16:00:00.000Z");
  });
});

describe("resolveWorkspaceTimezone", () => {
  it("uses the workspace timezone when set, else the platform fallback", () => {
    expect(resolveWorkspaceTimezone({ timezone: "Asia/Jakarta" })).toBe("Asia/Jakarta");
    expect(resolveWorkspaceTimezone({ timezone: null })).toBe(FALLBACK_TZ);
    expect(resolveWorkspaceTimezone({ timezone: "" })).toBe(FALLBACK_TZ);
    expect(resolveWorkspaceTimezone(null)).toBe(FALLBACK_TZ);
    expect(resolveWorkspaceTimezone(undefined)).toBe(FALLBACK_TZ);
  });
});

describe("dayBoundInTz", () => {
  it("Manila Jan 1 start of day → Dec 31 16:00:00.000 UTC (UTC-8 offset inverted)", () => {
    // Asia/Manila is UTC+8, so midnight Manila = UTC-8h = Dec 31 16:00 UTC.
    const result = dayBoundInTz("2026-01-01", "Asia/Manila", 0, 0, 0, 0);
    expect(result.toISOString()).toBe("2025-12-31T16:00:00.000Z");
  });

  it("Manila Jan 1 end of day → Jan 1 15:59:59.999 UTC (the Bug B fix proof)", () => {
    // 23:59:59.999 Manila = UTC - 8h = Jan 1 15:59:59.999 UTC.
    // The old implementation returned Jan 2 ~16:00 UTC (wrong day entirely).
    const result = dayBoundInTz("2026-01-01", "Asia/Manila", 23, 59, 59, 999);
    expect(result.toISOString()).toBe("2026-01-01T15:59:59.999Z");
  });

  it("LA Jan 1 start of day → Jan 1 08:00:00.000 UTC (PST = UTC-8)", () => {
    const result = dayBoundInTz("2026-01-01", "America/Los_Angeles", 0, 0, 0, 0);
    expect(result.toISOString()).toBe("2026-01-01T08:00:00.000Z");
  });

  it("LA Jan 1 end of day → Jan 2 07:59:59.999 UTC (PST = UTC-8)", () => {
    const result = dayBoundInTz("2026-01-01", "America/Los_Angeles", 23, 59, 59, 999);
    expect(result.toISOString()).toBe("2026-01-02T07:59:59.999Z");
  });

  it("UTC zone Jan 1 start of day trivially maps to Jan 1 00:00:00.000 UTC", () => {
    const result = dayBoundInTz("2026-01-01", "UTC", 0, 0, 0, 0);
    expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("UTC zone Jan 1 end of day trivially maps to Jan 1 23:59:59.999 UTC", () => {
    const result = dayBoundInTz("2026-01-01", "UTC", 23, 59, 59, 999);
    expect(result.toISOString()).toBe("2026-01-01T23:59:59.999Z");
  });

  it("LA DST spring-forward 2026-03-08: start of day is still PST (08:00 UTC)", () => {
    // On 2026-03-08, clocks spring forward at 02:00 PST → 03:00 PDT.
    // Midnight on that date is still in PST (UTC-8), so 00:00 local = 08:00 UTC.
    const result = dayBoundInTz("2026-03-08", "America/Los_Angeles", 0, 0, 0, 0);
    expect(result.toISOString()).toBe("2026-03-08T08:00:00.000Z");
  });

  it("LA DST spring-forward 2026-03-08: end of day is PDT (06:59:59.999 UTC next day)", () => {
    // After spring-forward PDT = UTC-7, so 23:59:59.999 PDT = Mar 9 06:59:59.999 UTC.
    const result = dayBoundInTz("2026-03-08", "America/Los_Angeles", 23, 59, 59, 999);
    expect(result.toISOString()).toBe("2026-03-09T06:59:59.999Z");
  });
});

describe("wallTimeInTzToUtc", () => {
  it("Manila 2026-01-01 09:00 → 2026-01-01 01:00 UTC", () => {
    expect(wallTimeInTzToUtc("2026-01-01", "09:00", "Asia/Manila")).toBe(
      "2026-01-01T01:00:00.000Z"
    );
  });

  it("LA 2026-01-01 09:00 → 2026-01-01 17:00 UTC (PST = UTC-8)", () => {
    expect(wallTimeInTzToUtc("2026-01-01", "09:00", "America/Los_Angeles")).toBe(
      "2026-01-01T17:00:00.000Z"
    );
  });

  it("UTC 2026-01-01 09:00 → 2026-01-01 09:00 UTC", () => {
    expect(wallTimeInTzToUtc("2026-01-01", "09:00", "UTC")).toBe(
      "2026-01-01T09:00:00.000Z"
    );
  });

  it("LA 2026-03-08 04:00 (after spring-forward) → 2026-03-08 11:00 UTC (PDT = UTC-7)", () => {
    // Spring-forward 2026-03-08: clocks jump from 02:00 PST to 03:00 PDT.
    // 04:00 PDT is unambiguously in PDT (UTC-7), so UTC = 04:00 + 7h = 11:00 UTC.
    expect(wallTimeInTzToUtc("2026-03-08", "04:00", "America/Los_Angeles")).toBe(
      "2026-03-08T11:00:00.000Z"
    );
  });

  it("returns empty string for empty date", () => {
    expect(wallTimeInTzToUtc("", "09:00", "UTC")).toBe("");
  });

  it("defaults to 00:00 when time is missing or malformed", () => {
    expect(wallTimeInTzToUtc("2026-01-01", "", "UTC")).toBe(
      "2026-01-01T00:00:00.000Z"
    );
    expect(wallTimeInTzToUtc("2026-01-01", "9:00", "UTC")).toBe(
      "2026-01-01T00:00:00.000Z"
    );
  });
});
