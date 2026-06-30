import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { EditorContainerAnchor } from "./EditorContainerAnchor";
import { usePuckStore } from "@/lib/page-builder/puckHooks";

vi.mock("@/lib/page-builder/puckHooks", () => ({
  usePuckStore: vi.fn(),
}));

type StoreLike = {
  getItemById: (id: string) => { props: { minHeight?: string; content?: unknown[] } } | null;
  selectedItem: { props: { id?: string } } | null;
  dispatch: ReturnType<typeof vi.fn>;
  getSelectorForId: ReturnType<typeof vi.fn>;
};

// StoreLike is a partial stub; referenced in mountStore via `as never` below.
function mountStore(selectedItemId: string | null): { dispatch: ReturnType<typeof vi.fn> } {
  const dispatch = vi.fn();
  const getSelectorForId = vi.fn().mockReturnValue({ zone: "default-zone", index: 0 });

  const state: StoreLike = {
    // Return a non-null parent so height > 0 (anchor renders, not null).
    getItemById: () => ({ props: { minHeight: "auto", content: [] } }),
    selectedItem: selectedItemId != null ? { props: { id: selectedItemId } } : null,
    dispatch,
    getSelectorForId,
  };

  // ponytail: state is a minimal stub; `as never` lets TS accept it without importing
  // the full UsePuckStore<Config> type — the component only reads 4 fields.
  vi.mocked(usePuckStore).mockImplementation((selector) => selector(state as never));

  return { dispatch };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditorContainerAnchor selection-bounce guard", () => {
  it("does not dispatch when parentId === id (anchor id has no --anchor suffix — malformed draft)", async () => {
    // A draft-restored anchor whose id was NOT given the --anchor suffix:
    // id = "mycontainer", so parentId = "mycontainer".replace(/--anchor$/, "") = "mycontainer" = id.
    // Without the guard, the bounce dispatch would select the parent (same id),
    // triggering the useEffect again → React error #185 infinite loop.
    const anchorId = "mycontainer"; // wrong id — should be "mycontainer--anchor"
    const { dispatch } = mountStore(anchorId); // anchor selected

    await act(async () => {
      render(<EditorContainerAnchor id={anchorId} />);
    });

    // dispatch must NOT have been called: the guard must prevent the loop.
    expect(dispatch).not.toHaveBeenCalled();
  });
});
