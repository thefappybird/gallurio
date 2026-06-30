import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TableBookingManager } from "./table-booking-manager";

const replaceSpy = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace: replaceSpy }),
  usePathname: () => "/bookings",
}));

vi.mock("./bookings-toolbar", () => ({
  BookingsToolbar: ({ onAddClick }: { onAddClick: () => void }) => (
    <button type="button" onClick={onAddClick}>
      Open booking wizard
    </button>
  ),
}));

vi.mock("./booking-wizard-modal", () => ({
  BookingWizardModal: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      Close booking wizard
    </button>
  ),
}));

function renderManager() {
  return renderWithProviders(
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
    />
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
});
