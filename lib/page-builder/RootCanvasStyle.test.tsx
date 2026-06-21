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
});
