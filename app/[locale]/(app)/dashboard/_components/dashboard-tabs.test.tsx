import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { DashboardTabs } from "./dashboard-tabs";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/dashboard",
}));

vi.mock("@/lib/dashboard-preferences", () => ({
  persistDashboardTab: vi.fn(),
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

describe("DashboardTabs — pending state", () => {
  it("reports a pending transition to the parent when switching tabs", () => {
    const onPendingChange = vi.fn();
    render(<DashboardTabs tab="bookings" onPendingChange={onPendingChange} />, { wrapper });

    fireEvent.click(screen.getByRole("tab", { name: /portfolio/i }));

    expect(mockPush).toHaveBeenCalled();
    expect(onPendingChange.mock.calls).toContainEqual([true]);
    expect(onPendingChange.mock.calls.at(-1)).toEqual([false]);
  });
});
