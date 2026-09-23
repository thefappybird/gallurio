/**
 * The left sidebar's Components/Outline tabs.
 *
 * Puck 0.21 replaced the single sidebar with an icon rail; 0.23 still exposes
 * the two panels as `Puck.Components` / `Puck.Outline`, so this composes them
 * into one tabbed column instead. Both are stubbed here — the panels are
 * Puck's, the tab wiring is ours.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

type Ui = { itemExpanded?: Record<string, boolean> };
type MockState = {
  appState: { data: { content: Array<{ type: string; props: { id: string } }> }; ui: Ui };
  dispatch: (action: unknown) => void;
};

const dispatch = vi.fn();
let mockState: MockState;

vi.mock("@puckeditor/core", () => ({
  Puck: Object.assign(() => null, {
    Components: () => <div data-testid="components-panel" />,
    Outline: () => <div data-testid="outline-panel" />,
  }),
}));

vi.mock("@/lib/page-builder/puckHooks", () => ({
  usePuckStore: (selector: (s: MockState) => unknown) => selector(mockState),
}));

const { EditorSideBar } = await import("./EditorSideBar");

beforeEach(() => {
  dispatch.mockClear();
  mockState = {
    appState: {
      data: { content: [{ type: "Navigation", props: { id: "nav-1" } }, { type: "PageBody", props: { id: "body-1" } }] },
      ui: {},
    },
    dispatch,
  };
});

describe("EditorSideBar", () => {
  it("shows the block tree first and swaps to the outline on demand", () => {
    renderWithProviders(<EditorSideBar />);

    expect(screen.getByTestId("components-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("outline-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Outline" }));

    expect(screen.getByTestId("outline-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("components-panel")).not.toBeInTheDocument();
  });

  it("expands PageBody the first time the outline is opened, and not again", () => {
    renderWithProviders(<EditorSideBar />);
    // Everything the owner edits lives inside PageBody, so an outline that
    // opens collapsed shows them nothing but the locked chrome.
    fireEvent.click(screen.getByRole("button", { name: "Outline" }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0][0] as { type: string; ui: (p: Ui) => Ui };
    expect(action.type).toBe("setUi");
    expect(action.ui({ itemExpanded: { "nav-1": false } })).toEqual({
      itemExpanded: { "nav-1": false, "body-1": true },
    });

    // Re-opening must not re-expand: that would fight an owner who collapsed it.
    fireEvent.click(screen.getByRole("button", { name: "Components" }));
    fireEvent.click(screen.getByRole("button", { name: "Outline" }));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
