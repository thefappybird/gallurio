import { describe, expect, it } from "vitest";
import { planEntitlements, PLAN_ENTITLEMENTS } from "./entitlements";

describe("planEntitlements", () => {
  it("returns correct entitlements for free plan", () => {
    expect(planEntitlements("free")).toEqual({
      maxTeams: 1,
      maxMembersPerTeam: 10,
    });
  });

  it("returns correct entitlements for pro plan", () => {
    expect(planEntitlements("pro")).toEqual({
      maxTeams: 15,
      maxMembersPerTeam: 10,
    });
  });

  it("returns the same entitlements for beta as pro (unlimited-Pro grant tier)", () => {
    expect(planEntitlements("beta")).toEqual(planEntitlements("pro"));
  });

  it("returns the same object reference between calls (pulls from constant)", () => {
    expect(planEntitlements("free")).toBe(PLAN_ENTITLEMENTS.free);
    expect(planEntitlements("pro")).toBe(PLAN_ENTITLEMENTS.pro);
  });
});
