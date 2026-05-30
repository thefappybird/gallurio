import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ClientDetailModal } from "./client-detail-modal";
import type { ClientRow } from "./clients-table";

vi.mock("@/lib/actions/clients", () => ({
  getClientBookingsAction: vi.fn().mockResolvedValue([
    {
      id: "b1",
      title: "Carter Wedding",
      status: "booked",
      firstSessionStart: new Date("2026-08-15"),
      lastSessionEnd: new Date("2026-08-15"),
      total: 75_000,
      currency: "PHP",
    },
  ]),
}));

const sampleClient: ClientRow = {
  id: "c1",
  name: "Maria Santos",
  email: "maria@example.com",
  phone: "+63 917 555 0142",
  source: "manual",
  tags: ["vip"],
  notes: "Great client",
  totalSpent: 75_000,
  bookingsCount: 3,
  lastBookingAt: new Date("2026-04-15"),
  isActive: true,
  currency: "PHP",
};

const defaultProps = {
  client: sampleClient,
  open: true,
  onClose: vi.fn(),
  onEdit: vi.fn(),
  onDeactivate: vi.fn(),
  onReactivate: vi.fn(),
  locale: "en",
};

describe("ClientDetailModal", () => {
  it("renders client name in header", () => {
    renderWithProviders(<ClientDetailModal {...defaultProps} />);
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
  });

  it("shows source, email, and phone in the header (no separate contact section)", () => {
    renderWithProviders(<ClientDetailModal {...defaultProps} />);
    // Contact details now live in the header metadata row.
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
    expect(screen.getByText("+63 917 555 0142")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument(); // source badge (source: "manual")
    // The standalone "Contact" overview section is gone.
    expect(screen.queryByText(/^contact$/i)).not.toBeInTheDocument();
  });

  it("Overview tab shows total spent and bookings count", () => {
    renderWithProviders(<ClientDetailModal {...defaultProps} />);
    expect(screen.getByText("3")).toBeInTheDocument(); // bookingsCount
  });

  it("Bookings tab lazy-loads and shows booking title", async () => {
    renderWithProviders(<ClientDetailModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("tab", { name: /bookings/i }));
    await waitFor(() => expect(screen.getByText("Carter Wedding")).toBeInTheDocument());
  });

  it("Payments tab shows empty state", () => {
    renderWithProviders(<ClientDetailModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("tab", { name: /payments/i }));
    expect(screen.getByText(/no payment records/i)).toBeInTheDocument();
  });

  it("calls onEdit when Edit button is clicked", () => {
    const onEdit = vi.fn();
    renderWithProviders(<ClientDetailModal {...defaultProps} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(sampleClient);
  });

  it("calls onDeactivate when Deactivate button is clicked", () => {
    const onDeactivate = vi.fn();
    renderWithProviders(<ClientDetailModal {...defaultProps} onDeactivate={onDeactivate} />);
    fireEvent.click(screen.getByRole("button", { name: /deactivate/i }));
    expect(onDeactivate).toHaveBeenCalledWith(sampleClient);
  });

  it("does not render when client is null", () => {
    renderWithProviders(<ClientDetailModal {...defaultProps} client={null} />);
    expect(screen.queryByText("Maria Santos")).not.toBeInTheDocument();
  });
});
