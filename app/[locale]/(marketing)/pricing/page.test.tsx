import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

function renderPage(page: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {page}
    </NextIntlClientProvider>
  );
}

describe("Pricing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    displayPricing.value = { currency: "PHP", monthly: 250, yearly: 2500 };
  });

  it("renders the pricing header headline for an unauthenticated visitor", async () => {
    const page = await PricingPage({ params: Promise.resolve({ locale: "en" }) });
    renderPage(page);

    expect(screen.getByText("marketing.pricing:header.headline")).toBeInTheDocument();
  });

  it("names the billed amount next to the billed price", async () => {
    displayPricing.value = {
      currency: "PHP",
      monthly: 250,
      yearly: 2500,
      local: { currency: "USD", monthly: 4.3, yearly: 43 },
    };

    const page = await PricingPage({ params: Promise.resolve({ locale: "en" }) });
    renderPage(page);

    expect(screen.getByText(/Billed as ₱250 PHP/)).toBeInTheDocument();
  });

  it("names the billed yearly amount after switching to Annual", async () => {
    displayPricing.value = {
      currency: "PHP",
      monthly: 250,
      yearly: 2500,
      local: { currency: "USD", monthly: 4.3, yearly: 43 },
    };

    const page = await PricingPage({ params: Promise.resolve({ locale: "en" }) });
    renderPage(page);

    fireEvent.click(screen.getByRole("button", { name: /yearly/i }));
    expect(screen.getByText(/Billed as ₱2,500 PHP/)).toBeInTheDocument();
  });

  it("does not render a Coming soon badge on the Pro card", async () => {
    const page = await PricingPage({ params: Promise.resolve({ locale: "en" }) });
    renderPage(page);

    expect(screen.queryByText("marketing.pricing:pro.comingSoon")).not.toBeInTheDocument();
  });

  it("selects the Beta tab by default when beta is enabled", async () => {
    process.env.BETA_TESTER_ENABLED = "true";
    const page = await PricingPage({ params: Promise.resolve({ locale: "en" }) });
    renderPage(page);

    expect(screen.getByRole("button", { name: /^beta$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Join the beta" });
    expect(cta).toHaveAttribute("href", "/sign-up");
    delete process.env.BETA_TESTER_ENABLED;
  });

  it("shows the Pro price after switching to Monthly from the Beta default", async () => {
    process.env.BETA_TESTER_ENABLED = "true";
    const page = await PricingPage({ params: Promise.resolve({ locale: "en" }) });
    renderPage(page);

    fireEvent.click(screen.getByRole("button", { name: /^monthly$/i }));
    expect(screen.getByText(/₱250/)).toBeInTheDocument();
    delete process.env.BETA_TESTER_ENABLED;
  });

  it("does not show a Beta tab when beta is disabled", async () => {
    delete process.env.BETA_TESTER_ENABLED;
    const page = await PricingPage({ params: Promise.resolve({ locale: "en" }) });
    renderPage(page);

    expect(screen.queryByRole("button", { name: /^beta$/i })).not.toBeInTheDocument();
  });
});
