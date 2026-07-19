import { describe, it, expect } from "vitest";
import { mapLemonSqueezySubscriptionStatus } from "./status";

describe("mapLemonSqueezySubscriptionStatus", () => {
  it("maps 'on_trial' to trialing", () => {
    expect(mapLemonSqueezySubscriptionStatus("on_trial")).toBe("trialing");
  });

  it("maps 'active' to active", () => {
    expect(mapLemonSqueezySubscriptionStatus("active")).toBe("active");
  });

  it("maps 'paused' to paused", () => {
    expect(mapLemonSqueezySubscriptionStatus("paused")).toBe("paused");
  });

  it("maps 'past_due' to past_due", () => {
    expect(mapLemonSqueezySubscriptionStatus("past_due")).toBe("past_due");
  });

  it("maps 'unpaid' to past_due", () => {
    expect(mapLemonSqueezySubscriptionStatus("unpaid")).toBe("past_due");
  });

  it("maps 'cancelled' to canceled", () => {
    expect(mapLemonSqueezySubscriptionStatus("cancelled")).toBe("canceled");
  });

  it("maps 'expired' to canceled", () => {
    expect(mapLemonSqueezySubscriptionStatus("expired")).toBe("canceled");
  });

  it("maps an unknown value to null", () => {
    expect(mapLemonSqueezySubscriptionStatus("unknown_future_status")).toBeNull();
  });

  it("maps an empty string to null", () => {
    expect(mapLemonSqueezySubscriptionStatus("")).toBeNull();
  });

  it("maps null to null", () => {
    expect(mapLemonSqueezySubscriptionStatus(null)).toBeNull();
  });

  it("maps undefined to null", () => {
    expect(mapLemonSqueezySubscriptionStatus(undefined)).toBeNull();
  });
});
