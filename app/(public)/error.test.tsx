import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PublicPortfolioError from "./error";

describe("PublicPortfolioError", () => {
  it("calls reset when Try again is clicked", () => {
    const reset = vi.fn();
    render(<PublicPortfolioError error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
