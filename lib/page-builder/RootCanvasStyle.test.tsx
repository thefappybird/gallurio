import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { rootCanvasCssText, buildCanvasCss, RootCanvasStyle } from "./RootCanvasStyle";
import { setCanvasDevice } from "./canvasViewportStore";
import { usePuckStore } from "./puckHooks";
import { BrandColorsContext } from "./brandColors";
import type { BrandColorMap } from "./brandColors";

const DEFAULT_COLORS: BrandColorMap = {
  primary: "#111",
  secondary: "#f5f5f5",
  accent: "#2f5d56",
  background: "#fff",
  foreground: "#111",
};

// RootCanvasStyle reads Puck state via usePuckStore; stub it out (no Puck context
// in this unit test) so the component renders and we can assert its injected CSS.
// Default returns undefined for any selector (no Puck data); individual tests can
// override via mockImplementation to exercise data-driven behavior.
vi.mock("./puckHooks", () => ({
  usePuckStore: vi.fn(() => undefined),
}));

// happy-dom actually attempts to fetch <link rel="stylesheet"> hrefs injected by
// GoogleFontLoader — stub fetch so tests never hit the real network.
vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("")));

afterEach(() => {
  cleanup();
  vi.mocked(usePuckStore).mockReset();
  document.querySelectorAll("link[data-google-font]").forEach((el) => el.remove());
});

describe("rootCanvasCssText", () => {
  it("produces a CSS text block for the canvas surface", () => {
    const css = rootCanvasCssText({ bgColorToken: "primary", paddingX: "10px" });
    expect(css).toContain("background-color");
    expect(css).toContain("var(--pf-color-primary)");
    expect(css).toContain("padding-left: 10px");
  });

  it("returns empty string for no style", () => {
    expect(rootCanvasCssText(undefined)).toBe("");
  });
});

