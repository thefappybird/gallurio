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

describe("PricingTeaser", () => {
  it("renders all three plan names", () => {
    render(<PricingTeaser />, { wrapper });

    expect(screen.getAllByText("Free").length).toBeGreaterThan(0);
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Beta Tester")).toBeInTheDocument();
  });

  it("switches the Pro price when the Yearly cadence is selected", () => {
    render(<PricingTeaser />, { wrapper });

    expect(screen.getByText("$14/mo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /yearly/i }));
    expect(screen.getByText("$10/mo, billed yearly")).toBeInTheDocument();
  });
});
