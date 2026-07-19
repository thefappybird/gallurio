import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TableBookingManager } from "./table-booking-manager";
import { BookingsPendingShell } from "./bookings-pending-shell";

const replaceSpy = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace: replaceSpy }),
  usePathname: () => "/bookings",
}));

const bookingsToolbarPropsSpy = vi.fn();
vi.mock("./bookings-toolbar", () => ({
  BookingsToolbar: (props: { onAddClick: () => void }) => {
    bookingsToolbarPropsSpy(props);
    return (
      <button type="button" onClick={props.onAddClick}>
        Open booking wizard
      </button>
    );
  },
}));

vi.mock("./booking-wizard-modal", () => ({
  BookingWizardModal: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      Close booking wizard
    </button>
  ),
}));

const INVOICE_THEME = { preset: "classic" as const, main: "#1A1A1A", accent: "#FFFFFF" };

function renderManager() {
  return renderWithProviders(
    <BookingsPendingShell title="Bookings" view="table">
      <TableBookingManager
        defaultCurrency="PHP"
        locale="en"
        clients={[]}
        canCreate
        defaultTeamId="507f1f77bcf86cd799439011"
        teams={[]}
        selectedTeams={[]}
        isOwner
        writableTeams={[]}
        initialInvoiceTheme={INVOICE_THEME}
      />
    </BookingsPendingShell>
  );
}

describe("TableBookingManager", () => {
  beforeEach(() => {
    replaceSpy.mockReset();
    mockSearchParams = new URLSearchParams("add=1&detail=booking_1&edit=booking_1&date=2026-08-15&time=10:00");
  });

  it("clears add, date, time, edit, and detail params when the modal closes", () => {
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: /close booking wizard/i }));

    expect(replaceSpy).toHaveBeenCalledWith("/bookings", { scroll: false });
  });

  it("passes initialInvoiceTheme through to BookingsToolbar", () => {
    renderManager();
    expect(bookingsToolbarPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ initialInvoiceTheme: INVOICE_THEME })
    );
  });
});
