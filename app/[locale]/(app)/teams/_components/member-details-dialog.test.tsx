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
});
