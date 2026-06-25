/**
 * MoveOutActionBar renders "Move out" only when a nested block is selected.
 * The component depends on usePuck() from @measured/puck — mocked here since
 * that hook requires a Puck Provider context.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ROOT_ZONE } from "@/lib/page-builder/moveBlockToRoot";

// Mock @measured/puck so we can control usePuck return values.
vi.mock("@measured/puck", () => ({
  ActionBar: Object.assign(
    ({ children }: { children: React.ReactNode }) => <div data-testid="action-bar">{children}</div>,
    {
      Action: ({ children, label }: { children: React.ReactNode; label?: string }) => (
        <button aria-label={label}>{children}</button>
      ),
    }
  ),
  usePuck: vi.fn(),
}));

// Lazy import after mock is registered.
const { usePuck } = await import("@measured/puck");
const { MoveOutActionBar } = await import("./MoveOutActionBar");

describe("MoveOutActionBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Move out button when a nested block is selected", () => {
    (usePuck as ReturnType<typeof vi.fn>).mockReturnValue({
      appState: {
        indexes: {
          nodes: { "block-1": { zone: "hero:content" } },
          zones: {
            "hero:content": { contentIds: ["block-1"] },
            [ROOT_ZONE]: { contentIds: ["hero"] },
          },
        },
      },
      selectedItem: { props: { id: "block-1" } },
      dispatch: vi.fn(),
    });

    render(<MoveOutActionBar parentAction={null}>{null}</MoveOutActionBar>);

    expect(screen.getByRole("button", { name: /move out/i })).toBeInTheDocument();
  });
});
