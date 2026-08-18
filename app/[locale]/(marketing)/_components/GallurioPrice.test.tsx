import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const displayPricing = {
  value: { currency: "PHP", monthly: 250, yearly: 2500 } as Record<string, unknown>,
};
vi.mock("@/lib/pricing/localPricing", () => ({
  getDisplayPricing: async () => displayPricing.value,
}));

import { GallurioPrice } from "./GallurioPrice";

describe("GallurioPrice", () => {
  beforeEach(() => {
    displayPricing.value = { currency: "PHP", monthly: 250, yearly: 2500 };
  });

  it("renders only the monthly figure when period is monthly", async () => {
    const el = await GallurioPrice({ period: "monthly" });
    render(el);

    expect(screen.getByText("₱250/mo")).toBeInTheDocument();
  });

  it("renders only the yearly figure when period is yearly", async () => {
    const el = await GallurioPrice({ period: "yearly" });
    render(el);

    expect(screen.getByText("₱2,500/yr")).toBeInTheDocument();
  });
});
