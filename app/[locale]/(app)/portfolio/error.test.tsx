import { describe, expect, it, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import PortfolioError from "./error";

describe("PortfolioError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reassures the owner their draft is safe and calls reset on retry", () => {
    const reset = vi.fn();
    renderWithProviders(<PortfolioError error={new Error("boom")} reset={reset} />);

    expect(
      screen.getByText(
        "Your draft is safe — it's saved in this browser. Reload the editor to keep working, or open Drafts to pick it up from there."
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("links back to the editor to reload it", () => {
    renderWithProviders(<PortfolioError error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Reload editor" })).toHaveAttribute(
      "href",
      "/portfolio"
    );
  });

  it("logs the error with the portfolio-error-boundary prefix", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");
    renderWithProviders(<PortfolioError error={error} reset={vi.fn()} />);
    expect(spy).toHaveBeenCalledWith("[portfolio-error-boundary]", error);
  });
});
