import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { MemberDetailsDialog } from "./member-details-dialog";

vi.mock("../_member-action", () => ({ getMemberActivityAction: vi.fn() }));

const member = { workosUserId: "owner", name: "Ana", email: "ana@test.com", teams: [], bookingStats: { completed: 1, active: 2, future: 3 } };

describe("MemberDetailsDialog", () => {
  it("shows owner pill and labeled history filters with a loading skeleton", async () => {
    const { getMemberActivityAction } = await import("../_member-action");
    vi.mocked(getMemberActivityAction).mockReturnValue(new Promise(() => {}) as never);
    renderWithProviders(<MemberDetailsDialog member={member} teams={[]} ownerWorkosUserId="owner" open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Owner")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    expect(await screen.findByLabelText("From date")).toBeInTheDocument();
    expect(screen.getByLabelText("To date")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading activity history" })).toBeInTheDocument();
  });

  it("shows an error with Retry that refetches the history", async () => {
    const { getMemberActivityAction } = await import("../_member-action");
    vi.mocked(getMemberActivityAction).mockReset();
    vi.mocked(getMemberActivityAction).mockResolvedValue({ error: "boom" } as never);
    renderWithProviders(<MemberDetailsDialog member={member} teams={[]} ownerWorkosUserId="owner" open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    const retry = await screen.findByRole("button", { name: "Retry" }, { timeout: 4000 });
    vi.mocked(getMemberActivityAction).mockResolvedValue({
      items: [{ id: "a", entity: "booking", action: "created", createdAt: "2026-01-01T00:00:00.000Z" }],
      nextCursor: null,
    });
    fireEvent.click(retry);
    expect(await screen.findByText(/booking created/i)).toBeInTheDocument();
  });

  it("serves history from cache when the History tab is reopened (fetched once)", async () => {
    const { getMemberActivityAction } = await import("../_member-action");
    vi.mocked(getMemberActivityAction).mockReset();
    vi.mocked(getMemberActivityAction).mockResolvedValue({
      items: [{ id: "a", entity: "booking", action: "created", createdAt: "2026-01-01T00:00:00.000Z" }],
      nextCursor: null,
    });
    renderWithProviders(<MemberDetailsDialog member={member} teams={[]} ownerWorkosUserId="owner" open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    await screen.findByText(/booking created/i);
    fireEvent.click(screen.getByRole("tab", { name: "Details" }));
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    expect(await screen.findByText(/booking created/i)).toBeInTheDocument();
    expect(getMemberActivityAction).toHaveBeenCalledTimes(1);
  });

  it("sends date filters and loads the next cursor page", async () => {
    const { getMemberActivityAction } = await import("../_member-action");
    vi.mocked(getMemberActivityAction)
      .mockResolvedValueOnce({ items: [], nextCursor: "2026-01-02T00:00:00.000Z" })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    renderWithProviders(<MemberDetailsDialog member={member} teams={[]} ownerWorkosUserId="owner" open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    const from = await screen.findByLabelText("From date");
    fireEvent.change(from, { target: { value: "2026-01-01" } });
    await waitFor(() => expect(getMemberActivityAction).toHaveBeenCalled());
    expect(vi.mocked(getMemberActivityAction).mock.calls.some(([input]) => (
      typeof input === "object" && input !== null && "from" in input && Boolean(input.from)
    ))).toBe(true);
  });

  it("ignores a stale response when a newer request supersedes it before resolving", async () => {
    const { getMemberActivityAction } = await import("../_member-action");
    vi.mocked(getMemberActivityAction).mockReset();
    let resolveFirst!: (v: unknown) => void;
    let resolveSecond!: (v: unknown) => void;
    const first = new Promise((res) => {
      resolveFirst = res;
    });
    const second = new Promise((res) => {
      resolveSecond = res;
    });
    vi.mocked(getMemberActivityAction)
      .mockReturnValueOnce(first as never)
      .mockReturnValueOnce(second as never);

    renderWithProviders(<MemberDetailsDialog member={member} teams={[]} ownerWorkosUserId="owner" open onOpenChange={vi.fn()} />);
    // Switching to the History tab fires request #1 (left unresolved for now).
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    await waitFor(() => expect(getMemberActivityAction).toHaveBeenCalledTimes(1));
    const from = await screen.findByLabelText("From date");

    // A filter change supersedes it with request #2.
    fireEvent.change(from, { target: { value: "2026-01-02" } });
    await waitFor(() => expect(getMemberActivityAction).toHaveBeenCalledTimes(2));

    // Resolve the current (second) request first, then the stale first one.
    resolveSecond({
      items: [{ id: "current", entity: "booking", action: "created", createdAt: "2026-01-02T00:00:00.000Z" }],
      nextCursor: null,
    });
    await screen.findByText(/booking created/i);

    resolveFirst({
      items: [{ id: "stale", entity: "client", action: "updated", createdAt: "2026-01-01T00:00:00.000Z" }],
      nextCursor: null,
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByText(/client updated/i)).not.toBeInTheDocument();
    expect(screen.getByText(/booking created/i)).toBeInTheDocument();
  });

  it("ignores a stale Load More response when a filter change resets the list first", async () => {
    const { getMemberActivityAction } = await import("../_member-action");
    vi.mocked(getMemberActivityAction).mockReset();
    let resolveLoadMore!: (v: unknown) => void;
    let resolveFilterChange!: (v: unknown) => void;
    const loadMoreCall = new Promise((res) => {
      resolveLoadMore = res;
    });
    const filterChangeCall = new Promise((res) => {
      resolveFilterChange = res;
    });
    vi.mocked(getMemberActivityAction)
      // Initial History tab open: resolves immediately with a cursor so
      // "Load more" renders.
      .mockResolvedValueOnce({
        items: [{ id: "page1", entity: "booking", action: "created", createdAt: "2026-01-01T00:00:00.000Z" }],
        nextCursor: "2026-01-02T00:00:00.000Z",
      })
      // Load More click: left unresolved.
      .mockReturnValueOnce(loadMoreCall as never)
      // Filter change: left unresolved.
      .mockReturnValueOnce(filterChangeCall as never);

    renderWithProviders(<MemberDetailsDialog member={member} teams={[]} ownerWorkosUserId="owner" open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    await screen.findByText(/booking created/i);

    // Load More fires request #2 (in flight).
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(getMemberActivityAction).toHaveBeenCalledTimes(2));

    // A filter change fires request #3, resetting the list, before #2 resolves.
    const from = await screen.findByLabelText("From date");
    fireEvent.change(from, { target: { value: "2026-01-02" } });
    await waitFor(() => expect(getMemberActivityAction).toHaveBeenCalledTimes(3));

    // The filter change's response resolves first.
    resolveFilterChange({
      items: [{ id: "filtered", entity: "client", action: "updated", createdAt: "2026-01-02T00:00:00.000Z" }],
      nextCursor: null,
    });
    await screen.findByText(/client updated/i);

    // The stale Load More response resolves after — it must not land.
    resolveLoadMore({
      items: [{ id: "stale-more", entity: "inquiry", action: "created", createdAt: "2026-01-01T00:00:00.000Z" }],
      nextCursor: null,
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByText(/inquiry created/i)).not.toBeInTheDocument();
    expect(screen.getByText(/client updated/i)).toBeInTheDocument();
  });
});
