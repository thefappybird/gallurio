import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PublicWorkspaceError from "./error";

describe("PublicWorkspaceError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the temporarily-unavailable copy and calls reset on retry", () => {
    const reset = vi.fn();
    render(<PublicWorkspaceError error={new Error("boom")} reset={reset} />);

    expect(
      screen.getByText("This page is temporarily unavailable")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error with the public-workspace-error-boundary prefix", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");
    render(<PublicWorkspaceError error={error} reset={vi.fn()} />);
    expect(spy).toHaveBeenCalledWith("[public-workspace-error-boundary]", error);
  });
});
