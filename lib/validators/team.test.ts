import { describe, expect, it } from "vitest";
import { createTeamSchema, setTeamColorSchema } from "./team";
import { TEAM_COLOR_PALETTE } from "@/lib/db/models/team";

describe("team color validation", () => {
  it("accepts every curated preset", () => {
    for (const hex of TEAM_COLOR_PALETTE) {
      expect(createTeamSchema.safeParse({ name: "Crew", color: hex }).success).toBe(true);
    }
  });

  it("accepts an arbitrary valid 6-digit hex (spectrum picker)", () => {
    const parsed = createTeamSchema.parse({ name: "Crew", color: "#1A2B3C" });
    // normalized to lowercase so stored values compare cleanly against presets
    expect(parsed.color).toBe("#1a2b3c");
  });

  it("normalizes color casing and trims whitespace", () => {
    const parsed = setTeamColorSchema.parse({ teamId: "t1", color: "  #ABCDEF  " });
    expect(parsed.color).toBe("#abcdef");
  });

  it.each([
    ["missing hash", "1a2b3c"],
    ["3-digit shorthand", "#abc"],
    ["8-digit rgba", "#1a2b3c4d"],
    ["non-hex chars", "#gghhii"],
    ["named color", "rebeccapurple"],
    ["empty", ""],
  ])("rejects %s", (_label, color) => {
    expect(createTeamSchema.safeParse({ name: "Crew", color }).success).toBe(false);
    expect(setTeamColorSchema.safeParse({ teamId: "t1", color }).success).toBe(false);
  });

  it("still enforces team name bounds alongside the relaxed color", () => {
    expect(createTeamSchema.safeParse({ name: "", color: "#123456" }).success).toBe(false);
    expect(
      createTeamSchema.safeParse({ name: "x".repeat(41), color: "#123456" }).success,
    ).toBe(false);
  });
});
