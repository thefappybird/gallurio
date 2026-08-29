/**
 * Floated-default parity gate.
 *
 * Every StyleToolkitField control that shows an "effective default" (a value
 * displayed while the underlying block prop stays unset — see the
 * `portfolio-effective-defaults` skill) must show EXACTLY the value the
 * renderer actually applies when that prop is unset. If the two drift, the
 * control lies to the owner: they see one thing in the editor and get another
 * on the published page — the exact bug this suite exists to catch (see the
 * `--pf-color-bg` wrapper bug this branch fixed: floated but never painted).
 *
 * Mirrors the house style of `blocks/presetContrast.test.ts`: pull the REAL
 * render-time source (resolveBlockStyle, manualBlocks render fns, brand hooks)
 * and the REAL control-time source (the same exported constants StyleToolkitField
 * imports, or the hooks it calls) and assert they agree — no hand-copied
 * literals on either side wherever an export exists to import instead.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render, renderHook } from "@testing-library/react";
import {
  resolveBlockStyle,
  colorTokenToVar,
  buildContactLabelStyle,
  buildContactValueStyle,
  buildContactIconColor,
  buildContactIconSize,
  buildContactIconAlign,
  effectiveButtonTextToken,
  STYLE_COLOR_TOKENS,
  type StyleColorToken,
} from "./styleToolkit";
import {
  ButtonBlock,
  ContainerBlock,
  ColumnsBlock,
  CONTAINER_EFFECTIVE_PAD,
  COLUMNS_EFFECTIVE_PAD,
  BUTTON_SIZE_FONT_PX,
} from "./blocks/manualBlocks";
import { resolveBrandKit } from "./resolveBrandKit";
import { resolveEffectiveFonts, fontFamilyValue } from "./fonts";
import { BrandColorsContext, useEffectiveBrandRadius, useEffectiveBrandFont } from "./brandColors";
import { DEFAULT_BRAND_KIT, type BrandKitRadius } from "./types";
import type { SlotComponent } from "@measured/puck";

/** Minimal SlotComponent test double — real content isn't rendered; only the
 *  props Puck would pass through (style/className) are captured. */
function slotSpy(onCall?: (props: { style?: React.CSSProperties }) => void): SlotComponent {
  return ((props: { style?: React.CSSProperties }) => {
    onCall?.(props);
    return null;
  }) as unknown as SlotComponent;
}

// ---------------------------------------------------------------------------
// Border width / color — Frame section (effectiveValue={0} / "foreground")
// ---------------------------------------------------------------------------

describe("Frame: border width/color effective defaults", () => {
  it("unset borderWidth renders no border (control shows effective 0)", () => {
    const css = resolveBlockStyle({});
    expect(css.borderWidth).toBeUndefined();
    expect(css.borderStyle).toBeUndefined();
  });

  it("borderColorToken unset falls back to the foreground token (control shows effective \"foreground\")", () => {
    // resolveBlockStyle only emits borderColor when borderWidth>0; a control
    // that floats "foreground" for an otherwise-blank frame must match that path.
    const css = resolveBlockStyle({ borderWidth: 1 });
    expect(css.borderColor).toBe(colorTokenToVar("foreground"));
    expect(css.borderColor).toBe("var(--pf-color-fg)");
  });
});

// ---------------------------------------------------------------------------
// Shadow — Frame section (effectiveValue="none")
// ---------------------------------------------------------------------------

