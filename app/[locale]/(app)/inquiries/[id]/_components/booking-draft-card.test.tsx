import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { formatSessionTimeRange } from "@/lib/inquiries/session-time";
import type { TimeMode } from "@/lib/utils/time-format";

let _timeMode: TimeMode = "24h";

vi.mock("@/lib/time-format/context", () => ({
  useTimeFormat: vi.fn(() => _timeMode),
  useTimeFormatContext: vi.fn(() => ({ timeMode: _timeMode, setTimeMode: vi.fn() })),
  TimeFormatProvider: ({ children }: { children: ReactNode }) => children,
}));

const approveInquiryBookingAction = vi.fn();
const saveDraftBookingFieldsAction = vi.fn();
const editInquirySessionsAction = vi.fn();
vi.mock("../../_actions", () => ({
  approveInquiryBookingAction: (...a: unknown[]) => approveInquiryBookingAction(...a),
  saveDraftBookingFieldsAction: (...a: unknown[]) => saveDraftBookingFieldsAction(...a),
  editInquirySessionsAction: (...a: unknown[]) => editInquirySessionsAction(...a),
}));

const refresh = vi.fn();
const invalidateSpy = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-data-events", () => ({ useInvalidateFor: () => invalidateSpy }));
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
  editInquirySessionsAction.mockReset();
  editInquirySessionsAction.mockResolvedValue({ ok: true });
  refresh.mockReset();
  invalidateSpy.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ byDate: {} }) })
  );
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

  it("keeps the inquiry open and requests client resolution when conversion finds a duplicate", async () => {
    approveInquiryBookingAction.mockResolvedValue({ error: "needs_client_resolution" });
    const onConverted = vi.fn();
    const onClientResolutionRequired = vi.fn();
    renderWithProviders(
      <BookingDraftCard
        {...baseProps}
        onConverted={onConverted}
        onClientResolutionRequired={onClientResolutionRequired}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Convert to booking/i }));

    await waitFor(() => expect(onClientResolutionRequired).toHaveBeenCalledOnce());
    expect(onConverted).not.toHaveBeenCalled();
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

  it("calls toast.success after a successful sessions save", async () => {
    const { toast } = await import("sonner");
    const futureSession = { startDate: "2099-12-31", startTime: "10:00", endTime: "12:00" };
    renderWithProviders(<BookingDraftCard {...baseProps} sessions={[futureSession]} />);

    fireEvent.click(screen.getByRole("button", { name: /Edit sessions/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => expect(editInquirySessionsAction).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith("Sessions saved.");
  });

  it("allows an already-past inquiry session to be edited and saved", async () => {
    const pastSession = { startDate: "2000-01-01", startTime: "10:00", endTime: "12:00" };
    renderWithProviders(<BookingDraftCard {...baseProps} sessions={[pastSession]} />);

    fireEvent.click(screen.getByRole("button", { name: /Edit sessions/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => expect(editInquirySessionsAction).toHaveBeenCalledWith("abc", {
      sessions: [pastSession],
    }));
  });

  it("calls onInquiryChanged with the updated eventDate after a successful sessions save", async () => {
    const onInquiryChanged = vi.fn();
    const futureSession = { startDate: "2099-12-31", startTime: "10:00", endTime: "12:00" };
    renderWithProviders(
      <BookingDraftCard
        {...baseProps}
        sessions={[futureSession]}
        onInquiryChanged={onInquiryChanged}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Edit sessions/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => expect(editInquirySessionsAction).toHaveBeenCalledOnce());
    expect(onInquiryChanged).toHaveBeenCalledWith("abc", {
      eventDate: "2099-12-31T00:00:00.000Z",
    });
  });

  it("announces inquiry.updated and booking.updated after approving, without router.refresh", async () => {
    renderWithProviders(<BookingDraftCard {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /convert to booking/i }));

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        { type: "booking.updated", bookingId: "bk_1", inquiryId: "abc" },
        { refresh: false },
      )
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      { type: "inquiry.updated", inquiryId: "abc", bookingId: "bk_1" },
      { refresh: false },
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("checks every session date with ONE batched request and flags the overlapping session", async () => {
    let resolveFetch!: () => void;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              json: async () => ({
                byDate: {
                  "2099-12-30": [{ id: "x", title: "Other", shiftStart: "09:00", shiftEnd: "11:00" }],
                  "2099-12-31": [],
                },
              }),
            });
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const sessions = [
      { startDate: "2099-12-31", startTime: "10:00", endTime: "12:00" },
      { startDate: "2099-12-30", startTime: "10:00", endTime: "12:00" },
      { startDate: "2099-12-31", startTime: "14:00", endTime: "15:00" },
    ];
    renderWithProviders(<BookingDraftCard {...baseProps} sessions={sessions} />);

    fireEvent.click(screen.getByRole("button", { name: /Edit sessions/i }));

    await waitFor(() => expect(screen.getByText("Checking for conflicts…")).toBeInTheDocument());
    resolveFetch();
    await waitFor(() => expect(screen.queryByText("Checking for conflicts…")).not.toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bookings/shifts-on-date?dates=2099-12-30,2099-12-31&excludeId=bk_1"
    );
    expect(screen.getAllByText("conflict")).toHaveLength(1);
  });

  it("renders session time via formatSessionTimeRange in 12h mode (not raw HH:MM)", () => {
    _timeMode = "12h";
    const session = { startDate: "2026-09-01", startTime: "14:00", endTime: "17:30" };
    renderWithProviders(
      <BookingDraftCard
        {...baseProps}
        sessions={[session]}
      />
    );
    const expected = formatSessionTimeRange(session, "12h", "UTC");
    // Must contain am/pm marker — proving the canonical formatter ran, not raw "14:00–17:30"
    expect(expected).toMatch(/pm/i);
    expect(
      screen.getByText(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    ).toBeInTheDocument();
    _timeMode = "24h";
  });
});
