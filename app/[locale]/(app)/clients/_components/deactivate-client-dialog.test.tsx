import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { DeactivateClientDialog } from "./deactivate-client-dialog";

vi.mock("@/lib/actions/clients", () => ({
  deactivateClientAction: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("DeactivateClientDialog", () => {
  const defaultProps = {
    clientId: "c1",
    clientName: "Maria Santos",
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
  };

  it("renders warning title and body when open", () => {
    renderWithProviders(<DeactivateClientDialog {...defaultProps} />);
    expect(screen.getAllByText(/deactivate/i).length).toBeGreaterThan(0);
  });

  it("Cancel button calls onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <DeactivateClientDialog {...defaultProps} onOpenChange={onOpenChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Confirm calls deactivateClientAction and onSuccess on success", async () => {
    const { deactivateClientAction } = await import("@/lib/actions/clients");
    const onSuccess = vi.fn();
    renderWithProviders(
      <DeactivateClientDialog {...defaultProps} onSuccess={onSuccess} />
    );
    fireEvent.click(screen.getByRole("button", { name: /deactivate/i }));
    await waitFor(() => expect(deactivateClientAction).toHaveBeenCalledWith("c1"));
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
