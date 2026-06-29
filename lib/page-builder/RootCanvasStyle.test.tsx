import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { rootCanvasCssText, buildCanvasCss, RootCanvasStyle } from "./RootCanvasStyle";
import { setCanvasDevice } from "./canvasViewportStore";

// RootCanvasStyle reads Puck state via usePuckStore; stub it out (no Puck context
// in this unit test) so the component renders and we can assert its injected CSS.
vi.mock("./puckHooks", () => ({
  usePuckStore: () => undefined,
}));

afterEach(cleanup);

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

  it("makes the Puck canvas column a scroll-through surface so edit-mode content pushes the layout", () => {
    const css = buildCanvasCss(undefined);
    // In edit mode, _PuckCanvas_ (the grid-area:editor flex column) has overflow:auto
    // which traps content in a local scroll rather than letting the page grow.
    // We target it via :has(> [data-tour-id="canvas"]) — same selector as the
    // min-height rule — and override overflow to clip (clips width overflows only)
    // so tall content can push the grid row taller instead of scrolling inside.
    expect(css).toContain("overflow: clip");
  });

  it("removes absolute pinning from Puck canvas-root so edit-mode content is not height-clamped", () => {
    const css = buildCanvasCss(undefined);
    // _PuckCanvas-root_ has position:absolute; top:0; bottom:0 which pins its height to
    // its positioned parent, so the page surface ([data-puck-preview]) can't grow. We
    // target that wrapper by its STABLE relationship — it is the direct parent of
    // [data-puck-preview] — and override to position:relative + height:auto so the
    // surface grows with content. (A fixed-depth `> * > *` selector missed it: Puck
    // nests the surface several levels deep, not two.)
    expect(css).toContain(":has(> [data-puck-preview])");
    expect(css).toMatch(/:has\(> \[data-puck-preview\]\)\s*{[^}]*position: relative/);
  });

  it("clamps the canvas surface width to the selected device width (non-desktop)", () => {
    const css = buildCanvasCss(undefined, { deviceWidth: 390, zoom: 1 });
    expect(css).toMatch(/\[data-puck-preview\]\s*{[^}]*width: 390px/);
    expect(css).toContain("margin-inline: auto");
  });

  it("re-injects the canvas <style> with the device-width clamp when the viewport store changes", () => {
    render(<RootCanvasStyle />);
    act(() => setCanvasDevice("mobile"));
    const tag = document.getElementById("pf-root-canvas-style");
    expect(tag?.textContent).toContain("width: 390px");
    act(() => setCanvasDevice("desktop")); // reset shared store
  });

  // C6: canvas must materialize the brand background so Luxury theme shows correctly
  it("materializes var(--pf-color-bg) as canvas background so brand bg shows in editor (C6)", () => {
    const css = buildCanvasCss(undefined);
    // Must inject a background-color rule using the brand bg var on the canvas surface
    expect(css).toContain("background-color: var(--pf-color-bg)");
    // Must appear BEFORE any explicit rootRule (so explicit overrides still win)
    const bgIdx = css.indexOf("background-color: var(--pf-color-bg)");
    // rootRule for explicit bgColorToken appears only when style has bgColorToken set
    const explicitBgCss = buildCanvasCss({ bgColorToken: "primary" });
    const explicitBgIdx = explicitBgCss.lastIndexOf("background-color");
    expect(bgIdx).toBeGreaterThan(-1);
    expect(explicitBgIdx).toBeGreaterThan(bgIdx);
  });
});
