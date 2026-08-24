import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { PlanCard } from "./plan-card";

describe("PlanCard", () => {
  it("renders the name, price, badge, features and action slot", () => {
    renderWithProviders(
      <PlanCard
        name="Pro"
        badge="Save 2 months"
        comparePrice="$60"
        price="$50.00"
        priceSuffix="/ year"
        tagline="The full workspace."
        features={["Unlimited bookings"]}
        action={<button>Upgrade</button>}
      />
    );

    expect(screen.getByRole("heading", { name: "Pro" })).toBeInTheDocument();
    expect(screen.getByText("Save 2 months")).toBeInTheDocument();
    expect(screen.getByText("$60")).toBeInTheDocument();
    expect(screen.getByText("$50.00")).toBeInTheDocument();
    expect(screen.getByText("Unlimited bookings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade" })).toBeInTheDocument();
  });

  it("puts the charged price ahead of the struck-through reference", () => {
    renderWithProviders(
      <PlanCard name="Pro" comparePrice="$60" price="$50.00" priceSuffix="/ year" />
    );

    const price = screen.getByText("$50.00");
    const compare = screen.getByText("$60");
    expect(price.compareDocumentPosition(compare)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});
