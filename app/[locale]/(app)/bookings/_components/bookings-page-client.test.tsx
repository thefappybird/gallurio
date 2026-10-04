import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BookingsPageClient } from "./bookings-page-client";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("status=booked&page=3"),
}));

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/bookings",
}));

describe("BookingsPageClient", () => {
  it("pushes sort, dir and page=1 when a header is clicked", () => {
    const { container } = renderWithProviders(
      <BookingsPageClient
        rows={[
          {
            id: "1",
            title: "Carter Wedding",
            clientName: "Emma",
            sessions: [{ startAt: "2026-05-01T10:00:00Z", endAt: "2026-05-01T12:00:00Z" }],
            lastSessionEnd: "2026-05-01T12:00:00Z",
            status: "booked",
            total: 100,
            currency: "PHP",
            bookedAt: null,
          },
        ]}
        total={40}
        page={3}
        limit={10}
        pageSizeOptions={[10, 20, 30]}
        sortKey="bookedAt"
        sortDir="desc"
        locale="en"
        empty="none"
      />
    );
    const table = container.querySelector("table") as HTMLElement;
    fireEvent.click(within(table).getByRole("button", { name: /^booking/i }));
    expect(mockPush).toHaveBeenCalledWith(
      "/bookings?status=booked&page=1&sort=title&dir=asc"
    );
    expect(screen.getByText("Carter Wedding", { selector: "td span" })).toBeInTheDocument();
  });

  it("pins the current limit in the URL when paging", () => {
    renderWithProviders(
      <BookingsPageClient
        rows={[]}
        total={40}
        page={3}
        limit={10}
        pageSizeOptions={[10, 20, 30]}
        sortKey="bookedAt"
        sortDir="desc"
        locale="en"
        empty="none"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenLastCalledWith(
      "/bookings?status=booked&page=4&limit=10"
    );
  });
});
