import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockReplace = vi.hoisted(() => vi.fn());

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/bookings",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("./bookings-pending-shell", () => ({
  useBookingsToolbarPending: () => undefined,
  useBookingsWindowPending: () => undefined,
}));
vi.mock("./bookings-toolbar", () => ({
  BookingsToolbar: ({ onAddClick }: { onAddClick: () => void }) => (
    <button onClick={onAddClick}>New Booking</button>
  ),
}));
vi.mock("./calendar-view", () => ({
  CalendarView: ({ externalAddNonce }: { externalAddNonce: number }) => (
    <div data-testid="nonce">{externalAddNonce}</div>
  ),
}));

import { CalendarBookingManager } from "./calendar-booking-manager";

function renderManager() {
  return render(
    <CalendarBookingManager
      events={[]}
      defaultCurrency="PHP"
      locale="en"
      messages={{} as never}
      canCreate
      defaultTeamId="t1"
      teams={[]}
      selectedTeams={[]}
      isOwner
      writableTeams={[]}
      colorMode="status"
      teamColorMap={{}}
      window={{ start: "2027-02-01T00:00:00Z", end: "2027-04-01T00:00:00Z" }}
    />,
  );
}

describe("CalendarBookingManager New Booking", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    window.history.replaceState(null, "", "/bookings?date=2027-03-01&time=09:00");
  });

  it("keeps ?date, sets ?add=1 via history only, and fires no router.replace", () => {
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "New Booking" }));
    expect(window.location.search).toBe("?date=2027-03-01&add=1");
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId("nonce")).toHaveTextContent("1");
  });
});
