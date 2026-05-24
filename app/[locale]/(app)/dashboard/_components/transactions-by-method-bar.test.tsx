import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TransactionsByMethodBar } from "./transactions-by-method-bar";

describe("TransactionsByMethodBar", () => {
  it("renders empty state with no data", () => {
    renderWithProviders(
      <TransactionsByMethodBar
        data={[]}
        currency="PHP"
        locale="en"
        title="Payments"
        empty="No payments yet."
      />
    );
    expect(screen.getByText("No payments yet.")).toBeInTheDocument();
  });

  it("renders the total above the chart", () => {
    renderWithProviders(
      <TransactionsByMethodBar
        data={[
          { method: "hitpay", total: 20_000 },
          { method: "cash", total: 5_000 },
        ]}
        currency="PHP"
        locale="en"
        title="Payments"
        empty="No payments yet."
      />
    );
    expect(screen.getByText(/25,000/)).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
  });
});
