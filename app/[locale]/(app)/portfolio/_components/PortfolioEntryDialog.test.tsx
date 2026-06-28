import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { PortfolioEntryDialog } from "./PortfolioEntryDialog";

function setup(props: Partial<React.ComponentProps<typeof PortfolioEntryDialog>> = {}) {
  return renderWithProviders(
    <PortfolioEntryDialog
      open
      canContinue
      hasDrafts
      onContinue={vi.fn()}
      onLoadExisting={vi.fn()}
      onStartScratch={vi.fn()}
      {...props}
    />
  );
}

describe("PortfolioEntryDialog", () => {
  it("calls the right handler for each option", () => {
    const onContinue = vi.fn();
    const onLoadExisting = vi.fn();
    const onStartScratch = vi.fn();
    setup({ onContinue, onLoadExisting, onStartScratch });
    fireEvent.click(screen.getByRole("button", { name: /continue where you left off/i }));
    fireEvent.click(screen.getByRole("button", { name: /load an existing draft/i }));
    fireEvent.click(screen.getByRole("button", { name: /start from scratch/i }));
    expect(onContinue).toHaveBeenCalled();
    expect(onLoadExisting).toHaveBeenCalled();
    expect(onStartScratch).toHaveBeenCalled();
  });

  it("disables continue when nothing to resume and load when no drafts", () => {
    setup({ canContinue: false, hasDrafts: false });
    expect(screen.getByRole("button", { name: /continue where you left off/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /load an existing draft/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /start from scratch/i })).not.toBeDisabled();
  });
});
