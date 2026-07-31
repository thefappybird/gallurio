import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ClientMatchDialog, type ClientMatchCard } from "./client-match-dialog";

const noConflictMatch: ClientMatchCard = {
  id: "c1",
  name: "Maria Santos",
  email: "maria@example.com",
  phone: null,
  notes: null,
  tags: [],
  source: "manual",
  bookingsCount: 2,
  lastBookingAt: null,
};

const typedSameAsMatch = { name: "Maria Santos", email: "maria@example.com", phone: null, notes: "", tags: [] };

describe("ClientMatchDialog", () => {
  it("never renders the reconciliation step when the selected match has zero conflicts", async () => {
    const onResolve = vi.fn();
    renderWithProviders(
      <ClientMatchDialog
        open
        matches={[noConflictMatch]}
        typed={typedSameAsMatch}
        mode="create"
        onResolve={onResolve}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /maria santos/i }));
    fireEvent.click(screen.getByRole("button", { name: /save client/i }));

    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ clientId: "c1", picks: {} }));
    expect(screen.queryByText(/fields differ/i)).not.toBeInTheDocument();
  });

  it("shows the reconciliation step with the existing value pre-selected when a field conflicts", async () => {
    const conflictMatch: ClientMatchCard = { ...noConflictMatch, phone: "+63 900 000 0000" };
    renderWithProviders(
      <ClientMatchDialog
        open
        matches={[conflictMatch]}
        typed={{ ...typedSameAsMatch, phone: "+63 111 111 1111" }}
        mode="create"
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /maria santos/i }));
    fireEvent.click(screen.getByRole("button", { name: /save client/i }));

    await waitFor(() => expect(screen.getByText(/field.*differ/i)).toBeInTheDocument());
    expect(screen.getByRole("radio", { name: "+63 900 000 0000" })).toBeChecked();
  });

  it("emits the typed value once the user flips the radio to it and submits", async () => {
    const onResolve = vi.fn();
    const conflictMatch: ClientMatchCard = { ...noConflictMatch, phone: "+63 900 000 0000" };
    renderWithProviders(
      <ClientMatchDialog
        open
        matches={[conflictMatch]}
        typed={{ ...typedSameAsMatch, phone: "+63 111 111 1111" }}
        mode="create"
        onResolve={onResolve}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /maria santos/i }));
    fireEvent.click(screen.getByRole("button", { name: /save client/i }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "+63 111 111 1111" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("radio", { name: "+63 111 111 1111" }));
    fireEvent.click(screen.getByRole("button", { name: /save client/i }));

    await waitFor(() =>
      expect(onResolve).toHaveBeenCalledWith({ clientId: "c1", picks: { phone: "typed" } })
    );
  });

  it("emits nothing but onCancel when the user cancels", () => {
    const onResolve = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <ClientMatchDialog
        open
        matches={[noConflictMatch]}
        typed={typedSameAsMatch}
        mode="create"
        onResolve={onResolve}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onResolve).not.toHaveBeenCalled();
  });
});
