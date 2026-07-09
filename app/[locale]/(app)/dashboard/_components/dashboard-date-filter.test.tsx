import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { DashboardDateFilter } from "./dashboard-date-filter";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/dashboard",
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

describe("DashboardDateFilter — pending state", () => {
  it("reports a pending transition to the parent when Apply is clicked", () => {
    const onPendingChange = vi.fn();
    render(
      <DashboardDateFilter
        today="2026-07-09"
        currentMonth="2026-07"
        currentYear={2026}
        onPendingChange={onPendingChange}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: /filter/i }));
    fireEvent.click(screen.getByRole("tab", { name: /daily/i }));
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));

    expect(mockPush).toHaveBeenCalled();
    expect(onPendingChange.mock.calls).toContainEqual([true]);
    expect(onPendingChange.mock.calls.at(-1)).toEqual([false]);
  });
});