describe("buildCanvasCss", () => {
  it("always makes the canvas surface the pfpage container and injects the responsive sheet", () => {
    const css = buildCanvasCss(undefined);
    expect(css).toContain("container-type: inline-size");
    expect(css).toContain("container-name: pfpage");
    expect(css).toContain("@container pfpage");
    expect(css).toContain("--pf-pad");
  });

  it("sets a theme-independent default text color on the canvas surface using the app foreground token", () => {
    const css = buildCanvasCss(undefined);
    // Must contain a rule that resets text color on [data-puck-preview] to the
    // stable app-shell token (--foreground), NOT any --pf-* brand variable.
    expect(css).toContain("[data-puck-preview]");
    expect(css).toContain("color: var(--foreground)");
    expect(css).not.toContain("color: var(--pf-color-fg)");
  });

  it("makes the canvas page grow to fit content — no fixed height that clips tall blocks", () => {
    const css = buildCanvasCss(undefined);
    // The canvas surface must have min-height set to allow content-driven growth.
    // A fixed `height` without min-height would clip tall viewport-height blocks.
    expect(css).toContain("min-height");
    // Must not use a bare `height:` with a non-auto value that overrides content size.
    // `height: auto` is allowed (content-driven); `min-height` is always allowed.
    // The lookbehind `(?<![-\w])` excludes `min-height`/`max-height` prefixes; the
    // fixed space after `:` avoids the \s* backtracking hole that causes false negatives
    // for `height: auto` (where the engine can skip the space and succeed the lookahead).
    expect(css).not.toMatch(/(?<![-\w])height: (?!auto)[^;]+;/);
  });

  it("overrides PuckPreview wrapper height so tall content is not clipped by the grid row", () => {
    const css = buildCanvasCss(undefined);
    // Puck's _PuckPreview_ element has `height: 100%` which pins it to the fixed
    // grid row height. We target it as the direct child of our canvas wrapper and
    // give it `height: auto` so content can push it taller.
    expect(css).toContain("[data-tour-id=\"canvas\"] > *");
    expect(css).toContain("height: auto");
  });

  it("overrides the Puck layout grid min-height so the grid itself grows with content", () => {
    const css = buildCanvasCss(undefined);
    // Puck's _PuckLayout-inner_ has `height: 100dvh` which caps the grid at viewport
    // height. We target its ancestor relationship with our canvas wrapper via :has()
    // and convert it to min-height so the grid can grow when content is taller.
    expect(css).toContain(":has(> [data-tour-id=\"canvas\"])");
    expect(css).toContain("min-height: 100dvh");
  });

  it("keeps the Puck canvas column horizontally scrollable while tall content can still grow", () => {
    const css = buildCanvasCss(undefined);
    // In edit mode, _PuckCanvas_ owns canvas scrolling. Keep horizontal overflow
    // reachable on constrained screens while the preview surface still wraps tall
    // content and paints its background down the full page.
    expect(css).toContain("overflow-x: auto");
    expect(css).toContain("overflow-y: auto");
  });

  it("removes absolute pinning from Puck canvas-root so edit-mode content is not height-clamped", () => {
    const css = buildCanvasCss(undefined);
    // _PuckCanvas-root_ has position:absolute; top:0; bottom:0 which pins its height to
    // its positioned parent, so the page surface ([data-puck-preview]) can't grow. We
    // target that wrapper by its STABLE relationship — it is the direct parent of
    // [data-puck-preview] — and override to position:relative + height:auto so the
    // surface grows with content. (A fixed-depth `> * > *` selector missed it: Puck
    // nests the surface several levels deep, not two.) Two selector alternatives are
    // joined by a comma: the spotlight tour's `preview:` Puck override wraps the
    // surface in a `[data-tour-id="canvas-viewport"]` marker div (for anchor
    // measurement), making [data-puck-preview] a grandchild in that case instead of
    // a direct child.
    expect(css).toContain(":has(> [data-puck-preview])");
    expect(css).toContain(':has(> [data-tour-id="canvas-viewport"] > [data-puck-preview])');
    expect(css).toMatch(
      /:has\(> \[data-puck-preview\]\), :has\(> \[data-tour-id="canvas-viewport"\] > \[data-puck-preview\]\)\s*{[^}]*position: relative/
    );
  });

  it("clamps the canvas surface width to the selected device width (non-desktop)", () => {
    const css = buildCanvasCss(undefined, { deviceWidth: 390, zoom: 1 });
    expect(css).toMatch(/\[data-puck-preview\]\s*{[^}]*width: 390px/);
    expect(css).toContain("margin-inline: auto");
  });

  it("clamps Puck's white canvas frame as well as the droppable preview surface", () => {
    const css = buildCanvasCss(undefined, { deviceWidth: 390, zoom: 1 });
    expect(css).toContain(":has(> [data-puck-preview])");
    expect(css).toContain("width: 390px !important");
  });

  it("reserves scrollable layout width for zoomed device previews", () => {
    const css = buildCanvasCss(undefined, { deviceWidth: 390, zoom: 1.5 });
    expect(css).toContain("width: 585px !important");
    expect(css).toContain("transform: scale(1.5)");
  });

  it("re-injects the canvas <style> with the device-width clamp when the viewport store changes", () => {
    render(<RootCanvasStyle />);
    act(() => setCanvasDevice("mobile"));
    const tag = document.getElementById("pf-root-canvas-style");
    expect(tag?.textContent).toContain("width: 390px");
    act(() => setCanvasDevice("desktop")); // reset shared store
  });

  it("loads the brand kit's Google Font heading selection via useEffectiveBrandFont", () => {
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, headingFont: "google:Lora" }}>
        <RootCanvasStyle />
      </BrandColorsContext.Provider>
    );
    expect(document.getElementById("pf-google-font-lora")).toBeTruthy();
  });

  it("loads a Google Font found in the puck block data (canvas/public parity, no EditorShell touch)", () => {
    vi.mocked(usePuckStore).mockImplementation((selector: Parameters<typeof usePuckStore>[0]) =>
      selector({
        appState: {
          data: {
            content: [{ type: "Heading", props: { _style: { fontFamily: "google:Poppins" } } }],
          },
        },
      } as Parameters<Parameters<typeof usePuckStore>[0]>[0])
    );
    render(<RootCanvasStyle />);
    expect(document.getElementById("pf-google-font-poppins")).toBeTruthy();
  });

  // C6: canvas must NOT auto-paint the brand background — only an explicit
  // bgColorToken on the page's root style should paint the canvas surface.
  it("does not auto-materialize var(--pf-color-bg) as canvas background (C6)", () => {
    const css = buildCanvasCss(undefined);
    expect(css).not.toContain("background-color: var(--pf-color-bg)");
  });

  it("still paints the canvas surface when the page root style sets an explicit bgColorToken", () => {
    const css = buildCanvasCss({ bgColorToken: "primary" });
    expect(css).toContain("background-color: var(--pf-color-primary)");
  });

  // Root cause: Puck's own CSS module hardcodes `._PuckCanvas-root_ { background:
  // white }` on the absolutely-positioned wrapper around [data-puck-preview] (the
  // same element CANVAS_PUCK_CANVAS_ROOT_CSS already retargets for position/height).
  // When the preview surface's own auto-height box doesn't fully cover that
  // ancestor (e.g. its :has() growth override losing a cascade/layout race on tall
  // pages), the wrapper's hardcoded white shows through below the first block. The
  // fix must paint that same wrapper, not just [data-puck-preview] itself.
  it("also paints the Puck canvas-root wrapper so its hardcoded white background never shows through below the first block", () => {
    const css = buildCanvasCss({ bgColorToken: "primary" });
    expect(css).toMatch(
      /:has\(> \[data-puck-preview\]\), :has\(> \[data-tour-id="canvas-viewport"\] > \[data-puck-preview\]\)[^{]*\{[^}]*background-color: var\(--pf-color-primary\)/
    );
  });
});
