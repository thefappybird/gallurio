import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortfolioGuideOverlay } from "./PortfolioGuideOverlay";

describe("PortfolioGuideOverlay", () => {
  it("renders the first step when open", () => {
    render(<PortfolioGuideOverlay open onClose={vi.fn()} onDontShowAgain={vi.fn()} />);
    expect(screen.getByText(/step 1 of/i)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    render(<PortfolioGuideOverlay open={false} onClose={vi.fn()} onDontShowAgain={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("advances through steps and finishes on the last step", () => {
    const onClose = vi.fn();
    render(<PortfolioGuideOverlay open onClose={onClose} onDontShowAgain={vi.fn()} />);

    // Walk Next until the finish button appears.
    for (let i = 0; i < 10; i++) {
      const finish = screen.queryByRole("button", { name: /get started/i });
      if (finish) {
        fireEvent.click(finish);
        break;
      }
      fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    }
    expect(onClose).toHaveBeenCalled();
  });

  it("fires onDontShowAgain when the dismiss button is pressed", () => {
    const onDontShowAgain = vi.fn();
    render(<PortfolioGuideOverlay open onClose={vi.fn()} onDontShowAgain={onDontShowAgain} />);
    fireEvent.click(screen.getByRole("button", { name: /don't show again/i }));
    expect(onDontShowAgain).toHaveBeenCalled();
  });
});
