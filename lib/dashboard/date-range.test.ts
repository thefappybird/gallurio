import { describe, expect, it } from "vitest";
import { parseDashboardRange } from "./date-range";

// Asia/Manila is UTC+8 with no DST, so a local-day boundary is a clean -8h shift.
const TZ = "Asia/Manila";

describe("parseDashboardRange", () => {
  it("resolves the three modes against the workspace timezone", () => {
    // between: from = local start-of-day, to = local end-of-day, as UTC instants.
    const between = parseDashboardRange(
      { dmode: "between", from: "2026-06-01", to: "2026-06-30" },
      TZ
    );
    expect(between.mode).toBe("between");
    expect(between.from?.toISOString()).toBe("2026-05-31T16:00:00.000Z");
    expect(between.to?.toISOString()).toBe("2026-06-30T15:59:59.999Z");

    // until: only the upper bound is meaningful.
    const until = parseDashboardRange({ dmode: "until", to: "2026-06-30" }, TZ);
    expect(until.mode).toBe("until");
    expect(until.from).toBeNull();
    expect(until.to?.toISOString()).toBe("2026-06-30T15:59:59.999Z");

    // since: only the lower bound is meaningful.
    const since = parseDashboardRange({ dmode: "since", from: "2026-06-01" }, TZ);
    expect(since.mode).toBe("since");
    expect(since.from?.toISOString()).toBe("2026-05-31T16:00:00.000Z");
    expect(since.to).toBeNull();

    // no mode / garbage → all-time, no bounds.
    expect(parseDashboardRange({}, TZ)).toEqual({ from: null, to: null, mode: null });
    expect(
      parseDashboardRange({ dmode: "between", from: "not-a-date", to: "2026-06-30" }, TZ).from
    ).toBeNull();
  });
});
