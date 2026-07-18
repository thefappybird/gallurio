import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : arg?.namespace;
    return (key: string) => `${namespace}:${key}`;
  }),
}));

import PricingPage from "./page";

describe("Pricing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the pricing header headline for an unauthenticated visitor", async () => {
    const page = await PricingPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.getByText("marketing.pricing:header.headline")).toBeInTheDocument();
  });

  it("shows a Coming soon badge on the Pro card", async () => {
    const page = await PricingPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.getByText("marketing.pricing:pro.comingSoon")).toBeInTheDocument();
  });
});
