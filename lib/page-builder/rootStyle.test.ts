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

  it("maps padding and margin X/Y to per-side CSS", () => {
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
});
