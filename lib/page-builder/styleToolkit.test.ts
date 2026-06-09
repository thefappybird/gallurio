import { describe, it, expect } from "vitest";
import { resolveBlockStyle, colorTokenToVar, asText, FLEX_JUSTIFY_MAP, FLEX_ALIGN_MAP, HIGHLIGHT_SHAPES, HIGHLIGHT_SIZES, type BlockStyle } from "./styleToolkit";

describe("highlight option constants", () => {
  it("exposes the three band shapes in order", () => {
    expect(HIGHLIGHT_SHAPES).toEqual(["sharp", "subtle", "rounded"]);
  });
  it("exposes the three band sizes in order", () => {
    expect(HIGHLIGHT_SIZES).toEqual(["sm", "md", "lg"]);
  });
});

// ---------------------------------------------------------------------------
// asText
// ---------------------------------------------------------------------------

describe("asText", () => {
  it("returns a plain string unchanged", () => {
    expect(asText("hello")).toBe("hello");
  });

  it("extracts .text from a legacy {text} object", () => {
    expect(asText({ text: "hi" })).toBe("hi");
  });

  it("returns '' for an empty object", () => {
    expect(asText({})).toBe("");
  });

  it("returns '' for null", () => {
    expect(asText(null)).toBe("");
  });

  it("returns '' for undefined", () => {
    expect(asText(undefined)).toBe("");
  });

  it("returns '' for a number", () => {
    expect(asText(42)).toBe("");
  });

  it("returns '' when .text in the object is not a string", () => {
    expect(asText({ text: 999 })).toBe("");
  });
});

// ---------------------------------------------------------------------------
// resolveBlockStyle
// ---------------------------------------------------------------------------

describe("resolveBlockStyle", () => {
  it("returns an empty object for no style", () => {
    expect(resolveBlockStyle()).toEqual({});
    expect(resolveBlockStyle(null)).toEqual({});
    expect(resolveBlockStyle({})).toEqual({});
  });

  it("maps a border to width + token color var", () => {
    const css = resolveBlockStyle({ borderWidth: 2, borderColorToken: "accent" });
    expect(css.borderStyle).toBe("solid");
    expect(css.borderWidth).toBe("2px");
    expect(css.borderColor).toBe("var(--pf-color-accent)");
  });

  it("defaults border color to foreground when no token is given", () => {
    const css = resolveBlockStyle({ borderWidth: 1 });
    expect(css.borderColor).toBe("var(--pf-color-fg)");
  });

  it("ignores a zero border width", () => {
    const css = resolveBlockStyle({ borderWidth: 0 });
    expect(css.borderWidth).toBeUndefined();
  });

  it("clamps numeric values to their limits", () => {
    const css = resolveBlockStyle({ borderWidth: 9999, radius: -5, paddingY: 99999, fontSize: 2 });
    expect(css.borderWidth).toBe("12px"); // max
    expect(css.borderRadius).toBe("0px"); // min
    expect(css.paddingTop).toBe("200px"); // max
    expect(css.fontSize).toBe("10px"); // min
  });

  it("maps shadow size to a box-shadow and treats 'none' as absent", () => {
    expect(resolveBlockStyle({ shadow: "md" }).boxShadow).toBeTruthy();
    expect(resolveBlockStyle({ shadow: "none" }).boxShadow).toBeUndefined();
  });

  it("expands paddingX/Y and marginY into the long-hand properties", () => {
    const css = resolveBlockStyle({ paddingX: 16, paddingY: 24, marginY: 8 });
    expect(css.paddingLeft).toBe("16px");
    expect(css.paddingRight).toBe("16px");
    expect(css.paddingTop).toBe("24px");
    expect(css.paddingBottom).toBe("24px");
    expect(css.marginTop).toBe("8px");
    expect(css.marginBottom).toBe("8px");
  });

  it("maps a background color token to its var", () => {
    expect(resolveBlockStyle({ bgColorToken: "primary" }).backgroundColor).toBe("var(--pf-color-primary)");
  });

  it("overrides the brand font vars and fontFamily when a font pair is chosen (legacy fontPair)", () => {
    const css = resolveBlockStyle({ fontPair: "playfair-inter" }) as Record<string, unknown>;
    expect(css["--pf-font-heading"]).toContain("playfair");
    expect(css["--pf-font-body"]).toContain("inter");
    expect(css.fontFamily).toContain("inter");
  });

  it("sets --pf-font-heading, --pf-font-body, and fontFamily for a fontFamily key", () => {
    const css = resolveBlockStyle({ fontFamily: "playfair" }) as Record<string, unknown>;
    expect(css["--pf-font-heading"]).toContain("playfair");
    expect(css["--pf-font-body"]).toContain("playfair");
    expect(css.fontFamily).toContain("playfair");
  });

  it("maps text decoration toggles and alignment", () => {
    const style: BlockStyle = { bold: true, italic: true, underline: true, align: "center", textColorToken: "foreground" };
    const css = resolveBlockStyle(style);
    expect(css.fontWeight).toBe(700);
    expect(css.fontStyle).toBe("italic");
    expect(css.textDecoration).toBe("underline");
    expect(css.textAlign).toBe("center");
    expect(css.color).toBe("var(--pf-color-fg)");
  });

  it("omits a background image when the public cloud name is unset (test env)", () => {
    const css = resolveBlockStyle({ bgImagePublicId: "gallurio/x/y.jpg" });
    // No NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME in the test env → no backgroundImage.
    expect(css.backgroundImage).toBeUndefined();
  });
});

