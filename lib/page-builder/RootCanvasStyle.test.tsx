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
});
