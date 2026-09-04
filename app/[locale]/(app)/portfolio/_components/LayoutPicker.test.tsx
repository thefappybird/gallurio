import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LayoutPicker, LayoutPreviewCard, renderPopupLayoutThumb } from "./LayoutPicker";
import { __resetLayoutPreview } from "@/lib/page-builder/layoutPreviewStore";

const OPTIONS = [
  { id: "a", label: "Option A", description: "Description A" },
  { id: "b", label: "Option B", description: "Description B" },
  { id: "c", label: "Option C", description: "Description C" },
];

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const OLD_CLOUD = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;

beforeEach(() => {
  __resetLayoutPreview();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
});

afterEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = OLD_CLOUD;
  vi.restoreAllMocks();
});

/** A picker plus the single shared preview card, which is how the panel composes them. */
function renderPicker(props: Partial<React.ComponentProps<typeof LayoutPicker>> = {}) {
  const onChange = props.onChange ?? vi.fn();
  render(
    <>
      <LayoutPicker
        ariaLabel="Test layout"
        options={OPTIONS}
        value="a"
        onChange={onChange}
        renderThumb={renderPopupLayoutThumb}
        {...props}
      />
      <LayoutPreviewCard />
    </>,
  );
  return { onChange };
}

describe("LayoutPicker", () => {
  it("renders a radiogroup with one radio per option and marks the selected one", () => {
    renderPicker({ value: "b" });

    const group = screen.getByRole("radiogroup", { name: "Test layout" });
    expect(group).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Option A" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "Option B" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Option C" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the clicked option id", () => {
    const { onChange } = renderPicker({ value: "a" });

    fireEvent.click(screen.getByRole("radio", { name: "Option C" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("moves selection with ArrowRight from the currently selected tile", () => {
    const { onChange } = renderPicker({ value: "a" });

    fireEvent.keyDown(screen.getByRole("radio", { name: "Option A" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("renders no preview card until a tile is hovered, focused, or clicked", () => {
    renderPicker();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens the shared preview card on hover, anchored to that tile", async () => {
    renderPicker();
    fireEvent.mouseEnter(screen.getByRole("radio", { name: "Option C" }));
    await waitFor(() => expect(screen.getByText("Description C")).toBeInTheDocument());
  });

  it("opens the shared preview card on focus (keyboard-reachable, not hover-only)", async () => {
    renderPicker();
    fireEvent.focus(screen.getByRole("radio", { name: "Option B" }));
    await waitFor(() => expect(screen.getByText("Description B")).toBeInTheDocument());
  });

  it("opens the shared preview card on click too", async () => {
    renderPicker();
    fireEvent.click(screen.getByRole("radio", { name: "Option A" }));
    await waitFor(() => expect(screen.getByText("Description A")).toBeInTheDocument());
  });

  it("swaps the card over when a different tile is hovered", async () => {
    renderPicker();
    fireEvent.mouseEnter(screen.getByRole("radio", { name: "Option A" }));
    await waitFor(() => expect(screen.getByText("Description A")).toBeInTheDocument());

    fireEvent.mouseEnter(screen.getByRole("radio", { name: "Option B" }));
    await waitFor(() => expect(screen.getByText("Description B")).toBeInTheDocument());
    expect(screen.queryByText("Description A")).not.toBeInTheDocument();
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  });

  // The product contract: leaving a tile must NOT dismiss the card, so the
  // user can move the pointer toward it (mirrors PresetPreviewCard).
  it("stays open when the pointer merely leaves the tile", async () => {
    renderPicker();
    const tile = screen.getByRole("radio", { name: "Option A" });
    fireEvent.mouseEnter(tile);
    await waitFor(() => expect(screen.getByText("Description A")).toBeInTheDocument());

    fireEvent.mouseLeave(tile);

    expect(screen.getByText("Description A")).toBeInTheDocument();
  });

  it("a pointerdown outside the card closes it", async () => {
    renderPicker();
    fireEvent.click(screen.getByRole("radio", { name: "Option A" }));
    await waitFor(() => expect(screen.getByText("Description A")).toBeInTheDocument());

    fireEvent.pointerDown(document.body);

    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("Escape closes the card", async () => {
    renderPicker();
    fireEvent.click(screen.getByRole("radio", { name: "Option A" }));
    await waitFor(() => expect(screen.getByText("Description A")).toBeInTheDocument());

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });
});

describe("LayoutPreviewCard", () => {
  it("shows the flat abstract fallback (no gradient) while loading", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves
    renderPicker();
    fireEvent.mouseEnter(screen.getByRole("radio", { name: "Option A" }));

    const card = await screen.findByRole("tooltip");
    const imageArea = card.querySelector('[class*="bg-muted"]') as HTMLElement;
    expect(imageArea).toBeTruthy();
    expect(imageArea.className).toContain("ring-foreground/10");
    expect(imageArea.className).not.toContain("gradient");
  });

  it("shows the flat abstract fallback when the workspace has no photos yet (empty)", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    renderPicker();
    fireEvent.mouseEnter(screen.getByRole("radio", { name: "Option A" }));

    await waitFor(() => expect(screen.getByText("Description A")).toBeInTheDocument());
    const card = screen.getByRole("tooltip");
    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector('[style*="background-image"]')).toBeNull();
  });

  it("shows the flat abstract fallback on a fetch error, never a broken-image icon", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    renderPicker();
    fireEvent.mouseEnter(screen.getByRole("radio", { name: "Option A" }));

    await waitFor(() => expect(screen.getByText("Description A")).toBeInTheDocument());
    const card = screen.getByRole("tooltip");
    expect(card.querySelector('[style*="background-image"]')).toBeNull();
  });

  it("fills the schematic's photo slots with real workspace photos once loaded (populated)", async () => {
    process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { id: "p1", publicId: "asset-1", thumbUrl: "https://x/1", caption: null, altText: null },
          { id: "p2", publicId: "asset-2", thumbUrl: "https://x/2", caption: null, altText: null },
        ],
      }),
    });
    renderPicker();
    fireEvent.mouseEnter(screen.getByRole("radio", { name: "Option A" }));

    await waitFor(() => {
      const card = screen.getByRole("tooltip");
      const filled = card.querySelector('[style*="background-image"]') as HTMLElement | null;
      expect(filled).toBeTruthy();
      expect(filled!.style.backgroundImage).toContain("asset-1");
    });
  });

  it("fetches from the same owner endpoint the media picker's All Photos feed uses", () => {
    renderPicker();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/portfolio/gallery/collections/all"),
    );
  });
});
