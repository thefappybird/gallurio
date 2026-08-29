import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { DemoImportDetectedDialog } from "./DemoImportDetectedDialog";

describe("DemoImportDetectedDialog", () => {
  it("calls onConfirm when Yes is clicked and onDiscard when No is clicked", () => {
    const onConfirm = vi.fn();
    const onDiscard = vi.fn();
    renderWithProviders(
      <DemoImportDetectedDialog open busy={false} onConfirm={onConfirm} onDiscard={onDiscard} />
    );
    fireEvent.click(screen.getByRole("button", { name: /yes/i }));
    fireEvent.click(screen.getByRole("button", { name: /no, discard/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
