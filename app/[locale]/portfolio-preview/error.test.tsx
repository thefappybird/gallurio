import { describe, expect, it, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import PortfolioPreviewError from "./error";

describe("PortfolioPreviewError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a short message and calls reset on retry", () => {
    const reset = vi.fn();
    renderWithProviders(<PortfolioPreviewError error={new Error("boom")} reset={reset} />);

    expect(screen.getByText("Preview couldn't load")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders no nav or links", () => {
    renderWithProviders(<PortfolioPreviewError error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("logs the error with the portfolio-preview-error-boundary prefix", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");
    renderWithProviders(<PortfolioPreviewError error={error} reset={vi.fn()} />);
    expect(spy).toHaveBeenCalledWith("[portfolio-preview-error-boundary]", error);
  });
});
