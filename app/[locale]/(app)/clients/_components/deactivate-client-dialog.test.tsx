import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { DeactivateClientDialog } from "./deactivate-client-dialog";
import { toast } from "sonner";
import { deactivateClientAction } from "@/lib/actions/clients";

vi.mock("@/lib/actions/clients", () => ({
  deactivateClientAction: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("sonner", () => ({ toast: { loading: vi.fn(() => "toast-id"), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() } }));

describe("DeactivateClientDialog", () => {
  const defaultProps = {
    clientId: "c1",
    clientName: "Maria Santos",
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(deactivateClientAction).mockReset();
    vi.mocked(deactivateClientAction).mockResolvedValue({ ok: true });
    vi.mocked(toast.error).mockClear();
  });

  it("renders warning title and body when open", () => {
    renderWithProviders(<DeactivateClientDialog {...defaultProps} />);
    expect(screen.getAllByText(/deactivate/i).length).toBeGreaterThan(0);
  });

  it("shows the client name on its own emphasized line, separate from the body", () => {
    renderWithProviders(<DeactivateClientDialog {...defaultProps} />);
    const nameEl = screen.getByText("Maria Santos");
    // Name stands alone (not embedded in the description) and is larger/bolder.
    expect(nameEl.tagName).toBe("SPAN");
    expect(nameEl.className).toContain("text-lg");
    expect(nameEl.className).toContain("font-semibold");
    expect(nameEl.textContent).toBe("Maria Santos");
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

  it("on server error surfaces a toast, keeps the dialog open, and does not call onSuccess", async () => {
    vi.mocked(deactivateClientAction).mockResolvedValue({ error: "client_has_active_bookings" });
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <DeactivateClientDialog
        {...defaultProps}
        onSuccess={onSuccess}
        onOpenChange={onOpenChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /deactivate/i }));

    await waitFor(() => expect(deactivateClientAction).toHaveBeenCalledWith("c1"));
    // No throw / unhandled rejection: failure is handled via toast.
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "This client has active bookings and can't be deactivated.",
        { id: "toast-id" }
      )
    );
    expect(onSuccess).not.toHaveBeenCalled();
    // Dialog stays open so the user can retry — onOpenChange(false) not called.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
