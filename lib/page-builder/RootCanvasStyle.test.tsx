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
    // Must not use a bare `height:` that overrides content size (only min-height allowed).
    // We check the container CSS rule specifically does not set a fixed height.
    expect(css).not.toMatch(/[^-]height\s*:\s*(?!auto)[^;]+;/);
  });
});
