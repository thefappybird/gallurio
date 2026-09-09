import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import type { Config } from "@measured/puck";
import { __resetPresetPreview, getActivePresetPreview } from "@/lib/page-builder/presetPreviewStore";
import { collectBlocks } from "@/lib/page-builder/blockTree";

// Puck's <Render> mounts the whole block tree — irrelevant to what this file
// asserts (the row's interaction contract) and slow. Stand it in with a marker
// that still proves the preset key reaches the renderer.
vi.mock("@measured/puck", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@measured/puck")>()),
  Render: ({ data }: { data: { content: { type: string }[] } }) => (
    <div data-testid="mini-render">{data.content[0]?.type}</div>
  ),
}));

const {
  PresetDrawerItem,
  ManualDrawerItem,
  PresetPreviewCanvas,
  PresetPreviewPanel,
  buildPresetPreviewData,
  getPreviewFrameHeight,
  FRAME_WIDTH,
  PREVIEW_WIDTH,
  PREVIEW_MIN_HEIGHT,
  PREVIEW_MAX_HEIGHT,
} = await import("./PresetPreviewCard");

const DESCRIBE = () => ({ name: "Immersive cover", description: DESCRIPTION });

const CONFIG = { components: {} } as unknown as Config;
const CSS_VARS = { "--pf-color-bg": "#fcfcfb", "--pf-color-fg": "#111111" };
const DESCRIPTION = "A full-bleed cover image with the studio name over it.";

beforeEach(() => __resetPresetPreview());

/** A row plus the single shared panel, which is how the editor composes them. */
function renderItem(presetKey = "HeroPreset", name = "Immersive cover") {
  return renderWithProviders(
    <>
      <PresetDrawerItem presetKey={presetKey as never}>
        <span data-testid="row-label">{name}</span>
      </PresetDrawerItem>
      <PresetPreviewPanel
        config={CONFIG}
        cssVars={CSS_VARS}
        describe={DESCRIBE}
        dragHint="Drag this block to add it to your page."
      />
    </>
  );
}

describe("PresetDrawerItem", () => {
  it("keeps the row name-only — the description lives in the preview", () => {
    renderItem();
    expect(screen.getByTestId("row-label")).toHaveTextContent("Immersive cover");
    expect(screen.queryByText(DESCRIPTION)).not.toBeInTheDocument();
  });

  it("no longer renders a separate preview control", () => {
    renderItem();
    expect(screen.queryByRole("button", { name: /Preview this block/i })).not.toBeInTheDocument();
  });

  it("renders no panel until something is opened", () => {
    renderItem();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on hover", async () => {
    renderItem();
    fireEvent.pointerEnter(screen.getByTestId("row-label"));
    await waitFor(() => expect(screen.getByText(DESCRIPTION)).toBeInTheDocument());
  });

  it("makes Puck's otherwise non-focusable drawer row keyboard reachable", () => {
    renderItem();
    expect(screen.getByTestId("row-label").parentElement).toHaveAttribute("tabindex", "0");
  });

  it("opens on click", async () => {
    renderItem();
    fireEvent.click(screen.getByTestId("row-label"));
    await waitFor(() => expect(screen.getByText(DESCRIPTION)).toBeInTheDocument());
  });

  // The product contract: leaving the row must NOT dismiss it, so the user can
  // move the pointer toward the panel without it vanishing.
  it("stays open when the pointer merely leaves the row", async () => {
    renderItem();
    const row = screen.getByTestId("row-label");
    fireEvent.pointerEnter(row);
    await waitFor(() => expect(screen.getByText(DESCRIPTION)).toBeInTheDocument());

    fireEvent.pointerLeave(row);

    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument();
    expect(getActivePresetPreview()).toBe("HeroPreset");
  });

  // Puck mounts each drawer row twice (draggable + ghost). Two rows for the SAME
  // preset must agree rather than fight — the old per-row state is what made the
  // panel flicker.
  it("two mounts of the same row do not fight over the open state", async () => {
    renderWithProviders(
      <>
        <PresetDrawerItem presetKey={"HeroPreset" as never}>
          <span data-testid="real">Immersive cover</span>
        </PresetDrawerItem>
        <PresetDrawerItem presetKey={"HeroPreset" as never}>
          <span data-testid="ghost">Immersive cover</span>
        </PresetDrawerItem>
        <PresetPreviewPanel
          config={CONFIG}
          cssVars={CSS_VARS}
          describe={DESCRIBE}
          dragHint="hint"
        />
      </>
    );

    fireEvent.pointerEnter(screen.getByTestId("real"));
    fireEvent.pointerLeave(screen.getByTestId("real"));
    fireEvent.pointerEnter(screen.getByTestId("ghost"));

    expect(getActivePresetPreview()).toBe("HeroPreset");
    // The decisive one: two rows, still ONE card. A panel per row is what
    // produced two stacked copies in the browser.
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  });

  it("a pointerdown outside the row and panel closes it", async () => {
    renderItem();
    fireEvent.click(screen.getByTestId("row-label"));
    await waitFor(() => expect(screen.getByText(DESCRIPTION)).toBeInTheDocument());

    fireEvent.pointerDown(document.body);

    await waitFor(() => expect(getActivePresetPreview()).toBeNull());
  });

  it("Escape closes it", async () => {
    renderItem();
    fireEvent.click(screen.getByTestId("row-label"));
    await waitFor(() => expect(screen.getByText(DESCRIPTION)).toBeInTheDocument());

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(getActivePresetPreview()).toBeNull());
  });

  it("starting a drag closes it, so the panel never rides along", async () => {
    renderItem();
    fireEvent.click(screen.getByTestId("row-label"));
    await waitFor(() => expect(screen.getByText(DESCRIPTION)).toBeInTheDocument());

    fireEvent.dragStart(screen.getByTestId("row-label"));

    await waitFor(() => expect(getActivePresetPreview()).toBeNull());
  });
});

