import { describe, it, expect } from "vitest";
import { resolveBlockStyle, resolveBlockAttrs } from "./styleToolkit";

describe("resolveBlockStyle — layout / spacing / sizing", () => {
  it("selfAlign left pins marginLeft 0, marginRight auto", () => {
    const css = resolveBlockStyle({ selfAlign: "left" });
    expect(css.marginLeft).toBe("0");
    expect(css.marginRight).toBe("auto");
  });

  it("selfAlign center sets margin auto on both sides", () => {
    const css = resolveBlockStyle({ selfAlign: "center" });
    expect(css.marginLeft).toBe("auto");
    expect(css.marginRight).toBe("auto");
  });

  it("selfAlign right pins left auto, right 0", () => {
    const css = resolveBlockStyle({ selfAlign: "right" });
    expect(css.marginLeft).toBe("auto");
    expect(css.marginRight).toBe("0");
  });

  it("omits horizontal margins when selfAlign is not set", () => {
    const css = resolveBlockStyle({});
    expect(css.marginLeft).toBeUndefined();
    expect(css.marginRight).toBeUndefined();
  });

  it("applies unit-aware width/height verbatim", () => {
    const css = resolveBlockStyle({ width: "60%", height: "320px" });
    expect(css.width).toBe("60%");
    expect(css.height).toBe("320px");
  });

  it("applies per-side padding/margin strings", () => {
    const css = resolveBlockStyle({ paddingTop: "8px", paddingLeft: "5%", marginTop: "2rem", marginBottom: "10px" });
    expect(css.paddingTop).toBe("8px");
    expect(css.paddingLeft).toBe("5%");
    expect(css.marginTop).toBe("2rem");
    expect(css.marginBottom).toBe("10px");
  });

  it("maps colSpan/rowSpan to grid span (and ignores span of 1)", () => {
    expect(resolveBlockStyle({ colSpan: 2 }).gridColumn).toBe("span 2");
    expect(resolveBlockStyle({ rowSpan: 3 }).gridRow).toBe("span 3");
    expect(resolveBlockStyle({ colSpan: 1 }).gridColumn).toBeUndefined();
  });

  it("clamps grid span to 12", () => {
    expect(resolveBlockStyle({ colSpan: 99 }).gridColumn).toBe("span 12");
  });

  it("exposes animation duration as a CSS var only when an animation is set", () => {
    const css = resolveBlockStyle({ animation: "fade", animationDuration: 800 }) as Record<string, unknown>;
    expect(css["--pf-anim-duration"]).toBe("800ms");
    const none = resolveBlockStyle({ animation: "none", animationDuration: 800 }) as Record<string, unknown>;
    expect(none["--pf-anim-duration"]).toBeUndefined();
  });
});

describe("resolveBlockAttrs — motion data attributes", () => {
  it("emits data-anim / data-hover for active values", () => {
    expect(resolveBlockAttrs({ animation: "slide-up", hover: "scale" })).toEqual({
      "data-anim": "slide-up",
      "data-hover": "scale",
    });
  });

  it("omits 'none' values and empty styles", () => {
    expect(resolveBlockAttrs({ animation: "none", hover: "none" })).toEqual({});
    expect(resolveBlockAttrs(undefined)).toEqual({});
  });
});
