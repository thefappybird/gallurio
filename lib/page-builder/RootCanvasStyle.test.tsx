import { describe, it, expect } from "vitest";
import { rootCanvasCssText, buildCanvasCss } from "./RootCanvasStyle";

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
});
