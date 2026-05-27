import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ClientFormModal } from "./client-form-modal";

vi.mock("@/lib/actions/clients", () => ({
  createClientAction: vi.fn().mockResolvedValue({ ok: true }),
  updateClientAction: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onSuccess: vi.fn(),
};

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
    vi.mocked(createClientAction).mockResolvedValueOnce({ error: "Failed to create client" });

    renderWithProviders(<ClientFormModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/maria santos/i), { target: { value: "Test Client" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(screen.getByText("Failed to create client")).toBeInTheDocument());
  });

  it("shows name validation error on empty submit", async () => {
    renderWithProviders(<ClientFormModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(screen.getByText(/required/i)).toBeInTheDocument());
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
    const tagInput = screen.getByPlaceholderText(/add tag/i);
    fireEvent.change(tagInput, { target: { value: "vip" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
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
});
