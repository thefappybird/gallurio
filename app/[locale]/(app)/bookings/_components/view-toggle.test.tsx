import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { ViewToggle } from "./view-toggle";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/bookings",
}));

vi.mock("@/lib/view-preferences", () => ({
  BOOKINGS_VIEW_COOKIE_NAME: "gw_bookings_view",
  BOOKINGS_VIEW_STORAGE_KEY: "gw_bookings_view",
  persistViewPreference: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ViewToggle — pending state", () => {
  it("reports pending true then false around the navigation, and disables the toggle while pending", () => {
    const onPendingChange = vi.fn();
    render(<ViewToggle view="table" onPendingChange={onPendingChange} />, {
      wrapper,
    });

    const calendarOption = screen.getByRole("tab", { name: /calendar/i });
    fireEvent.click(calendarOption);

    expect(mockPush).toHaveBeenCalled();
    expect(onPendingChange.mock.calls).toContainEqual([true]);
    expect(onPendingChange.mock.calls.at(-1)).toEqual([false]);
  });
});
