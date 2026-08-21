import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { PricingTeaser } from "./pricing-teaser";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const proPricing = { currency: "PHP", monthly: 250, yearly: 2500 };

describe("PricingTeaser", () => {
  it("renders a single Pro plan with the live monthly price", () => {
    render(<PricingTeaser proPricing={proPricing} />, { wrapper });

    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("1 month free")).toBeInTheDocument();
    expect(screen.getByText(/₱250/)).toBeInTheDocument();
  });

  it("switches to the live yearly price when the Yearly cadence is selected", () => {
    render(<PricingTeaser proPricing={proPricing} />, { wrapper });

    fireEvent.click(screen.getByRole("button", { name: /yearly/i }));
    expect(screen.getByText(/₱2,500/)).toBeInTheDocument();
  });

  it("names the billed amount under the local-currency headline", () => {
    render(
      <PricingTeaser
        proPricing={{ ...proPricing, local: { currency: "USD", monthly: 4.3, yearly: 43 } }}
      />,
      { wrapper }
    );

    expect(screen.getByText(/Billed as ₱250 PHP/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /yearly/i }));
    expect(screen.getByText(/Billed as ₱2,500 PHP/)).toBeInTheDocument();
  });

  it("does not render a Free or Beta Tester card", () => {
    render(<PricingTeaser proPricing={proPricing} />, { wrapper });

    expect(screen.queryByText("Free")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta Tester")).not.toBeInTheDocument();
  });

  it("shows a Coming soon indicator alongside the existing badge", () => {
    render(<PricingTeaser proPricing={proPricing} />, { wrapper });

    expect(screen.getByText("1 month free")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
