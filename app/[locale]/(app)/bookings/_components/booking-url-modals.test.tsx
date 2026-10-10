import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";

let mockSearch = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

// Mirrors the real modal: `open` is local state seeded true and never re-synced.
vi.mock("./booking-detail-modal", () => ({
  BookingDetailModal: ({ bookingId }: { bookingId: string }) => {
    const [open, setOpen] = useState(true);
    return open ? (
      <div role="dialog" aria-label={`detail ${bookingId}`}>
        <button type="button" onClick={() => setOpen(false)}>close</button>
      </div>
    ) : null;
  },
}));

vi.mock("./booking-wizard-modal", () => ({
  BookingWizardModal: ({ bookingId, mode }: { bookingId: string; mode: string }) => (
    <div role="dialog" aria-label={`${mode} ${bookingId}`} />
  ),
}));

import { BookingUrlModals } from "./booking-url-modals";

const VALID_A = "a".repeat(24);

beforeEach(() => {
  mockSearch = "";
});

describe("BookingUrlModals", () => {
  it("strips a malformed ?detail via replaceState and renders nothing", () => {
    mockSearch = "view=calendar&detail=nope";
    window.history.replaceState(null, "", "/en/bookings?view=calendar&detail=nope");
    const replace = vi.spyOn(window.history, "replaceState");

    const { container } = render(<BookingUrlModals locale="en" />);

    expect(replace).toHaveBeenCalledWith(window.history.state, "", "/en/bookings?view=calendar");
    expect(container.innerHTML).toBe("");
  });

  it("open A, close, then open B shows an open dialog for B", async () => {
    const VALID_B = "b".repeat(24);
    mockSearch = `detail=${VALID_A}`;
    const { rerender } = render(<BookingUrlModals locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: "close" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    // The close navigation is superseded: URL goes straight to another booking.
    mockSearch = `detail=${VALID_B}`;
    rerender(<BookingUrlModals locale="en" />);

    expect(await screen.findByRole("dialog", { name: `detail ${VALID_B}` })).toBeTruthy();
  });

  it("mounts the edit wizard in table view only", async () => {
    mockSearch = `edit=${VALID_A}`;
    const { rerender } = render(
      <BookingUrlModals locale="en" view="table" defaultCurrency="PHP" />
    );
    expect(await screen.findByRole("dialog", { name: `edit ${VALID_A}` })).toBeTruthy();

    rerender(<BookingUrlModals locale="en" view="calendar" defaultCurrency="PHP" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("mounts the detail modal for a valid id", async () => {
    mockSearch = `detail=${VALID_A}`;
    render(<BookingUrlModals locale="en" />);

    expect(await screen.findByRole("dialog", { name: `detail ${VALID_A}` })).toBeTruthy();
  });
});
