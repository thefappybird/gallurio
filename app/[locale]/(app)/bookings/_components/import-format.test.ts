import { describe, it, expect } from "vitest";
import { formatImportInstant } from "./import-format";

const ISO = "2026-06-15T01:00:00.000Z";
const fmt = (source: string) => formatImportInstant(ISO, "en", "Asia/Manila", source);

describe("formatImportInstant has-time decision", () => {
  it.each(["Jun 15 2026 noon", "Jun 15 2026 midnight", "6/15/2026 9.30pm", "6/15/2026 9 a.m."])(
    "shows a time for %s",
    (source) => {
      expect(fmt(source)).toMatch(/\d{1,2}:\d{2}/);
    }
  );

  it("shows date only for a date-only cell", () => {
    expect(fmt("6/15/2026")).toBe("Jun 15, 2026");
  });
});
