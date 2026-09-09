import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ClientFormModal } from "./client-form-modal";
import { updateClientAction, findClientMatchesAction } from "@/lib/actions/clients";

vi.mock("@/lib/actions/clients", () => ({
  createClientAction: vi.fn().mockResolvedValue({ ok: true }),
  updateClientAction: vi.fn().mockResolvedValue({ ok: true }),
  findClientMatchesAction: vi.fn().mockResolvedValue({ matches: [] }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onSuccess: vi.fn(),
};

// findClientMatchesAction is overridden per-test; without this the override
// leaks and every later test opens the match dialog instead of saving.
beforeEach(() => {
  vi.mocked(findClientMatchesAction).mockResolvedValue({ matches: [] });
  vi.mocked(updateClientAction).mockClear();
});

describe("ClientFormModal — linking to a match", () => {
  it("never erases a stored field the form left blank", async () => {
    // updateClientAction $sets the whole document, and a blank typed field is
    // not a conflict, so it never reaches `picks` — without an explicit merge
    // the stored email/phone/notes are overwritten with nothing.
    vi.mocked(findClientMatchesAction).mockResolvedValue({
      matches: [
        {
          id: "c9",
          name: "Ana Cruz",
          email: "ana@example.com",
          phone: "+63 917 123 4567",
          notes: "prefers golden hour",
          tags: ["vip"],
          bookingsCount: 3,
          lastBookingAt: null,
        },
      ],
    } as never);

    renderWithProviders(<ClientFormModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/maria santos/i), { target: { value: "Ana Cruz" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    // Pick the match. Everything typed is blank, so there are no conflicts and
    // the reconcile step is skipped.
    const radio = await screen.findByRole("radio", { name: "Ana Cruz" });
    fireEvent.click(radio);
    fireEvent.click(screen.getByRole("button", { name: "Save client" }));

    await waitFor(() => expect(updateClientAction).toHaveBeenCalled());
    const [, payload] = vi.mocked(updateClientAction).mock.calls[0];
    expect(payload.email).toBe("ana@example.com");
  });

  it("keeps the stored client's provenance instead of resetting it to manual", async () => {
    // The add form defaults source to "manual"; linking must not relabel a
    // client that arrived from the public form or a referral.
    vi.mocked(findClientMatchesAction).mockResolvedValue({
      matches: [
        {
          id: "c9",
          name: "Ana Cruz",
          email: "ana@example.com",
          phone: null,
          notes: null,
          tags: [],
          source: "referral",
          bookingsCount: 0,
          lastBookingAt: null,
        },
      ],
    } as never);

    renderWithProviders(<ClientFormModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/maria santos/i), { target: { value: "Ana Cruz" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    fireEvent.click(await screen.findByRole("radio", { name: "Ana Cruz" }));
    fireEvent.click(screen.getByRole("button", { name: "Save client" }));

    await waitFor(() => expect(updateClientAction).toHaveBeenCalled());
    const [, payload] = vi.mocked(updateClientAction).mock.calls[0];
    expect(payload.source).toBe("referral");
  });
});

describe("ClientFormModal", () => {
  it("renders Add Client title in add mode", () => {
    renderWithProviders(<ClientFormModal {...defaultProps} />);
    expect(screen.getByText("Add Client")).toBeInTheDocument();
  });

  it("renders Edit Client title with pre-filled name in edit mode", () => {
    renderWithProviders(
      <ClientFormModal {...defaultProps} initialData={{ id: "c1", name: "Maria Santos" }} />
    );
    expect(screen.getByText("Edit Client")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Maria Santos")).toBeInTheDocument();
  });

  it("returns to the read-only view from edit mode", () => {
    const onView = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ClientFormModal
        {...defaultProps}
        initialData={{ id: "c1", name: "Maria Santos" }}
        onOpenChange={onOpenChange}
        onView={onView}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onView).toHaveBeenCalledOnce();
  });

  it("calls onSuccess on successful submit", async () => {
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(<ClientFormModal {...defaultProps} onSuccess={onSuccess} onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByPlaceholderText(/maria santos/i), { target: { value: "Test Client" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it("shows inline error on action failure", async () => {
    const { createClientAction } = await import("@/lib/actions/clients");
    vi.mocked(createClientAction).mockResolvedValueOnce({ error: "client_create_failed" });

    renderWithProviders(<ClientFormModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/maria santos/i), { target: { value: "Test Client" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(screen.getByText("Couldn't create the client. Please try again.")).toBeInTheDocument());
  });

  it("shows name validation error on empty submit", async () => {
    renderWithProviders(<ClientFormModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(screen.getByText(/required/i)).toBeInTheDocument());
  });

  it("marks the name input invalid and associates it with the alert message on empty submit", async () => {
    renderWithProviders(<ClientFormModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    const input = await screen.findByLabelText(/^name/i);
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!);
    expect(message).toHaveAttribute("role", "alert");
    expect(message).toHaveTextContent(/required/i);
  });

  it("marks the email input invalid and associates it with the alert message on an invalid email", async () => {
    renderWithProviders(<ClientFormModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/maria santos/i), { target: { value: "Test Client" } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    const input = screen.getByLabelText(/^email/i);
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!);
    expect(message).toHaveAttribute("role", "alert");
  });

  it("renders no alert message and no aria-invalid on the email input when valid", () => {
    renderWithProviders(<ClientFormModal {...defaultProps} />);
    const input = screen.getByLabelText(/^email/i);
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("marks the phone input invalid and associates it with the alert message on an invalid phone", async () => {
    renderWithProviders(<ClientFormModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/maria santos/i), { target: { value: "Test Client" } });
    fireEvent.change(screen.getByPlaceholderText(/\+63/), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    const input = screen.getByPlaceholderText(/\+63/);
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!);
    expect(message).toHaveAttribute("role", "alert");
    expect(message).toHaveTextContent(/invalid phone number/i);
  });

  it("renders no alert message and no aria-invalid on the phone input when valid", () => {
    renderWithProviders(<ClientFormModal {...defaultProps} />);
    const input = screen.getByPlaceholderText(/\+63/);
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens UnsavedChangesDialog when dirty form is closed", async () => {
    renderWithProviders(<ClientFormModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/maria santos/i), { target: { value: "Test" } });
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    // The UnsavedChangesDialog renders a "Discard and close" button
    await waitFor(() => expect(screen.getByRole("button", { name: /discard/i })).toBeInTheDocument());
  });

  it("adds a tag on Enter key", async () => {
    renderWithProviders(<ClientFormModal {...defaultProps} />);
    const tagInput = screen.getByPlaceholderText(/add a tag/i);
    fireEvent.change(tagInput, { target: { value: "vip" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
    await waitFor(() => expect(screen.getByText("vip")).toBeInTheDocument());
  });

  it("adds a tag on space key", async () => {
    renderWithProviders(<ClientFormModal {...defaultProps} />);
    const tagInput = screen.getByPlaceholderText(/add a tag/i);
    fireEvent.change(tagInput, { target: { value: "vip" } });
    fireEvent.keyDown(tagInput, { key: " " });
    await waitFor(() => expect(screen.getByText("vip")).toBeInTheDocument());
  });

  it("removes a tag when remove button is clicked", async () => {
    renderWithProviders(
      <ClientFormModal {...defaultProps} initialData={{ tags: ["vip"] }} />
    );
    await waitFor(() => expect(screen.getByText("vip")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /remove tag vip/i }));
    await waitFor(() => expect(screen.queryByText("vip")).not.toBeInTheDocument());
  });

  it("checks for name matches on create, then skips the match dialog and creates directly when none are found", async () => {
    const { findClientMatchesAction } = await import("@/lib/actions/clients");
    const onSuccess = vi.fn();
    renderWithProviders(<ClientFormModal {...defaultProps} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText(/maria santos/i), { target: { value: "Test Client" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(findClientMatchesAction).toHaveBeenCalledWith(expect.objectContaining({ name: "Test Client" }))
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(screen.queryByText("Is the client one of these?")).not.toBeInTheDocument();
  });
});
