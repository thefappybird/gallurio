/**
 * BlockActionsToolbar renders nothing when no block is selected,
 * and renders action buttons when a root block is selected.
 * Depends on createUsePuck from @measured/puck — mocked here.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

type MockApi = {
  appState: {
    ui: { itemSelector: { index: number; zone?: string } | null };
    data: { content: unknown[] };
  };
  selectedItem: { type: string; props: { id: string } } | null;
  dispatch: ReturnType<typeof vi.fn>;
};

let mockApi: MockApi = {
  appState: { ui: { itemSelector: null }, data: { content: [] } },
  selectedItem: null,
  dispatch: vi.fn(),
};

vi.mock("@measured/puck", () => ({
  createUsePuck: () => (selector?: (api: MockApi) => unknown) =>
    selector ? selector(mockApi) : mockApi,
}));

const { BlockActionsToolbar } = await import("./BlockActionsToolbar");

describe("BlockActionsToolbar", () => {
  it("renders nothing when no item is selected", () => {
    mockApi = { appState: { ui: { itemSelector: null }, data: { content: [] } }, selectedItem: null, dispatch: vi.fn() };
    const { container } = render(<BlockActionsToolbar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Move up disabled and Move down enabled for a root block at index 0", () => {
    mockApi = {
      appState: { ui: { itemSelector: { index: 0 } }, data: { content: ["a"] } },
      selectedItem: { type: "Hero", props: { id: "hero-1" } },
      dispatch: vi.fn(),
    };
    render(<BlockActionsToolbar />);
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).not.toBeDisabled();
  });
});
