import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { CollectionCoverageCard } from "./collection-coverage-card";

const labels = {
  title: "Collection coverage",
  confirmedValue: "Confirmed value",
  confirmedHint: "Total value of confirmed bookings",
  paid: "Paid collected",
  paidHint: "Amount collected so far",
  remaining: "Remaining",
  remainingHint: "Balance still due",
  coverage: "Coverage: {pct}% of confirmed value collected",
  empty: "No confirmed bookings yet",
};

describe("CollectionCoverageCard", () => {
  it("shows empty copy when confirmedValue is 0", () => {
    renderWithProviders(
      <CollectionCoverageCard
        coverage={{ confirmedValue: 0, collected: 0, remaining: 0, coveragePct: 0 }}
        currency="PHP"
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("No confirmed bookings yet")).toBeInTheDocument();
  });

  it("renders confirmed/paid/remaining amounts and the coverage footer", () => {
    renderWithProviders(
      <CollectionCoverageCard
        coverage={{ confirmedValue: 100000, collected: 40000, remaining: 60000, coveragePct: 40 }}
        currency="PHP"
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("Confirmed value")).toBeInTheDocument();
    expect(screen.getByText("Paid collected")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    expect(screen.getByText(/Coverage: 40% of confirmed value collected/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  });

  it("renders the title, hints, and as-of date", () => {
    renderWithProviders(
      <CollectionCoverageCard
        coverage={{ confirmedValue: 100000, collected: 40000, remaining: 60000, coveragePct: 40 }}
        currency="PHP"
        locale="en"
        labels={{ ...labels, asOf: "As of Jul 17" }}
      />
    );
    expect(screen.getByText("Collection coverage")).toBeInTheDocument();
    expect(screen.getByText("Total value of confirmed bookings")).toBeInTheDocument();
    expect(screen.getByText("Amount collected so far")).toBeInTheDocument();
    expect(screen.getByText("Balance still due")).toBeInTheDocument();
    expect(screen.getByText(/As of Jul 17/)).toBeInTheDocument();
  });

  it("appends today's date after the asOf label in the header", () => {
    renderWithProviders(
      <CollectionCoverageCard
        coverage={{ confirmedValue: 100000, collected: 40000, remaining: 60000, coveragePct: 40 }}
        currency="PHP"
        locale="en"
        labels={{ ...labels, asOf: "As of" }}
      />
    );
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`As of.*${year}`))).toBeInTheDocument();
  });

  it("shows 100% coverage with 0% remaining", () => {
    renderWithProviders(
      <CollectionCoverageCard
        coverage={{ confirmedValue: 50000, collected: 50000, remaining: 0, coveragePct: 100 }}
        currency="PHP"
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText(/Coverage: 100% of confirmed value collected/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
