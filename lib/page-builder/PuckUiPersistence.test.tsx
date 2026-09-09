import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { PuckUiPersistence, type PersistedPuckUi } from "./PuckUiPersistence";
import { usePuckStore } from "./puckHooks";

vi.mock("./puckHooks", () => ({
  usePuckStore: vi.fn(),
}));

type StoreLike = {
  appState: { ui: { leftSideBarVisible: boolean; rightSideBarVisible: boolean; componentList?: Record<string, unknown> } };
  selectedItem: { props: { id?: string } } | null;
  dispatch: ReturnType<typeof vi.fn>;
  getSelectorForId: ReturnType<typeof vi.fn>;
};

function mountStore(overrides: Partial<StoreLike> = {}) {
  const dispatch = vi.fn();
  const getSelectorForId = vi.fn().mockReturnValue(undefined);
  const state: StoreLike = {
    appState: { ui: { leftSideBarVisible: true, rightSideBarVisible: true } },
    selectedItem: null,
    dispatch,
    getSelectorForId,
    ...overrides,
  };
  vi.mocked(usePuckStore).mockImplementation((selector) => selector(state as never));
  return { dispatch, getSelectorForId, state };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PuckUiPersistence — restore on mount", () => {
  it("restores leftSideBarVisible/rightSideBarVisible/componentList from the pending ref", async () => {
    const pendingUiRef = { current: { leftSideBarVisible: false, rightSideBarVisible: false, componentList: { manual: { expanded: false } } } as PersistedPuckUi | null };
    const { dispatch } = mountStore();

    await act(async () => {
      render(<PuckUiPersistence pendingUiRef={pendingUiRef} />);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setUi",
      ui: expect.objectContaining({
        leftSideBarVisible: false,
        rightSideBarVisible: false,
        componentList: { manual: { expanded: false } },
      }),
    });
  });

  it("does nothing when there is no pending snapshot (first-ever mount)", async () => {
    const pendingUiRef = { current: null as PersistedPuckUi | null };
    const { dispatch } = mountStore();

    await act(async () => {
      render(<PuckUiPersistence pendingUiRef={pendingUiRef} />);
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("resolves the pending selection by block id via getSelectorForId, not a stale raw itemSelector", async () => {
    const pendingUiRef = { current: { selectedBlockId: "block-42" } as PersistedPuckUi | null };
    const { dispatch, getSelectorForId } = mountStore();
    getSelectorForId.mockReturnValue({ zone: "root:default-zone", index: 3 });

    await act(async () => {
      render(<PuckUiPersistence pendingUiRef={pendingUiRef} />);
    });

    expect(getSelectorForId).toHaveBeenCalledWith("block-42");
    expect(dispatch).toHaveBeenCalledWith({
      type: "setUi",
      ui: expect.objectContaining({ itemSelector: { zone: "root:default-zone", index: 3 } }),
    });
  });

  it("does not select anything when the previously-selected block no longer exists", async () => {
    const pendingUiRef = { current: { selectedBlockId: "deleted-block" } as PersistedPuckUi | null };
    const { dispatch, getSelectorForId } = mountStore();
    getSelectorForId.mockReturnValue(undefined);

    await act(async () => {
      render(<PuckUiPersistence pendingUiRef={pendingUiRef} />);
    });

    for (const call of dispatch.mock.calls) {
      expect(call[0]?.ui?.itemSelector).toBeUndefined();
    }
  });
});

describe("PuckUiPersistence — continuous capture", () => {
  it("mirrors the live ui/selection into the ref so a later remount can restore it", async () => {
    const pendingUiRef = { current: null as PersistedPuckUi | null };
    mountStore({
      appState: { ui: { leftSideBarVisible: false, rightSideBarVisible: true, componentList: { gallery: { expanded: true } } } },
      selectedItem: { props: { id: "block-7" } },
    });

    await act(async () => {
      render(<PuckUiPersistence pendingUiRef={pendingUiRef} />);
    });

    expect(pendingUiRef.current).toMatchObject({
      leftSideBarVisible: false,
      rightSideBarVisible: true,
      componentList: { gallery: { expanded: true } },
      selectedBlockId: "block-7",
    });
  });
});
