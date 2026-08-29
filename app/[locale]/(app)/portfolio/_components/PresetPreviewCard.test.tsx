import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import type { Config } from "@measured/puck";

// Puck's <Render> mounts the whole block tree — irrelevant to what this file
// asserts (the row's chrome and the popover's copy) and slow. Stand it in with
// a marker that still proves the preset key reaches the renderer.
vi.mock("@measured/puck", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@measured/puck")>()),
  Render: ({ data }: { data: { content: { type: string }[] } }) => (
    <div data-testid="mini-render">{data.content[0]?.type}</div>
  ),
}));

const { PresetDrawerItem, PresetPreviewCanvas } = await import("./PresetPreviewCard");

const CONFIG = { components: {} } as unknown as Config;
const CSS_VARS = { "--pf-color-bg": "#fcfcfb", "--pf-color-fg": "#111111" };

function renderItem() {
  return renderWithProviders(
    <PresetDrawerItem
      presetKey="HeroPreset"
      name="Immersive cover"
      description="A full-bleed cover image with the studio name over it."
      dragHint="Drag this block to add it to your page."
      previewLabel="Preview this block"
      config={CONFIG}
      cssVars={CSS_VARS}
    >
      <span>Immersive cover</span>
    </PresetDrawerItem>
  );
}

describe("PresetDrawerItem", () => {
  it("keeps the row name-only — the description is not inline", () => {
    renderItem();
    expect(screen.getByText("Immersive cover")).toBeInTheDocument();
    expect(
      screen.queryByText("A full-bleed cover image with the studio name over it.")
    ).not.toBeInTheDocument();
  });

  it("exposes a named preview control for keyboard and touch", () => {
    renderItem();
    expect(screen.getByRole("button", { name: "Preview this block" })).toBeInTheDocument();
  });

  it("opens the preview on focus, showing description and the drag hint", async () => {
    renderItem();
    const trigger = screen.getByRole("button", { name: "Preview this block" });
    trigger.focus();

    await waitFor(() => {
      expect(
        screen.getByText("A full-bleed cover image with the studio name over it.")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Drag this block to add it to your page.")).toBeInTheDocument();
  });

  it("waits out the hover delay instead of flashing open immediately", () => {
    vi.useFakeTimers();
    try {
      renderItem();
      fireEvent.pointerEnter(screen.getByText("Immersive cover"));
      // Below the 250ms threshold: still closed.
      vi.advanceTimersByTime(100);
      expect(screen.queryByText("Drag this block to add it to your page.")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // A drawer row is a drag source. If a press on the preview control bubbled to
  // Puck, grabbing the eye icon would start dragging the block instead.
  it("stops pointerdown on the preview control from reaching the row", async () => {
    const onRowPointerDown = vi.fn();
    renderWithProviders(
      <div onPointerDown={onRowPointerDown}>
        <PresetDrawerItem
          presetKey="HeroPreset"
          name="Immersive cover"
          description="desc"
          dragHint="hint"
          previewLabel="Preview this block"
          config={CONFIG}
          cssVars={CSS_VARS}
        >
          <span>Immersive cover</span>
        </PresetDrawerItem>
      </div>
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Preview this block" }));
    expect(onRowPointerDown).not.toHaveBeenCalled();
  });
});

describe("PresetPreviewCanvas", () => {
  it("renders the requested preset and carries the brand ground", () => {
    const { container } = renderWithProviders(
      <PresetPreviewCanvas presetKey="HeroPreset" config={CONFIG} cssVars={CSS_VARS} />
    );
    expect(screen.getByTestId("mini-render")).toHaveTextContent("HeroPreset");

    const frame = container.firstElementChild as HTMLElement;
    expect(frame.style.backgroundColor).toBe("var(--pf-color-bg)");
    // Decorative: the popover's own text is the accessible description, and
    // nothing inside a 19%-scale miniature should be reachable.
    expect(frame).toHaveAttribute("aria-hidden", "true");
    expect(frame.style.pointerEvents).toBe("none");
  });
});