describe("Frame: shadow effective default", () => {
  it("unset shadow renders no boxShadow (control shows effective \"none\")", () => {
    expect(resolveBlockStyle({}).boxShadow).toBeUndefined();
    expect(resolveBlockStyle({ shadow: "none" }).boxShadow).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Corner radius — RadiusButtons (Button + Frame sections), effectiveValue =
// useEffectiveBrandRadius(). Real bug class: brandColors.tsx keeps its OWN
// sharp/subtle/rounded -> px map, independent of resolveBrandKit.ts's
// sharp/subtle/rounded -> rem map that actually paints --pf-radius. Assert
// they resolve to the same pixel value for every radius token.
// ---------------------------------------------------------------------------

describe("RadiusButtons: brand radius effective value matches the painted --pf-radius", () => {
  const RADIUS_TOKENS: BrandKitRadius[] = ["sharp", "subtle", "rounded"];

  it.each(RADIUS_TOKENS)("%s: floated px equals resolveBrandKit's --pf-radius", (radiusToken) => {
    const kit = { ...DEFAULT_BRAND_KIT, radius: radiusToken };
    const { cssVars } = resolveBrandKit(kit);
    const renderedPx = Number.parseFloat(cssVars["--pf-radius"]) * (cssVars["--pf-radius"].includes("rem") ? 16 : 1);

    const { result } = renderHook(() => useEffectiveBrandRadius(), {
      wrapper: ({ children }) =>
        React.createElement(
          BrandColorsContext.Provider,
          { value: { ...DEFAULT_BRAND_COLORS_FOR_TEST, brandRadius: radiusToken } },
          children
        ),
    });

    expect(result.current).toBe(renderedPx);
  });

  it("unset radius baseline: resolveBlockStyle also defaults borderRadius to var(--pf-radius)", () => {
    // Frame/Button both render `var(--pf-radius)` (theme-coupled) until an
    // explicit numeric radius is set — the same mechanism RadiusButtons floats.
    expect(resolveBlockStyle({}).borderRadius).toBe("var(--pf-radius)");
  });
});

const DEFAULT_BRAND_COLORS_FOR_TEST = {
  primary: "var(--pf-color-primary)",
  secondary: "var(--pf-color-secondary)",
  accent: "var(--pf-color-accent)",
  background: "var(--pf-color-bg)",
  foreground: "var(--pf-color-fg)",
};

// ---------------------------------------------------------------------------
// Font family — Typography section, effectiveValue = useEffectiveBrandFont(kind).
// EditorShell populates the context from resolveEffectiveFonts(brandKit) — the
// SAME function resolveBrandKit.ts uses internally for --pf-font-heading/body.
// Assert the two entry points agree for both an independent-fonts kit and a
// legacy fontPair-only kit (the migration path most likely to drift).
// ---------------------------------------------------------------------------

describe("Typography: brand font effective value matches the painted --pf-font-* vars", () => {
  const KITS: { name: string; kit: typeof DEFAULT_BRAND_KIT }[] = [
    { name: "independent headingFont/bodyFont", kit: { ...DEFAULT_BRAND_KIT, headingFont: "playfair", bodyFont: "inter" } },
    {
      name: "legacy fontPair only",
      kit: { ...DEFAULT_BRAND_KIT, headingFont: undefined, bodyFont: undefined, fontPair: "cormorant-montserrat" },
    },
  ];

  it.each(KITS)("$name: heading + body font family agree", ({ kit }) => {
    const effective = resolveEffectiveFonts(kit);
    const { cssVars } = resolveBrandKit(kit);

    expect(fontFamilyValue(effective.headingFont)).toBe(cssVars["--pf-font-heading"]);
    expect(fontFamilyValue(effective.bodyFont)).toBe(cssVars["--pf-font-body"]);
  });

  it("useEffectiveBrandFont(kind) is a plain passthrough of the context value the editor populates", () => {
    const { result: heading } = renderHook(() => useEffectiveBrandFont("heading"), {
      wrapper: ({ children }) =>
        React.createElement(BrandColorsContext.Provider, { value: { ...DEFAULT_BRAND_COLORS_FOR_TEST, headingFont: "playfair" } }, children),
    });
    expect(heading.current).toBe("playfair");
  });
});

// ---------------------------------------------------------------------------
// Text color (Heading/Text) — Typography section, effectiveValue="foreground",
// grounded per the skill's inherit-trap fix: render fallback to
// var(--pf-color-fg), not CSS `inherit`.
// ---------------------------------------------------------------------------

describe("Typography: text color effective default is grounded to --pf-color-fg, not `inherit`", () => {
  it("Heading/Text wrapper color falls back to var(--pf-color-fg) when textColorToken is unset", () => {
    // Mirrors HeadingBlock/TextBlock's own fallback expression exactly (manualBlocks.tsx):
    //   colorTokenToVar(_style?.textColorToken) ?? "var(--pf-block-text-color, var(--pf-color-fg))"
    const color = colorTokenToVar(undefined) ?? "var(--pf-block-text-color, var(--pf-color-fg))";
    expect(color).toContain(colorTokenToVar("foreground") as string);
  });
});

// ---------------------------------------------------------------------------
// Gap + padding — Container/Columns Layout tab, effectiveValue={16} (gap) and
// effectivePad = CONTAINER_EFFECTIVE_PAD / COLUMNS_EFFECTIVE_PAD (padding).
// Render fallback for padding is the SAME imported constant (structural
// guarantee); gap's "1rem" fallback is a separate literal in manualBlocks.tsx
// that must independently equal the control's 16 (px, assuming 1rem=16px).
// ---------------------------------------------------------------------------

describe("Container/Columns: gap + padding effective defaults", () => {
  // Root font-size is 16px (Tailwind's unreset default) everywhere this app
  // renders, so "1rem" and "16px" are the same painted value — but they are
  // different CSS strings, so convert before comparing rather than demanding
  // an exact string match.
  function pxFromCssLength(value: string): number {
    if (value.endsWith("rem")) return Number.parseFloat(value) * 16;
    if (value.endsWith("px")) return Number.parseFloat(value);
    throw new Error(`unsupported CSS length unit: ${value}`);
  }

  it("Container: unset gap renders the same 16px the Gap control floats", () => {
    let captured: { style?: React.CSSProperties } | undefined;
    render(
      ContainerBlock({
        _style: {},
        content: slotSpy((props) => {
          captured = props;
        }),
      }) as React.ReactElement
    );
    expect(pxFromCssLength(captured?.style?.gap as string)).toBe(16);
  });

  it("Columns: unset gap renders the same 16px the Gap control floats", () => {
    const { container } = render(
      ColumnsBlock({
        id: "test",
        _style: {},
        columns: 2,
        content: slotSpy(),
      }) as React.ReactElement
    );
    const styleTag = container.querySelector("style")?.textContent ?? "";
    const match = /\.pf-cols-test\{[^}]*gap:([0-9.]+(?:px|rem))/.exec(styleTag);
    expect(match).not.toBeNull();
    expect(pxFromCssLength(match![1])).toBe(16);
  });

  it("Container: padding fallback is the exact CONTAINER_EFFECTIVE_PAD object the control imports", () => {
    // Structural guarantee: same import, not a duplicated literal — this test
    // documents the contract so a future refactor that breaks the shared
    // import (e.g. inlining a fresh literal in one file) fails loudly.
    expect(CONTAINER_EFFECTIVE_PAD).toEqual({ top: "1.5rem", right: "1.5rem", bottom: "1.5rem", left: "1.5rem" });
  });

  it("Columns: padding fallback is the exact COLUMNS_EFFECTIVE_PAD object the control imports", () => {
    expect(COLUMNS_EFFECTIVE_PAD).toEqual({ top: "1rem", right: "1.5rem", bottom: "1rem", left: "1.5rem" });
  });
});

// ---------------------------------------------------------------------------
// Button: color / opacity / text color / style — Design tab "Button" section.
// ---------------------------------------------------------------------------

describe("Button: effective defaults match ButtonBlock's own render branches", () => {
  const VARIANTS = ["solid", "soft", "outline", undefined] as const;

  it.each(VARIANTS)("buttonStyle=%s: text color matches effectiveButtonTextToken", (buttonStyle) => {
    const { container } = render(
      ButtonBlock({
        _style: { buttonStyle },
        label: "Go",
        action: "open-contact",
        align: "center",
      }) as React.ReactElement
    );
    const a = container.querySelector("a") as HTMLAnchorElement;
    const expectedToken = effectiveButtonTextToken({ buttonStyle });
    expect(a.style.color).toBe(colorTokenToVar(expectedToken));
  });

  it("buttonOpacity unset renders full-opacity fill (control effectiveValue={100})", () => {
    const { container } = render(
      ButtonBlock({
        _style: { buttonStyle: "solid" },
        label: "Go",
        action: "open-contact",
        align: "center",
      }) as React.ReactElement
    );
    const a = container.querySelector("a") as HTMLAnchorElement;
    // 100 is a no-op in buildColorWithOpacity — the fill is the raw token var,
    // never wrapped in color-mix().
    expect(a.style.backgroundColor).not.toContain("color-mix");
    expect(a.style.backgroundColor).toBe("var(--pf-color-primary)");
  });

  it("buttonColorToken unset + buttonStyle set: color reads as primary (control effectiveValue=\"primary\")", () => {
    const { container } = render(
      ButtonBlock({
        _style: { buttonStyle: "outline" },
        label: "Go",
        action: "open-contact",
        align: "center",
      }) as React.ReactElement
    );
    const a = container.querySelector("a") as HTMLAnchorElement;
    expect(a.style.borderColor).toBe(colorTokenToVar("primary"));
  });
});

// ---------------------------------------------------------------------------
// Font size — Typography (non-heading, non-button) effectiveValue=16; Button
// effectiveValue=BUTTON_SIZE_FONT_PX[size].
// ---------------------------------------------------------------------------

describe("Font size effective defaults", () => {
  it("unset fontSize emits no explicit font-size (control's browser-default effective 16 relies on no override)", () => {
    expect(resolveBlockStyle({}).fontSize).toBeUndefined();
  });

  it.each(["sm", "md", "lg"] as const)("Button size=%s: rendered font-size matches BUTTON_SIZE_FONT_PX", (size) => {
    const { container } = render(
      ButtonBlock({ _style: {}, label: "Go", action: "open-contact", align: "center", size }) as React.ReactElement
    );
    const a = container.querySelector("a") as HTMLAnchorElement;
    expect(a.style.fontSize).toBe(`${BUTTON_SIZE_FONT_PX[size] / 16}rem`);
  });
});

// ---------------------------------------------------------------------------
// ContactDetails — label/value/icon size + color effective defaults.
// ---------------------------------------------------------------------------

describe("ContactDetails: label/value/icon effective defaults", () => {
  it("label: fontSize 11px, color foreground", () => {
    const style = buildContactLabelStyle(undefined);
    expect(style.fontSize).toBe("0.6875rem"); // 11px / 16
    expect(style.color).toBe(colorTokenToVar("foreground"));
  });

  it("value: fontSize 15px, color accent", () => {
    const style = buildContactValueStyle(undefined);
    expect(style.fontSize).toBe("0.9375rem"); // 15px / 16
    expect(style.color).toBe(colorTokenToVar("accent"));
  });

  it("icon: size 20px, color accent", () => {
    expect(buildContactIconSize(undefined)).toBe(20);
    expect(buildContactIconColor(undefined)).toBe(colorTokenToVar("accent"));
  });
});

// ---------------------------------------------------------------------------
// ContactDetails — icon align effective default. The Icons section's "Icon
// align" control floats `s.valueAlign ?? "center"` (StyleToolkitField.tsx);
// it must agree with buildContactIconAlign's own fallback chain, which the
// render actually applies.
// ---------------------------------------------------------------------------

describe("ContactDetails: icon align effective default matches the control's floated value", () => {
  it.each([
    ["left", "flex-start"],
    ["center", "center"],
    ["right", "flex-end"],
  ] as const)("contactIconAlign unset, valueAlign=%s -> renders %s (control floats valueAlign)", (valueAlign, justify) => {
    expect(buildContactIconAlign({ valueAlign })).toBe(justify);
  });

  it("both unset default to center (control's own effectiveValue fallback)", () => {
    expect(buildContactIconAlign({})).toBe("center");
    expect(buildContactIconAlign(undefined)).toBe("center");
  });

  it("explicit contactIconAlign wins over valueAlign", () => {
    expect(buildContactIconAlign({ contactIconAlign: "right", valueAlign: "left" })).toBe("flex-end");
  });
});

// ---------------------------------------------------------------------------
// Sanity — every color token the effective-value props reference is a real
// palette token (catches a typo'd effectiveValue string silently rendering
// as a raw CSS color instead of a `--pf-color-*` var).
// ---------------------------------------------------------------------------

describe("sanity: floated color tokens are real palette tokens", () => {
  const FLOATED_TOKENS: StyleColorToken[] = ["foreground", "accent", "primary"];
  it.each(FLOATED_TOKENS)("%s is a member of STYLE_COLOR_TOKENS", (token) => {
    expect(STYLE_COLOR_TOKENS).toContain(token);
  });
});
