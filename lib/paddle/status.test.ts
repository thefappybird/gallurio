import { describe, it, expect } from "vitest";
import { mapPaddleSubscriptionStatus } from "./status";

describe("mapPaddleSubscriptionStatus", () => {
  it("maps 'active' to active", () => {
    expect(mapPaddleSubscriptionStatus("active")).toBe("active");
  });

  it("maps 'canceled' (one L) to canceled", () => {
    expect(mapPaddleSubscriptionStatus("canceled")).toBe("canceled");
  });

  it("maps 'cancelled' (two Ls) to canceled", () => {
    expect(mapPaddleSubscriptionStatus("cancelled")).toBe("canceled");
  });

  it("maps 'past_due' to past_due", () => {
    expect(mapPaddleSubscriptionStatus("past_due")).toBe("past_due");
  });

  it("maps 'paused' to paused", () => {
    expect(mapPaddleSubscriptionStatus("paused")).toBe("paused");
  });

  it("maps 'trialing' to trialing", () => {
    expect(mapPaddleSubscriptionStatus("trialing")).toBe("trialing");
  });

  it("maps an unknown value to null", () => {
    expect(mapPaddleSubscriptionStatus("unknown_future_status")).toBeNull();
  });

  it("maps an empty string to null", () => {
    expect(mapPaddleSubscriptionStatus("")).toBeNull();
  });

  it("maps null to null", () => {
    expect(mapPaddleSubscriptionStatus(null)).toBeNull();
  });

  it("maps undefined to null", () => {
    expect(mapPaddleSubscriptionStatus(undefined)).toBeNull();
  });
});
