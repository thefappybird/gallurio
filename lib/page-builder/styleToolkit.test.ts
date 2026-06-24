import { describe, it, expect } from "vitest";
import { resolveBlockStyle, colorTokenToVar, asText, buildColorWithOpacity, FLEX_JUSTIFY_MAP, FLEX_ALIGN_MAP, HIGHLIGHT_SHAPES, HIGHLIGHT_SIZES, type BlockStyle } from "./styleToolkit";
import { headingDefaultProps, textDefaultProps } from "./blocks/manualBlocks";

// ---------------------------------------------------------------------------
// buildColorWithOpacity
// ---------------------------------------------------------------------------

describe("buildColorWithOpacity", () => {
  it("returns the color unchanged when opacity is 100", () => {
    expect(buildColorWithOpacity("var(--pf-color-primary)", 100)).toBe("var(--pf-color-primary)");
  });
});

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
    // No NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH in the test env → no backgroundImage.
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

  // Grid placement (colSpan / rowSpan) — these are the CSS properties that make
  // col-span and row-span controls actually work inside a Columns grid.
  it("colSpan=1 does NOT emit gridColumn (no-op — single cell is default)", () => {
    const css = resolveBlockStyle({ colSpan: 1 });
    expect((css as Record<string, unknown>).gridColumn).toBeUndefined();
  });

  it("colSpan=2 emits gridColumn: 'span 2'", () => {
    expect(resolveBlockStyle({ colSpan: 2 }).gridColumn).toBe("span 2");
  });

  it("colSpan=3 emits gridColumn: 'span 3'", () => {
    expect(resolveBlockStyle({ colSpan: 3 }).gridColumn).toBe("span 3");
  });

  it("colSpan=13 clamps to span 12 (max grid span)", () => {
    expect(resolveBlockStyle({ colSpan: 13 }).gridColumn).toBe("span 12");
  });

  it("rowSpan=1 does NOT emit gridRow", () => {
    const css = resolveBlockStyle({ rowSpan: 1 });
    expect((css as Record<string, unknown>).gridRow).toBeUndefined();
  });

  it("rowSpan=2 emits gridRow: 'span 2'", () => {
    expect(resolveBlockStyle({ rowSpan: 2 }).gridRow).toBe("span 2");
  });

  it("rowSpan=4 emits gridRow: 'span 4'", () => {
    expect(resolveBlockStyle({ rowSpan: 4 }).gridRow).toBe("span 4");
  });

  // Grid self-alignment: alignItems -> alignSelf so a block positions itself
  // within its Columns grid cell (not just textAlign for leaf text).
  it("alignItems maps to alignSelf for grid cell placement", () => {
    expect(resolveBlockStyle({ alignItems: "start" }).alignSelf).toBe("start");
    expect(resolveBlockStyle({ alignItems: "center" }).alignSelf).toBe("center");
    expect(resolveBlockStyle({ alignItems: "end" }).alignSelf).toBe("end");
    expect(resolveBlockStyle({ alignItems: "stretch" }).alignSelf).toBe("stretch");
  });

  // justifyContent -> justifySelf for inline axis positioning in the grid cell.
  // Flex-only values (between/around) have no justifySelf equivalent — skip them.
  it("justifyContent maps to justifySelf for grid cell inline-axis placement", () => {
    expect(resolveBlockStyle({ justifyContent: "start" }).justifySelf).toBe("start");
    expect(resolveBlockStyle({ justifyContent: "center" }).justifySelf).toBe("center");
    expect(resolveBlockStyle({ justifyContent: "end" }).justifySelf).toBe("end");
    // flex-only values do not produce justifySelf
    expect(resolveBlockStyle({ justifyContent: "between" }).justifySelf).toBeUndefined();
    expect(resolveBlockStyle({ justifyContent: "around" }).justifySelf).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// B1: headingDefaultProps and textDefaultProps ship textColorToken:"foreground"
// so the canvas and preview/public render the same color (var(--pf-color-fg)).
// ---------------------------------------------------------------------------

describe("default textColorToken on Heading and Text blocks", () => {
  it("headingDefaultProps has textColorToken set to 'foreground'", () => {
    expect(headingDefaultProps._style?.textColorToken).toBe("foreground");
  });

  it("textDefaultProps has textColorToken set to 'foreground'", () => {
    expect(textDefaultProps._style?.textColorToken).toBe("foreground");
  });

  it("resolveBlockStyle(headingDefaultProps._style) yields color: var(--pf-color-fg)", () => {
    expect(resolveBlockStyle(headingDefaultProps._style).color).toBe("var(--pf-color-fg)");
  });

  it("resolveBlockStyle(textDefaultProps._style) yields color: var(--pf-color-fg)", () => {
    expect(resolveBlockStyle(textDefaultProps._style).color).toBe("var(--pf-color-fg)");
  });
});
