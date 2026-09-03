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
function mountStore(
  selectedItemId: string | null,
  content: Array<{ type: string }> = [],
): { dispatch: ReturnType<typeof vi.fn> } {
  const dispatch = vi.fn();
  const getSelectorForId = vi.fn().mockReturnValue({ zone: "default-zone", index: 0 });

  const state: StoreLike = {
    // Return a non-null parent so height > 0 (anchor renders, not null).
    getItemById: () => ({ props: { minHeight: "auto", content } }),
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

describe("EditorContainerAnchor height — container-class bridge case", () => {
  it("renders the 4px bridge footprint when the only real child is a Columns block", async () => {
    mountStore(null, [{ type: "Columns" }]);
    const { container } = await act(async () => render(<EditorContainerAnchor id="container--anchor" />));
    const el = container.querySelector(".pf-container-anchor") as HTMLElement;
    expect(el.style.height).toBe("4px");
  });

  it("renders the 4px bridge footprint when there are two container-class children", async () => {
    mountStore(null, [{ type: "Columns" }, { type: "Container" }]);
    const { container } = await act(async () => render(<EditorContainerAnchor id="container--anchor" />));
    const el = container.querySelector(".pf-container-anchor") as HTMLElement;
    expect(el.style.height).toBe("4px");
  });

});

describe("EditorContainerAnchor height — ordinary-content fill case (Item 11)", () => {
  it("renders a flex-fill anchor (no fixed height) when the only real child is ordinary content", async () => {
    mountStore(null, [{ type: "Heading" }]);
    const { container } = await act(async () => render(<EditorContainerAnchor id="container--anchor" />));
    const el = container.querySelector(".pf-container-anchor") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.flex).toBe("1 1 auto");
    expect(el.style.minHeight).toBe("0");
    expect(el.style.height).toBe("");
  });

  it("renders a flex-fill anchor when ordinary content sits alongside a container-class child", async () => {
    mountStore(null, [{ type: "Columns" }, { type: "Text" }]);
    const { container } = await act(async () => render(<EditorContainerAnchor id="container--anchor" />));
    const el = container.querySelector(".pf-container-anchor") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.flex).toBe("1 1 auto");
  });
});

describe("EditorContainerAnchor store-selector stability", () => {
  it("returns a reference-stable snapshot from every selector (getSnapshot must be cached)", async () => {
    // Regression: the mode selector used to build a fresh `{ kind, height }`
    // object on every call. usePuckStore reads through useSyncExternalStore,
    // which compares snapshots with Object.is → every read looked like a new
    // value → "The result of getSnapshot should be cached to avoid an
    // infinite loop" → "Maximum update depth exceeded" on /portfolio.
    const selectors: Array<(s: never) => unknown> = [];
    const state: StoreLike = {
      getItemById: () => ({ props: { minHeight: "auto", content: [{ type: "Heading" }] } }),
      selectedItem: null,
      dispatch: vi.fn(),
      getSelectorForId: vi.fn(),
    };
    vi.mocked(usePuckStore).mockImplementation((selector) => {
      selectors.push(selector as (s: never) => unknown);
      return selector(state as never);
    });

    await act(async () => render(<EditorContainerAnchor id="container--anchor" />));

    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(Object.is(selector(state as never), selector(state as never))).toBe(true);
    }
  });
});
