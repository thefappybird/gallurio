import { describe, it, expect } from "vitest";
import { isWorkspaceGated, isEntitled } from "./access";

describe("isEntitled", () => {
  it("is entitled with an active Lemon Squeezy subscription", () => {
    expect(
      isEntitled({
        plan: "pro",
        everSubscribed: true,
        lsSubscriptionId: "sub_1",
        lsSubscriptionStatus: "active",
        lsCurrentPeriodEnd: null,
        planGrantExpiresAt: null,
      })
    ).toBe(true);
  });

  it("is entitled on trialing/past_due/paused (trust LS dunning)", () => {
    for (const status of ["trialing", "past_due", "paused"]) {
      expect(
        isEntitled({
          plan: "pro",
          everSubscribed: true,
          lsSubscriptionId: "sub_1",
          lsSubscriptionStatus: status,
          lsCurrentPeriodEnd: null,
          planGrantExpiresAt: null,
        })
      ).toBe(true);
    }
  });

  it("is entitled when canceled but the paid period hasn't ended yet", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(
      isEntitled({
        plan: "pro",
        everSubscribed: true,
        lsSubscriptionId: "sub_1",
        lsSubscriptionStatus: "canceled",
        lsCurrentPeriodEnd: future,
        planGrantExpiresAt: null,
      })
    ).toBe(true);
  });

  it("is not entitled when canceled and the paid period already ended", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(
      isEntitled({
        plan: "free",
        everSubscribed: true,
        lsSubscriptionId: "sub_1",
        lsSubscriptionStatus: "canceled",
        lsCurrentPeriodEnd: past,
        planGrantExpiresAt: null,
      })
    ).toBe(false);
  });

  it("is entitled with an unexpired plan grant (free month / promo / time-limited beta)", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(
      isEntitled({
        plan: "pro",
        everSubscribed: false,
        lsSubscriptionId: null,
        lsSubscriptionStatus: null,
        lsCurrentPeriodEnd: null,
        planGrantExpiresAt: future,
      })
    ).toBe(true);
  });

  it("is not entitled with an expired plan grant", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(
      isEntitled({
        plan: "free",
        everSubscribed: false,
        lsSubscriptionId: null,
        lsSubscriptionStatus: null,
        lsCurrentPeriodEnd: null,
        planGrantExpiresAt: past,
      })
    ).toBe(false);
  });

  it("is entitled on a perpetual beta grant (plan beta, no expiry)", () => {
    expect(
      isEntitled({
        plan: "beta",
        everSubscribed: false,
        lsSubscriptionId: null,
        lsSubscriptionStatus: null,
        lsCurrentPeriodEnd: null,
        planGrantExpiresAt: null,
      })
    ).toBe(true);
  });

  it("is not entitled on plain free plan with no grant and no subscription", () => {
    expect(
      isEntitled({
        plan: "free",
        everSubscribed: false,
        lsSubscriptionId: null,
        lsSubscriptionStatus: null,
        lsCurrentPeriodEnd: null,
        planGrantExpiresAt: null,
      })
    ).toBe(false);
  });
});

describe("isWorkspaceGated", () => {
  it("is gated on plain free plan with no grant and no subscription (no permanent free tier)", () => {
    expect(
      isWorkspaceGated({
        plan: "free",
        everSubscribed: false,
        lsSubscriptionId: null,
        lsSubscriptionStatus: null,
        lsCurrentPeriodEnd: null,
        planGrantExpiresAt: null,
      })
    ).toBe(true);
  });

  it("is not gated (isWorkspaceGated is the exact negation of isEntitled)", () => {
    const entitledWs = {
      plan: "pro",
      everSubscribed: true,
      lsSubscriptionId: "sub_1",
      lsSubscriptionStatus: "active",
      lsCurrentPeriodEnd: null,
      planGrantExpiresAt: null,
    };
    expect(isWorkspaceGated(entitledWs)).toBe(!isEntitled(entitledWs));
    expect(isWorkspaceGated(entitledWs)).toBe(false);
  });
});
