/**
 * BlockActionsToolbar renders nothing when no block is selected.
 * Depends on createUsePuck from @measured/puck — mocked here.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockPuckApi = {
  appState: {
    ui: { itemSelector: null },
    data: { content: [] },
  },
  selectedItem: null,
  dispatch: vi.fn(),
};

vi.mock("@measured/puck", () => ({
  createUsePuck: () => (selector?: (api: typeof mockPuckApi) => unknown) =>
    selector ? selector(mockPuckApi) : mockPuckApi,
}));

const { BlockActionsToolbar } = await import("./BlockActionsToolbar");

describe("BlockActionsToolbar", () => {
  it("renders nothing when no item is selected", () => {
    const { container } = render(<BlockActionsToolbar />);
    expect(container.firstChild).toBeNull();
  });
});
