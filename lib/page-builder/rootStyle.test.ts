import { describe, it, expect } from "vitest";
import { resolveRootStyle, type RootPageStyle } from "./rootStyle";

describe("resolveRootStyle", () => {
  it("returns an empty object for undefined", () => {
    expect(resolveRootStyle(undefined)).toEqual({});
  });

  it("applies a token background color", () => {
    const css = resolveRootStyle({ bgColorToken: "primary" });
    expect(css.backgroundColor).toBe("var(--pf-color-primary)");
  });

  it("folds opacity into the background color (color-mix), not the wrapper", () => {
    const css = resolveRootStyle({ bgColorToken: "#112233", bgOpacity: 50 } as RootPageStyle);
    expect(String(css.backgroundColor)).toContain("#112233");
    expect(String(css.backgroundColor)).toContain("50%");
    expect(css.opacity).toBeUndefined();
  });

  it("maps padding and margin X/Y to per-side CSS (legacy)", () => {
    const css = resolveRootStyle({
      paddingX: "16px",
      paddingY: "24px",
      marginX: "8px",
      marginY: "12px",
    });
    expect(css.paddingLeft).toBe("16px");
    expect(css.paddingRight).toBe("16px");
    expect(css.paddingTop).toBe("24px");
    expect(css.paddingBottom).toBe("24px");
    expect(css.marginLeft).toBe("8px");
    expect(css.marginRight).toBe("8px");
    expect(css.marginTop).toBe("12px");
    expect(css.marginBottom).toBe("12px");
  });

  it("per-side padding values override combined paddingX/Y", () => {
    const css = resolveRootStyle({
      paddingX: "16px",
      paddingY: "24px",
      paddingTop: "40px",
      paddingRight: "32px",
    });
    // paddingX sets left+right; paddingRight overrides right
    expect(css.paddingLeft).toBe("16px");
    expect(css.paddingRight).toBe("32px");
    // paddingY sets top+bottom; paddingTop overrides top
    expect(css.paddingTop).toBe("40px");
    expect(css.paddingBottom).toBe("24px");
  });

  it("per-side margin values override combined marginX/Y", () => {
    const css = resolveRootStyle({
      marginX: "8px",
      marginY: "12px",
      marginBottom: "50px",
      marginLeft: "20px",
    });
    expect(css.marginRight).toBe("8px");
    expect(css.marginLeft).toBe("20px");
    expect(css.marginTop).toBe("12px");
    expect(css.marginBottom).toBe("50px");
  });

  it("all 8 per-side fields map to correct CSS properties", () => {
    const css = resolveRootStyle({
      paddingTop: "1px",
      paddingRight: "2px",
      paddingBottom: "3px",
      paddingLeft: "4px",
      marginTop: "5px",
      marginRight: "6px",
      marginBottom: "7px",
      marginLeft: "8px",
    });
    expect(css.paddingTop).toBe("1px");
    expect(css.paddingRight).toBe("2px");
    expect(css.paddingBottom).toBe("3px");
    expect(css.paddingLeft).toBe("4px");
    expect(css.marginTop).toBe("5px");
    expect(css.marginRight).toBe("6px");
    expect(css.marginBottom).toBe("7px");
    expect(css.marginLeft).toBe("8px");
  });

  it("legacy paddingX-only style resolves without per-side fields", () => {
    const css = resolveRootStyle({ paddingX: "20px" });
    expect(css.paddingLeft).toBe("20px");
    expect(css.paddingRight).toBe("20px");
    expect(css.paddingTop).toBeUndefined();
    expect(css.paddingBottom).toBeUndefined();
  });
});
