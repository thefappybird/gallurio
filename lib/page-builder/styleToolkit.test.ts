import { describe, it, expect } from "vitest";
import { resolveBlockStyle, colorTokenToVar, type BlockStyle } from "./styleToolkit";

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

  it("overrides the brand font vars and fontFamily when a font pair is chosen", () => {
    const css = resolveBlockStyle({ fontPair: "playfair-inter" }) as Record<string, unknown>;
    expect(css["--pf-font-heading"]).toContain("playfair");
    expect(css["--pf-font-body"]).toContain("inter");
    expect(css.fontFamily).toContain("inter");
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

// ---------------------------------------------------------------------------
// coerceRichText
// ---------------------------------------------------------------------------

import { coerceRichText, resolveTextStyle, renderRichText } from "./styleToolkit";

describe("coerceRichText", () => {
  it("coerces a plain string to {text}", () => {
    expect(coerceRichText("hello")).toEqual({ text: "hello" });
  });

  it("passes through an object with text property", () => {
    const obj = { text: "world", style: { bold: true } };
    expect(coerceRichText(obj)).toEqual({ text: "world", style: { bold: true } });
  });

  it("coerces an object with text but no style to {text, style: undefined}", () => {
    const result = coerceRichText({ text: "just text" });
    expect(result.text).toBe("just text");
    expect(result.style).toBeUndefined();
  });

  it("returns {text:''} for undefined", () => {
    expect(coerceRichText(undefined)).toEqual({ text: "" });
  });

  it("returns {text:''} for null", () => {
    expect(coerceRichText(null)).toEqual({ text: "" });
  });

  it("returns {text:''} for a number", () => {
    expect(coerceRichText(42)).toEqual({ text: "" });
  });

  it("returns {text:''} for an array (not a text object)", () => {
    expect(coerceRichText(["a", "b"])).toEqual({ text: "" });
  });

  it("returns {text:''} when an object has a non-string text property", () => {
    expect(coerceRichText({ text: 999 })).toEqual({ text: "" });
  });

  it("preserves the style field from a full RichText object", () => {
    const style = { bold: true, italic: false, align: "center" as const };
    const result = coerceRichText({ text: "styled", style });
    expect(result.style).toEqual(style);
  });
});

// ---------------------------------------------------------------------------
// resolveTextStyle
// ---------------------------------------------------------------------------

describe("resolveTextStyle", () => {
  it("returns {} for undefined", () => {
    expect(resolveTextStyle(undefined)).toEqual({});
  });

  it("returns {} for null", () => {
    expect(resolveTextStyle(null)).toEqual({});
  });

  it("returns {} for an empty style object", () => {
    expect(resolveTextStyle({})).toEqual({});
  });

  it("maps textColorToken to its CSS var", () => {
    const css = resolveTextStyle({ textColorToken: "accent" });
    expect(css.color).toBe("var(--pf-color-accent)");
  });

  it("maps all five color tokens correctly", () => {
    expect(resolveTextStyle({ textColorToken: "primary" }).color).toBe("var(--pf-color-primary)");
    expect(resolveTextStyle({ textColorToken: "secondary" }).color).toBe("var(--pf-color-secondary)");
    expect(resolveTextStyle({ textColorToken: "background" }).color).toBe("var(--pf-color-bg)");
    expect(resolveTextStyle({ textColorToken: "foreground" }).color).toBe("var(--pf-color-fg)");
  });

  it("maps highlightColorToken to backgroundColor + boxDecorationBreak", () => {
    const css = resolveTextStyle({ highlightColorToken: "accent" });
    expect(css.backgroundColor).toBe("var(--pf-color-accent)");
    expect(css.boxDecorationBreak).toBe("clone");
    // Vendor-prefixed version also set
    expect((css as Record<string, unknown>).WebkitBoxDecorationBreak).toBe("clone");
  });

  it("does NOT set backgroundColor when no highlightColorToken is given", () => {
    const css = resolveTextStyle({ textColorToken: "primary" });
    expect(css.backgroundColor).toBeUndefined();
    expect(css.boxDecorationBreak).toBeUndefined();
  });

  it("maps fontFamily to its CSS family string via fontFamilyValue", () => {
    const css = resolveTextStyle({ fontFamily: "playfair" });
    expect(css.fontFamily).toContain("playfair");
  });

  it("does NOT set fontFamily for an unknown key", () => {
    // TypeScript won't normally allow this, but we cast to test defensive path
    const css = resolveTextStyle({ fontFamily: "comic-sans" as never });
    expect(css.fontFamily).toBeUndefined();
  });

  it("clamps fontSize to STYLE_LIMITS.fontSize.min (10)", () => {
    const css = resolveTextStyle({ fontSize: 2 });
    expect(css.fontSize).toBe("10px");
  });

  it("clamps fontSize to STYLE_LIMITS.fontSize.max (120)", () => {
    const css = resolveTextStyle({ fontSize: 9999 });
    expect(css.fontSize).toBe("120px");
  });

  it("passes through a valid fontSize in-range", () => {
    const css = resolveTextStyle({ fontSize: 24 });
    expect(css.fontSize).toBe("24px");
  });

  it("maps bold → fontWeight 700", () => {
    expect(resolveTextStyle({ bold: true }).fontWeight).toBe(700);
  });

  it("does NOT set fontWeight when bold is false", () => {
    expect(resolveTextStyle({ bold: false }).fontWeight).toBeUndefined();
  });

  it("maps italic → fontStyle 'italic'", () => {
    expect(resolveTextStyle({ italic: true }).fontStyle).toBe("italic");
  });

  it("maps underline → textDecoration 'underline'", () => {
    expect(resolveTextStyle({ underline: true }).textDecoration).toBe("underline");
  });

  it("maps alignment values correctly", () => {
    expect(resolveTextStyle({ align: "left" }).textAlign).toBe("left");
    expect(resolveTextStyle({ align: "center" }).textAlign).toBe("center");
    expect(resolveTextStyle({ align: "right" }).textAlign).toBe("right");
  });

  it("combines multiple style properties correctly", () => {
    const css = resolveTextStyle({
      bold: true,
      italic: true,
      underline: true,
      align: "center",
      textColorToken: "primary",
      fontSize: 18,
    });
    expect(css.fontWeight).toBe(700);
    expect(css.fontStyle).toBe("italic");
    expect(css.textDecoration).toBe("underline");
    expect(css.textAlign).toBe("center");
    expect(css.color).toBe("var(--pf-color-primary)");
    expect(css.fontSize).toBe("18px");
  });
});

// ---------------------------------------------------------------------------
// renderRichText
// ---------------------------------------------------------------------------

describe("renderRichText", () => {
  it("returns {text, css} combining coerceRichText + resolveTextStyle", () => {
    const result = renderRichText({ text: "hello", style: { bold: true } });
    expect(result.text).toBe("hello");
    expect(result.css.fontWeight).toBe(700);
  });

  it("returns {text: '', css: {}} for undefined input", () => {
    const result = renderRichText(undefined);
    expect(result.text).toBe("");
    expect(result.css).toEqual({});
  });

  it("handles a legacy plain string as input", () => {
    const result = renderRichText("plain text");
    expect(result.text).toBe("plain text");
    expect(result.css).toEqual({});
  });

  it("handles null gracefully", () => {
    const result = renderRichText(null);
    expect(result.text).toBe("");
    expect(result.css).toEqual({});
  });

  it("returns css with color for textColorToken set in style", () => {
    const result = renderRichText({ text: "colored", style: { textColorToken: "accent" } });
    expect(result.css.color).toBe("var(--pf-color-accent)");
  });
});
