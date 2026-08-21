import { describe, it, expect } from "vitest";
import { headlinePrice } from "./displayPrice";

describe("headlinePrice", () => {
  it("headlines the visitor's own currency and names the billed amount", () => {
    const pricing = {
      currency: "PHP",
      monthly: 250,
      yearly: 2500,
      local: { currency: "USD", monthly: 4.3, yearly: 43 },
    };

    expect(headlinePrice(pricing, "monthly")).toEqual({
      amount: 4.3,
      currency: "USD",
      billed: { amount: 250, currency: "PHP" },
    });
  });
});
