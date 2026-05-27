import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIME_MODE,
  DEFAULT_TIME_INPUT_LANG,
  formatTime,
  formatTimeRange,
  TIME_INPUT_LANG,
} from "./time-format";

describe("DEFAULT_TIME_MODE", () => {
  it("is '24h'", () => {
    expect(DEFAULT_TIME_MODE).toBe("24h");
  });
});

describe("DEFAULT_TIME_INPUT_LANG", () => {
  it("is 'en-GB' when DEFAULT_TIME_MODE is 24h", () => {
    expect(DEFAULT_TIME_INPUT_LANG).toBe(TIME_INPUT_LANG[DEFAULT_TIME_MODE]);
    expect(DEFAULT_TIME_INPUT_LANG).toBe("en-GB");
  });
});

describe("formatTime", () => {
  it("defaults to 24h mode and produces HH:MM output", () => {
    // Use local-time constructor so the formatter (which uses local TZ) is predictable.
    const date = new Date(2026, 7, 15, 9, 5, 0);
    const result = formatTime(date, "24h");
    // en-GB 24h: "09:05"
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it("pads single-digit hours with a leading zero in 24h mode", () => {
    const date = new Date(2026, 7, 15, 8, 3, 0);
    const result = formatTime(date, "24h");
    expect(result).toMatch(/^0\d:\d{2}$/);
  });

  it("produces 12h output when mode is '12h'", () => {
    const date = new Date(2026, 7, 15, 14, 30, 0);
    const result = formatTime(date, "12h");
    // en-US 12h: "2:30 PM" or similar
    expect(result).toMatch(/AM|PM/i);
  });

  it("uses DEFAULT_TIME_MODE when mode argument is omitted", () => {
    const date = new Date(2026, 7, 15, 13, 0, 0);
    const explicit = formatTime(date, DEFAULT_TIME_MODE);
    const implicit = formatTime(date);
    expect(implicit).toBe(explicit);
  });

  it("handles midnight (00:00) in 24h mode", () => {
    const date = new Date(2026, 7, 15, 0, 0, 0);
    const result = formatTime(date, "24h");
    expect(result).toMatch(/^0\d:\d{2}$/);
  });

  it("handles 23:59 in 24h mode", () => {
    const date = new Date(2026, 7, 15, 23, 59, 0);
    const result = formatTime(date, "24h");
    expect(result).toMatch(/^\d{2}:\d{2}$/);
    expect(result).toContain("23");
    expect(result).toContain("59");
  });
});

describe("formatTimeRange", () => {
  it("returns 'HH:MM – HH:MM' in 24h mode", () => {
    const start = new Date(2026, 7, 15, 9, 0, 0);
    const end = new Date(2026, 7, 15, 17, 30, 0);
    const result = formatTimeRange(start, end, "24h");
    // Must contain en-dash (U+2013), not a hyphen-minus
    expect(result).toContain("–");
    const [startPart, endPart] = result.split(" – ");
    expect(startPart).toMatch(/^\d{2}:\d{2}$/);
    expect(endPart).toMatch(/^\d{2}:\d{2}$/);
  });

  it("returns 'h:MM AM – h:MM PM' in 12h mode", () => {
    const start = new Date(2026, 7, 15, 9, 0, 0);
    const end = new Date(2026, 7, 15, 17, 30, 0);
    const result = formatTimeRange(start, end, "12h");
    expect(result).toContain("–");
    expect(result).toMatch(/AM|PM/i);
  });

  it("uses DEFAULT_TIME_MODE when mode argument is omitted", () => {
    const start = new Date(2026, 7, 15, 10, 0, 0);
    const end = new Date(2026, 7, 15, 12, 0, 0);
    const explicit = formatTimeRange(start, end, DEFAULT_TIME_MODE);
    const implicit = formatTimeRange(start, end);
    expect(implicit).toBe(explicit);
  });

  it("separator is an en-dash (U+2013), not a hyphen-minus", () => {
    const start = new Date(2026, 7, 15, 10, 0, 0);
    const end = new Date(2026, 7, 15, 12, 0, 0);
    const result = formatTimeRange(start, end);
    expect(result).toContain("–");
  });
});

describe("TIME_INPUT_LANG", () => {
  it("maps 24h to en-GB", () => {
    expect(TIME_INPUT_LANG["24h"]).toBe("en-GB");
  });

  it("maps 12h to en-US", () => {
    expect(TIME_INPUT_LANG["12h"]).toBe("en-US");
  });
});
