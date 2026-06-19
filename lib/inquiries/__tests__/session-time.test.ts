import { describe, it, expect } from "vitest";
import { formatSessionTimeRange } from "../session-time";

describe("formatSessionTimeRange", () => {
  it("formats wall-clock session times consistently in 24h", () => {
    const s = { startDate: "2026-07-01", startTime: "09:30", endTime: "11:00" };
    expect(formatSessionTimeRange(s, "24h", "Asia/Manila")).toBe("09:30 – 11:00");
  });
  it("formats in 12h with am/pm", () => {
    const s = { startDate: "2026-07-01", startTime: "14:05", endTime: "15:00" };
    expect(formatSessionTimeRange(s, "12h", "Asia/Manila")).toMatch(/2:05/);
  });
});
