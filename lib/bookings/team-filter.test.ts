import { describe, expect, it } from "vitest";
import { resolveRequestedTeamIds } from "./team-filter";

describe("resolveRequestedTeamIds", () => {
  it("falls back to the caller's scope, and intersects an explicit request with it", () => {
    // No explicit request → use the caller's full scope unchanged.
    expect(resolveRequestedTeamIds(null, undefined)).toBeUndefined();
    expect(resolveRequestedTeamIds("", ["a", "b"])).toEqual(["a", "b"]);

    // Owner (undefined scope) may request any team(s).
    expect(resolveRequestedTeamIds("a,b", undefined)).toEqual(["a", "b"]);

    // Staff request is intersected with their scope (fail-closed).
    expect(resolveRequestedTeamIds("a,c", ["a", "b"])).toEqual(["a"]);
    expect(resolveRequestedTeamIds("c", ["a", "b"])).toEqual([]);
  });
});
