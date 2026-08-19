import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : arg?.namespace;
    return (key: string) => `${namespace}:${key}`;
  }),
}));

const displayPricing = {
  value: { currency: "PHP", monthly: 250, yearly: 2500 } as Record<string, unknown>,
};
vi.mock("@/lib/pricing/localPricing", () => ({
  getDisplayPricing: async () => displayPricing.value,
}));

import PricingPage from "./page";

describe("Pricing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    displayPricing.value = { currency: "PHP", monthly: 250, yearly: 2500 };
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

  it("shows the local-currency estimate next to the billed price", async () => {
    displayPricing.value = {
      currency: "PHP",
      monthly: 250,
      yearly: 2500,
      local: { currency: "USD", monthly: 4.3, yearly: 43 },
    };

    const page = await PricingPage({ params: Promise.resolve({ locale: "en" }) });
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {page}
      </NextIntlClientProvider>
    );

    expect(screen.getByText(/≈ \$4\.30 · billed in PHP/)).toBeInTheDocument();
  });

  it("shows a local-currency estimate for the yearly price too", async () => {
    displayPricing.value = {
      currency: "PHP",
      monthly: 250,
      yearly: 2500,
      local: { currency: "USD", monthly: 4.3, yearly: 43 },
    };

    const page = await PricingPage({ params: Promise.resolve({ locale: "en" }) });
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {page}
      </NextIntlClientProvider>
    );

    expect(screen.getByText(/≈ \$43\.00 · billed in PHP/)).toBeInTheDocument();
  });
});
