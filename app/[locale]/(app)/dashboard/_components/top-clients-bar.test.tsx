import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TopClientsBar } from "./top-clients-bar";

describe("TopClientsBar", () => {
  it("renders empty state with no clients", () => {
    renderWithProviders(
      <TopClientsBar
        clients={[]}
        currency="PHP"
        locale="en"
        title="Top clients"
        empty="Nothing here."
      />
    );
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("renders each client name and formatted spend, numbered", () => {
    renderWithProviders(
      <TopClientsBar
        clients={[
          { _id: new Types.ObjectId(), name: "Emma Carter", totalSpent: 120_000 },
          { _id: new Types.ObjectId(), name: "Priya Shah", totalSpent: 80_000 },
        ]}
        currency="PHP"
        locale="en"
        title="Top clients"
        empty="Nothing."
      />
    );
    expect(screen.getByText("Emma Carter")).toBeInTheDocument();
    expect(screen.getByText("Priya Shah")).toBeInTheDocument();
    expect(screen.getByText(/120,000/)).toBeInTheDocument();
    expect(screen.getByText(/80,000/)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
