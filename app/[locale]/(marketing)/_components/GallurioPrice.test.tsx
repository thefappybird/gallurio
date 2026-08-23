import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const displayPricing = {
  value: { currency: "USD", monthly: 5, yearly: 50 } as Record<string, unknown>,
};
vi.mock("@/lib/pricing/localPricing", () => ({
  getDisplayPricing: async () => displayPricing.value,
}));

import { GallurioPrice } from "./GallurioPrice";

describe("GallurioPrice", () => {
  beforeEach(() => {
    displayPricing.value = { currency: "USD", monthly: 5, yearly: 50 };
  });

  it("renders only the monthly figure when period is monthly", async () => {
    const el = await GallurioPrice({ period: "monthly" });
    render(el);

    expect(screen.getByText("$5.00/mo")).toBeInTheDocument();
  });

  it("renders only the yearly figure when period is yearly", async () => {
    const el = await GallurioPrice({ period: "yearly" });
    render(el);

    expect(screen.getByText("$50.00/yr")).toBeInTheDocument();
  });

  it("leads with the local estimate and names the billed price", async () => {
    displayPricing.value = {
      currency: "USD",
      monthly: 15,
      yearly: 150,
      local: { currency: "PHP", monthly: 850, yearly: 8500 },
    };

    const el = await GallurioPrice({ period: "monthly" });
    render(el);

    expect(screen.getByText("₱850/mo (billed as $15/mo)")).toBeInTheDocument();
  });
});
