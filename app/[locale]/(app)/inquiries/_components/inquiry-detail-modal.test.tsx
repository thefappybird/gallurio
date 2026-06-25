import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

// Stub heavy sub-components to keep the modal test lightweight
vi.mock("..\/[id]\/_components\/client-info-card", () => ({
  ClientInfoCard: (props: Record<string, unknown>) => {
    // Expose whether onInquiryChanged was forwarded via data-testid
    return (
      <div
        data-testid="client-info-card"
        data-has-on-inquiry-changed={String(typeof props.onInquiryChanged === "function")}
      />
    );
  },
}));

vi.mock("..\/[id]\/_components\/booking-draft-card", () => ({
  BookingDraftCard: (props: Record<string, unknown>) => (
    <div
      data-testid="booking-draft-card"
      data-has-on-inquiry-changed={String(typeof props.onInquiryChanged === "function")}
    />
  ),
}));

vi.mock("..\/[id]\/_components\/event-request-card", () => ({
  EventRequestCard: () => <div />,
}));

vi.mock("..\/[id]\/_components\/inquiry-actions", () => ({
  InquiryActions: () => <div />,
}));

import { InquiryDetailModal, type InquiryDetailModalData } from "./inquiry-detail-modal";

const detail: InquiryDetailModalData = {
  inquiryId: "inq-1",
  locale: "en",
  name: "Alice",
  email: "alice@example.com",
  phone: null,
  preferredContact: "email",
  status: "inquiry",
  eventType: "wedding",
  guestCount: null,
  location: null,
  message: "Hello",
  sessions: [],
  submittedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  bookingMissing: false,
  booking: null,
  isOwner: true,
};

describe("InquiryDetailModal", () => {
  it("forwards onInquiryChanged to ClientInfoCard and BookingDraftCard", () => {
    const onInquiryChanged = vi.fn();
    renderWithProviders(
      <InquiryDetailModal
        detail={detail}
        open
        onClose={vi.fn()}
        onInquiryChanged={onInquiryChanged}
      />
    );
    expect(screen.getByTestId("client-info-card").dataset.hasOnInquiryChanged).toBe("true");
    expect(screen.getByTestId("booking-draft-card").dataset.hasOnInquiryChanged).toBe("true");
  });
});
