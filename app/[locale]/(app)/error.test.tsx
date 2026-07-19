import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import AppError from "./error";

describe("AppError", () => {
  it("shows the generic error message and calls reset when retry is clicked", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    renderWithProviders(<AppError error={error} reset={reset} />);

    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders a link back to the dashboard", () => {
    renderWithProviders(<AppError error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toBeInTheDocument();
  });
});
