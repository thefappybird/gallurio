import { describe, it, expect } from "vitest";
import { pendingGrantUpdate } from "./pendingPromoGrant";

describe("pendingGrantUpdate", () => {
  it("returns null when pending is null/undefined", () => {
    expect(pendingGrantUpdate(null, new Date())).toBeNull();
    expect(pendingGrantUpdate(undefined, new Date())).toBeNull();
  });

  it("returns null when queuedAt is missing", () => {
    expect(pendingGrantUpdate({ grantMonths: 2, queuedAt: null }, new Date())).toBeNull();
  });

  it("returns null when grantMonths is missing", () => {
    expect(pendingGrantUpdate({ grantMonths: null, queuedAt: new Date() }, new Date())).toBeNull();
  });

  it("computes expiresAt as now + grantMonths and clears every ls*/pending field", () => {
    const now = new Date("2026-07-14T00:00:00Z");
    const update = pendingGrantUpdate(
      { grantMonths: 2, queuedAt: new Date("2026-07-01T00:00:00Z") },
      now
    );

    expect(update).not.toBeNull();
    expect(update!.plan).toBe("pro");
    expect((update!.planGrantExpiresAt as Date).toISOString()).toBe(
      new Date("2026-09-14T00:00:00Z").toISOString()
    );
    expect(update).toMatchObject({
      lsSubscriptionStatus: null,
      lsSubscriptionId: null,
      lsCustomerId: null,
      lsCurrentPeriodEnd: null,
      "pendingPromoGrant.grantMonths": null,
      "pendingPromoGrant.queuedAt": null,
    });
  });

  it("does not mutate the `now` argument", () => {
    const now = new Date("2026-07-14T00:00:00Z");
    const before = now.getTime();
    pendingGrantUpdate({ grantMonths: 2, queuedAt: new Date() }, now);
    expect(now.getTime()).toBe(before);
  });
});
