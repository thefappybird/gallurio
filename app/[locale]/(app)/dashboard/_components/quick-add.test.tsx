import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { QuickAdd } from "./quick-add";

const labels = { booking: "New booking", client: "New client", inquiry: "New inquiry" };

describe("QuickAdd", () => {
  it("renders three labelled link buttons", () => {
    renderWithProviders(<QuickAdd title="Quick add" labels={labels} />);
    expect(screen.getByText("Quick add")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /new booking/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /new client/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /new inquiry/i })).toBeInTheDocument();
  });
});
