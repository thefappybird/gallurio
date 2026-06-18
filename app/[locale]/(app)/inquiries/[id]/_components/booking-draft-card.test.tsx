import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const approveInquiryBookingAction = vi.fn();
const saveDraftBookingFieldsAction = vi.fn();
vi.mock("../../_actions", () => ({
  approveInquiryBookingAction: (...a: unknown[]) => approveInquiryBookingAction(...a),
  saveDraftBookingFieldsAction: (...a: unknown[]) => saveDraftBookingFieldsAction(...a),
}));

const refresh = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh }),
  Link: ({ children, href }: { children: ReactNode; href: string }) =>
    createElement("a", { href }, children),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { BookingDraftCard } from "./booking-draft-card";

const baseProps = {
  inquiryId: "abc",
  isOwner: true,
  isConverted: false,
  bookingMissing: false,
  bookingId: "bk_1",
  currency: "PHP",
  initialTotal: 0,
  initialDeposit: 0,
  initialNotes: "",
};

beforeEach(() => {
  approveInquiryBookingAction.mockReset();
  approveInquiryBookingAction.mockResolvedValue({ ok: true, bookingId: "bk_1" });
  saveDraftBookingFieldsAction.mockReset();
  saveDraftBookingFieldsAction.mockResolvedValue({ ok: true });
  refresh.mockReset();
});

describe("BookingDraftCard", () => {
  it("renders editable fields and approves with current edits", async () => {
    renderWithProviders(<BookingDraftCard {...baseProps} initialTotal={5000} initialDeposit={1000} />);

    const approve = screen.getByRole("button", { name: /Convert to booking/i });
    fireEvent.click(approve);

    await waitFor(() => expect(approveInquiryBookingAction).toHaveBeenCalledOnce());
    expect(approveInquiryBookingAction).toHaveBeenCalledWith("abc", {
      total: 5000,
      deposit: 1000,
      notes: "",
      teamId: null,
    });
    // Optimistic success banner.
    expect(await screen.findByText("This inquiry has been approved.")).toBeInTheDocument();
  });

  it("shows the missing-draft notice", () => {
    renderWithProviders(<BookingDraftCard {...baseProps} bookingMissing />);
    expect(screen.getByText("No linked draft booking for this inquiry.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Convert to booking/i })).not.toBeInTheDocument();
  });

  it("shows a read-only banner + view link when already converted", () => {
    renderWithProviders(<BookingDraftCard {...baseProps} isConverted />);
    expect(screen.getByText("This inquiry has been approved.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View booking/i })).toHaveAttribute(
      "href",
      "/bookings?detail=bk_1"
    );
    expect(screen.queryByRole("button", { name: /Convert to booking/i })).not.toBeInTheDocument();
  });

  it("hides approve and shows owner-only note for staff", () => {
    renderWithProviders(<BookingDraftCard {...baseProps} isOwner={false} />);
    expect(
      screen.getByText("Only the workspace owner can convert bookings.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Convert to booking/i })).not.toBeInTheDocument();
  });

  it("disables convert button and shows conflict alert when hasConflict is true", () => {
    renderWithProviders(<BookingDraftCard {...baseProps} hasConflict />);
    const convertBtn = screen.getByRole("button", { name: /Convert to booking/i });
    expect(convertBtn).toBeDisabled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("staff does not see the conflict alert even when hasConflict is true", () => {
    renderWithProviders(<BookingDraftCard {...baseProps} isOwner={false} hasConflict />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("save button is disabled when not dirty and enables after a field change", async () => {
    renderWithProviders(<BookingDraftCard {...baseProps} initialTotal={1000} />);
    const saveBtn = screen.getByRole("button", { name: /Save edits/i });
    expect(saveBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Total/i), { target: { value: "2000" } });
    expect(saveBtn).not.toBeDisabled();
  });

  it("calls onInquiryChanged with draft patch after a successful save", async () => {
    const onInquiryChanged = vi.fn();
    renderWithProviders(
      <BookingDraftCard {...baseProps} initialTotal={1000} onInquiryChanged={onInquiryChanged} />
    );
    fireEvent.change(screen.getByLabelText(/Total/i), { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: /Save edits/i }));
    await waitFor(() => expect(saveDraftBookingFieldsAction).toHaveBeenCalledOnce());
    expect(onInquiryChanged).toHaveBeenCalledWith(
      "abc",
      expect.objectContaining({ total: 2500, deposit: 0, notes: "" })
    );
  });
});
