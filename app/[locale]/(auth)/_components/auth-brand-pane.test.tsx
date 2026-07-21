import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { AuthBrandPane } from "./auth-brand-pane";

describe("AuthBrandPane", () => {
  it("renders the landing tagline, regardless of the active auth route", () => {
    renderWithProviders(<AuthBrandPane />);

    expect(
      screen.getByRole("heading", { name: "Show your work. Run your business." }),
    ).toBeInTheDocument();
  });

  it("renders the trust checklist matching the landing page", () => {
    renderWithProviders(<AuthBrandPane />);

    expect(screen.getByText("Free during beta")).toBeInTheDocument();
    expect(screen.getByText("No card required")).toBeInTheDocument();
    expect(screen.getByText("Cancel anytime")).toBeInTheDocument();
    expect(screen.getByText("Secure checkout by Lemon Squeezy")).toBeInTheDocument();
  });
});
