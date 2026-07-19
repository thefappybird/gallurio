import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GlobalErrorContent } from "./global-error";

describe("GlobalErrorContent", () => {
  it("calls reset when Try again is clicked", () => {
    const reset = vi.fn();
    render(<GlobalErrorContent reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
