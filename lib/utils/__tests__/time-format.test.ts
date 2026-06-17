import { describe, it, expect } from "vitest";
import { formatTimeRange } from "../time-format";
import { formatSessionTimeRange } from "@/lib/inquiries/session-time";

/**
 * Parity contract: formatTimeRange and formatSessionTimeRange must produce
 * byte-identical output for the same wall-clock time (#14).
 *
 * Strategy: express wall-clock times as UTC Date objects, then call
 * formatTimeRange(..., "UTC") so it reads the UTC hours/minutes as wall clock —
 * matching exactly what formatSessionTimeRange does with stored HH:MM strings.
 */
function makeUTCDate(hh: number, mm: number): Date {
  const d = new Date(0);
  d.setUTCHours(hh, mm, 0, 0);
  return d;
}

describe("formatTimeRange / formatSessionTimeRange parity", () => {
  it("24h AM range: both produce identical output", () => {
    const start = makeUTCDate(9, 30);
    const end = makeUTCDate(11, 0);
    const session = { startDate: "2026-07-01", startTime: "09:30", endTime: "11:00" };
    expect(formatTimeRange(start, end, "24h", "UTC")).toBe(
      formatSessionTimeRange(session, "24h", "UTC")
    );
  });

  it("12h AM range: both produce identical output", () => {
    const start = makeUTCDate(9, 30);
    const end = makeUTCDate(11, 0);
    const session = { startDate: "2026-07-01", startTime: "09:30", endTime: "11:00" };
    expect(formatTimeRange(start, end, "12h", "UTC")).toBe(
      formatSessionTimeRange(session, "12h", "UTC")
    );
  });

  it("24h PM range: both produce identical output", () => {
    const start = makeUTCDate(14, 5);
    const end = makeUTCDate(15, 0);
    const session = { startDate: "2026-07-01", startTime: "14:05", endTime: "15:00" };
    expect(formatTimeRange(start, end, "24h", "UTC")).toBe(
      formatSessionTimeRange(session, "24h", "UTC")
    );
  });

  it("12h PM range: both produce identical output", () => {
    const start = makeUTCDate(14, 5);
    const end = makeUTCDate(15, 0);
    const session = { startDate: "2026-07-01", startTime: "14:05", endTime: "15:00" };
    expect(formatTimeRange(start, end, "12h", "UTC")).toBe(
      formatSessionTimeRange(session, "12h", "UTC")
    );
  });

  it("en-dash separator U+2013 is preserved (not hyphen-minus) in 24h output", () => {
    // U+2013 is en-dash "–"; U+002D is hyphen-minus "-" — must be the former.
    const result = formatTimeRange(makeUTCDate(9, 0), makeUTCDate(10, 0), "24h", "UTC");
    expect(result.includes("–")).toBe(true);
    expect(result.includes("-")).toBe(false);
  });
});