describe("colorTokenToVar", () => {
  it("maps each token and passes through undefined", () => {
    expect(colorTokenToVar("background")).toBe("var(--pf-color-bg)");
    expect(colorTokenToVar("foreground")).toBe("var(--pf-color-fg)");
    expect(colorTokenToVar(undefined)).toBeUndefined();
  });
});

describe("flex layout fields", () => {
  it("emits gap as a clamped px value", () => {
    expect(resolveBlockStyle({ gap: 16 }).gap).toBe("16px");
    expect(resolveBlockStyle({ gap: 0 }).gap).toBe("0px");
    expect(resolveBlockStyle({ gap: 999 }).gap).toBe("96px"); // clamped to max
    expect(resolveBlockStyle({ gap: -5 }).gap).toBe("0px");   // clamped to min
  });

  it("emits textAlign from alignItems so leaf blocks respond to the Align control", () => {
    expect(resolveBlockStyle({ alignItems: "start" }).textAlign).toBe("left");
    expect(resolveBlockStyle({ alignItems: "center" }).textAlign).toBe("center");
    expect(resolveBlockStyle({ alignItems: "end" }).textAlign).toBe("right");
    expect(resolveBlockStyle({ alignItems: "stretch" }).textAlign).toBeUndefined();
  });

  it("does NOT emit alignItems or justifyContent as CSS flex properties", () => {
    const css = resolveBlockStyle({ alignItems: "center", justifyContent: "between" });
    expect((css as Record<string, unknown>).alignItems).toBeUndefined();
    expect((css as Record<string, unknown>).justifyContent).toBeUndefined();
  });

  it("exports FLEX_JUSTIFY_MAP with correct CSS values", () => {
    expect(FLEX_JUSTIFY_MAP.start).toBe("flex-start");
    expect(FLEX_JUSTIFY_MAP.between).toBe("space-between");
    expect(FLEX_JUSTIFY_MAP.around).toBe("space-around");
    expect(FLEX_JUSTIFY_MAP.center).toBe("center");
    expect(FLEX_JUSTIFY_MAP.end).toBe("flex-end");
  });

  it("exports FLEX_ALIGN_MAP with correct CSS values", () => {
    expect(FLEX_ALIGN_MAP.start).toBe("flex-start");
    expect(FLEX_ALIGN_MAP.center).toBe("center");
    expect(FLEX_ALIGN_MAP.end).toBe("flex-end");
    expect(FLEX_ALIGN_MAP.stretch).toBe("stretch");
  });
});
