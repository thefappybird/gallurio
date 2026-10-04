import { describe, expect, it, vi, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BookingHistoryDialog } from "./booking-history-dialog";

const ID = "booking-1";

function entry(n: number) {
  return {
    _id: `e${n}`,
    action: "updated",
    createdAt: "2030-01-01T10:00:00.000Z",
    actorUserId: "user_1",
    diff: { changes: { title: { before: `T${n - 1}`, after: `T${n}` } } },
  };
}

function page(p: number) {
  return {
    entries: [entry(p)],
    total: 12,
    page: p,
    pageSize: 5,
    actorNames: { user_1: "Alice Owner" },
  };
}

afterEach(() => vi.unstubAllGlobals());

function renderDialog() {
  return renderWithProviders(<BookingHistoryDialog bookingId={ID} open onClose={() => {}} locale="en" />);
}

describe("BookingHistoryDialog", () => {
  it("pages via the activity endpoint and never calls /api/users/names", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const p = Number(new URL(url, "http://x").searchParams.get("page"));
      return { ok: true, json: async () => page(p) };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();
    await screen.findByText("Page 1 of 3");
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("Page 2 of 3");
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls).toEqual([
      `/api/bookings/${ID}/activity?page=1&pageSize=5`,
      `/api/bookings/${ID}/activity?page=2&pageSize=5`,
    ]);
  });

  it("shows an error with Retry instead of failing silently", async () => {
    let fail = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (fail) return { ok: false, status: 500, json: async () => ({}) };
        return { ok: true, json: async () => page(Number(new URL(url, "http://x").searchParams.get("page"))) };
      })
    );
    renderDialog();
    const retry = await screen.findByRole("button", { name: "Retry" }, { timeout: 4000 });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the history.");
    fail = false;
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  }, 10000);
});
