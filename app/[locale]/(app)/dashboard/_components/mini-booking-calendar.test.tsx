import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, enMessages } from "@/test-utils/render";
import { MiniBookingCalendar } from "./mini-booking-calendar";

const overriddenMessages = {
  ...enMessages,
  app: {
    ...enMessages.app,
    dashboard: {
      ...enMessages.app.dashboard,
      miniCalendar: {
        ...enMessages.app.dashboard.miniCalendar,
        prevMonth: "GO BACK A MONTH",
        nextMonth: "GO FORWARD A MONTH",
        jumpToToday: "JUMP TO TODAY MONTH",
        dayBookingCount: "{count, plural, other {# CUSTOM BOOKINGS}}",
      },
    },
  },
};

describe("MiniBookingCalendar", () => {
  it("renders the month name and year", () => {
    const month = new Date(2026, 4, 15); // May 2026
    renderWithProviders(
      <MiniBookingCalendar month={month} days={[]} locale="en" title="Booking calendar" teams={[]} />
    );
    expect(screen.getByText("Booking calendar")).toBeInTheDocument();
    expect(screen.getByText(/May 2026/)).toBeInTheDocument();
  });

  it("renders the right number of day cells for the month", () => {
    const month = new Date(2026, 1, 1); // February 2026 — 28 days
    renderWithProviders(
      <MiniBookingCalendar month={month} days={[]} locale="en" title="Calendar" teams={[]} />
    );
    // Day labels 1..28 are all rendered exactly once each.
    for (let d = 1; d <= 28; d += 1) {
      expect(screen.getAllByText(d.toString()).length).toBeGreaterThan(0);
    }
  });

  it("renders click-through link only for days with bookings", () => {
    const month = new Date(2026, 4, 1);
    const { container } = renderWithProviders(
      <MiniBookingCalendar
        month={month}
        days={[
          { date: "2026-05-05", count: 1 },
          { date: "2026-05-07", count: 3 },
        ]}
        locale="en"
        title="Calendar"
        teams={[]}
      />
    );
    const links = container.querySelectorAll(
      "a[href*='/bookings?view=calendar&date=']"
    );
    expect(links).toHaveLength(2);
  });

  it("disables the prev/next nav buttons and team select while a month fetch is in flight", async () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const month = new Date(2026, 4, 15);
    renderWithProviders(
      <MiniBookingCalendar
        month={month}
        days={[]}
        locale="en"
        title="Calendar"
        teams={[
          { id: "t1", name: "Team A", color: "#000000", isActive: true, isLead: false },
          { id: "t2", name: "Team B", color: "#111111", isActive: true, isLead: false },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /next month/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /next month/i })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: /previous month/i })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /filter by team/i })).toBeDisabled();
  });

  it("routes nav aria-labels and day-count labels through translations", () => {
    const month = new Date(2026, 4, 1);
    renderWithProviders(
      <MiniBookingCalendar
        month={month}
        days={[{ date: "2026-05-05", count: 1 }]}
        locale="en"
        title="Calendar"
        teams={[]}
      />,
      { messages: overriddenMessages }
    );
    expect(screen.getByRole("button", { name: "GO BACK A MONTH" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GO FORWARD A MONTH" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "JUMP TO TODAY MONTH" })).toBeInTheDocument();
    expect(screen.getByLabelText("1 CUSTOM BOOKINGS")).toBeInTheDocument();
  });

  it("aborts the in-flight fetch when the component unmounts before it resolves", async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise(() => {});
    }) as unknown as typeof fetch;
    const month = new Date(2026, 4, 15);
    const { unmount } = renderWithProviders(
      <MiniBookingCalendar month={month} days={[]} locale="en" title="Calendar" teams={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("serves cached rows for a month/team combo already fetched, without re-fetching", async () => {
    const rows = [{ date: "2026-06-05", count: 2 }];
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(rows) })
    ) as unknown as typeof fetch;
    global.fetch = fetchMock;
    const month = new Date(2026, 4, 15);
    renderWithProviders(
      <MiniBookingCalendar month={month} days={[]} locale="en" title="Calendar" teams={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getAllByText("2").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: /previous month/i }));
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));

    await waitFor(() => expect(screen.getAllByText("2").length).toBeGreaterThan(0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows an error with a retry button that refetches the month", async () => {
    const rows = [{ date: "2026-06-05", count: 2 }];
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve([]) })
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    renderWithProviders(
      <MiniBookingCalendar month={new Date(2026, 4, 15)} days={[]} locale="en" title="Calendar" teams={[]} />
    );
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    const retry = await screen.findByRole("button", { name: "Retry" }, { timeout: 4000 });
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(rows) }) as never
    );
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getAllByText("2").length).toBeGreaterThan(0));
  });

  it("does not cache a failed month fetch as empty, so revisiting it re-fetches", async () => {
    const rows = [{ date: "2026-06-05", count: 2 }];
    type MonthFetchResponse = {
      ok: boolean;
      status: number;
      json: () => Promise<{ date: string; count: number }[]>;
    };
    const fetchMock = vi.fn<() => Promise<MonthFetchResponse>>(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve([]) })
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const month = new Date(2026, 4, 15);
    renderWithProviders(
      <MiniBookingCalendar month={month} days={[]} locale="en" title="Calendar" teams={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // The first fetch for June failed; a second visit to June must re-fetch
    // rather than serve a poisoned "[]" cache entry.
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(rows) })
    );
    fireEvent.click(screen.getByRole("button", { name: /previous month/i }));
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByText("2").length).toBeGreaterThan(0));
  });
});