describe("PresetPreviewCanvas", () => {
  it("assigns stable unique ids to every nested preset block", () => {
    const data = buildPresetPreviewData("FeaturedWorkLeadPreset");
    const ids = collectBlocks(data).map((block) => block.props.id);

    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("renders the requested preset and carries the brand ground", () => {
    const { container } = renderWithProviders(
      <PresetPreviewCanvas presetKey={"HeroPreset" as never} config={CONFIG} cssVars={CSS_VARS} />
    );
    expect(screen.getByTestId("mini-render")).toHaveTextContent("HeroPreset");

    const frame = container.firstElementChild as HTMLElement;
    expect(frame.style.backgroundColor).toBe("var(--pf-color-bg)");
    // Decorative: the panel's own text is the accessible description, and
    // nothing inside a heavily-scaled miniature should be reachable.
    expect(frame).toHaveAttribute("aria-hidden", "true");
    expect(frame.style.pointerEvents).toBe("none");
  });

  it("scales the untransformed preset height exactly once", () => {
    expect(getPreviewFrameHeight(540)).toBeCloseTo(540 * (FRAME_WIDTH / PREVIEW_WIDTH), 5);
  });

  // The frame follows the preset's own rendered height rather than a fixed
  // 16:10 box, which cropped short blocks badly and over-boxed tall ones.
  it("clamps the measured height so the panel cannot grow without bound", () => {
    const { container } = renderWithProviders(
      <PresetPreviewCanvas presetKey={"HeroPreset" as never} config={CONFIG} cssVars={CSS_VARS} />
    );
    const frame = container.firstElementChild as HTMLElement;
    const height = parseFloat(frame.style.height);

    expect(height).toBeGreaterThanOrEqual(PREVIEW_MIN_HEIGHT);
    expect(height).toBeLessThanOrEqual(PREVIEW_MAX_HEIGHT);
  });
});

describe("ManualDrawerItem", () => {
  it("opens a text-only description on hover and focus", async () => {
    const describe = (key: string) =>
      key === "Heading"
        ? { name: "Heading", description: "Adds an editable heading." }
        : undefined;

    renderWithProviders(
      <>
        <ManualDrawerItem blockKey={"Heading" as never}>
          <button type="button">Heading row</button>
        </ManualDrawerItem>
        <PresetPreviewPanel
          config={CONFIG}
          cssVars={CSS_VARS}
          describe={describe}
          dragHint="Drag this block to add it to your page."
        />
      </>
    );

    const row = screen.getByRole("button", { name: "Heading row" });
    fireEvent.pointerEnter(row);
    expect(await screen.findByText("Adds an editable heading.")).toBeInTheDocument();
    expect(screen.queryByTestId("mini-render")).not.toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    fireEvent.focus(row);
    expect(await screen.findByText("Adds an editable heading.")).toBeInTheDocument();
    expect(screen.queryByTestId("mini-render")).not.toBeInTheDocument();
  });
});

describe("PresetPreviewPanel", () => {
  it("opts out of the editor root's direct-child height stretch", async () => {
    const { container } = renderItem();
    fireEvent.pointerEnter(screen.getByTestId("row-label"));
    const panel = await screen.findByRole("tooltip");

    expect(panel.style.height).toBe("fit-content");
    expect(container).toContainElement(panel);
  });
});
