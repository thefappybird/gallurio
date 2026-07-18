import { describe, expect, it } from "vitest";
import { hasActivatedOnboardingPlan } from "./planActivation";

describe("hasActivatedOnboardingPlan", () => {
  it("keeps the complimentary free path editable", () => {
    expect(
      hasActivatedOnboardingPlan({ plan: "pro", everSubscribed: false, codesRedeemed: [] })
    ).toBe(false);
  });

  it.each([
    { plan: "pro", everSubscribed: true, codesRedeemed: [] },
    { plan: "pro", everSubscribed: false, codesRedeemed: ["promo"] },
    { plan: "beta", everSubscribed: false, codesRedeemed: [] },
  ])("locks paid, promo, and beta activations", (workspace) => {
    expect(hasActivatedOnboardingPlan(workspace)).toBe(true);
  });
});
