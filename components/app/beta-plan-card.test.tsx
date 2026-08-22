import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BetaPlanCard } from "./beta-plan-card";

describe("BetaPlanCard", () => {
  it("renders the beta plan name and the action slot", () => {
    renderWithProviders(<BetaPlanCard action={<button>Activate</button>} />);
    expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
  });
});
