/**
 * BlockActionsToolbar renders nothing when no block is selected, and renders
 * action buttons (anchored to the selected block) when a root block is selected.
 * Depends on createUsePuck from @measured/puck — mocked here. The toolbar gates
 * on a measured anchor (block rect within the canvas band), so the selected-block
 * test stubs the DOM nodes + getBoundingClientRect the rAF loop reads.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { navigationPermissions } from "@/lib/page-builder/blocks/NavigationBlock";

type Permissions = { drag: boolean; duplicate: boolean; delete: boolean; edit: boolean; insert: boolean };

type SelectedItem = { type: string; props: { id: string } } | null;

type MockApi = {
  appState: {
    ui: { itemSelector: { index: number; zone?: string } | null };
    data: { content: unknown[] };
  };
  selectedItem: SelectedItem;
  dispatch: ReturnType<typeof vi.fn>;
  getPermissions: (params?: { item?: SelectedItem }) => Permissions;
};

// Mirrors Puck's own permission merge: full defaults, overridden per-type by
// the block's declared `permissions` (the real Navigation block's here).
function permissionsFor(item?: SelectedItem): Permissions {
  const base: Permissions = { drag: true, duplicate: true, delete: true, edit: true, insert: true };
  if (item?.type === "Navigation") return { ...base, ...navigationPermissions };
  return base;
}

let mockApi: MockApi = {
  appState: { ui: { itemSelector: null }, data: { content: [] } },
  selectedItem: null,
  dispatch: vi.fn(),
  getPermissions: ({ item } = {}) => permissionsFor(item),
};

vi.mock("@measured/puck", () => ({
  createUsePuck: () => (selector?: (api: MockApi) => unknown) =>
    selector ? selector(mockApi) : mockApi,
}));

const { BlockActionsToolbar, scrollParent } = await import("./BlockActionsToolbar");

// Append a DOM node with a stubbed bounding rect (jsdom returns zeros otherwise).
function mount(id: string, attr: string, rect: Partial<DOMRect>) {
  const el = document.createElement("div");
  if (attr === "canvas") el.setAttribute("data-tour-id", "canvas");
  else el.setAttribute("data-puck-component", id);
  el.getBoundingClientRect = () =>
    ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...rect }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  cleanup();
  document.querySelectorAll("[data-tour-id='canvas'],[data-puck-component]").forEach((n) => n.remove());
});

describe("scrollParent", () => {
  it("returns the nearest overflow:auto/scroll ancestor (the canvas viewport)", () => {
    const outer = document.createElement("div");
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    const inner = document.createElement("div");
    const block = document.createElement("div");
    inner.appendChild(block);
    scroller.appendChild(inner);
    outer.appendChild(scroller);
    document.body.appendChild(outer);
    expect(scrollParent(block)).toBe(scroller);
    outer.remove();
  });
});

describe("BlockActionsToolbar", () => {
  it("renders nothing when no item is selected", () => {
    mockApi = {
      appState: { ui: { itemSelector: null }, data: { content: [] } },
      selectedItem: null,
      dispatch: vi.fn(),
      getPermissions: ({ item } = {}) => permissionsFor(item),
    };
    const { container } = renderWithProviders(<BlockActionsToolbar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Move up disabled and Move down enabled for a root block at index 0", async () => {
    mockApi = {
      appState: { ui: { itemSelector: { index: 0 } }, data: { content: ["a"] } },
      selectedItem: { type: "Hero", props: { id: "hero-1" } },
      dispatch: vi.fn(),
      getPermissions: ({ item } = {}) => permissionsFor(item),
    };
    mount("", "canvas", { top: 100, bottom: 700, left: 0, right: 500, width: 500, height: 600 });
    mount("hero-1", "block", { top: 200, bottom: 400, left: 0, right: 500, width: 500, height: 200 });

    renderWithProviders(<BlockActionsToolbar />);
    expect(await screen.findByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).not.toBeDisabled();
  });

  it("hides when an editor panel (dialog) is open", async () => {
    mockApi = {
      appState: { ui: { itemSelector: { index: 0 } }, data: { content: ["a"] } },
      selectedItem: { type: "Hero", props: { id: "hero-2" } },
      dispatch: vi.fn(),
      getPermissions: ({ item } = {}) => permissionsFor(item),
    };
    mount("", "canvas", { top: 100, bottom: 700, left: 0, right: 500, width: 500, height: 600 });
    mount("hero-2", "block", { top: 200, bottom: 400, left: 0, right: 500, width: 500, height: 200 });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);

    renderWithProviders(<BlockActionsToolbar />);
    // Give the rAF loop a few frames; the toolbar must never appear.
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByRole("button", { name: "Move up" })).toBeNull();
    dialog.remove();
  });

  it("hides Duplicate and Delete for a block whose declared permissions forbid them (real Navigation block)", async () => {
    mockApi = {
      appState: { ui: { itemSelector: { index: 0 } }, data: { content: ["a"] } },
      selectedItem: { type: "Navigation", props: { id: "nav-1" } },
      dispatch: vi.fn(),
      getPermissions: ({ item } = {}) => permissionsFor(item),
    };
    mount("", "canvas", { top: 100, bottom: 700, left: 0, right: 500, width: 500, height: 600 });
    mount("nav-1", "block", { top: 200, bottom: 400, left: 0, right: 500, width: 500, height: 200 });

    renderWithProviders(<BlockActionsToolbar />);
    // Move up renders unconditionally (disabled at index 0) — use it to confirm the
    // toolbar mounted at all, so an absent Duplicate/Delete isn't just "not yet anchored".
    await screen.findByRole("button", { name: "Move up" });
    expect(screen.queryByRole("button", { name: "Duplicate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("still renders and dispatches Duplicate and Delete for an ordinary block", async () => {
    const dispatch = vi.fn();
    mockApi = {
      appState: { ui: { itemSelector: { index: 0 } }, data: { content: ["a"] } },
      selectedItem: { type: "Hero", props: { id: "hero-3" } },
      dispatch,
      getPermissions: ({ item } = {}) => permissionsFor(item),
    };
    mount("", "canvas", { top: 100, bottom: 700, left: 0, right: 500, width: 500, height: 600 });
    mount("hero-3", "block", { top: 200, bottom: 400, left: 0, right: 500, width: 500, height: 200 });

    renderWithProviders(<BlockActionsToolbar />);
    const duplicateBtn = await screen.findByRole("button", { name: "Duplicate" });
    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    duplicateBtn.click();
    deleteBtn.click();
    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});
