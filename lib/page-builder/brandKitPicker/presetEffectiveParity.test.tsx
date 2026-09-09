import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";

import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { resolveEffectiveFonts, fontFamilyValue } from "@/lib/page-builder/fonts";
import {
  BrandColorsContext,
  useBrandColors,
  useEffectiveBrandRadius,
  useEffectiveBrandFont,
} from "@/lib/page-builder/brandColors";
import type { BrandColorMap } from "@/lib/page-builder/brandColors";
import type { PortfolioBrandKit } from "@/lib/page-builder/types";

/**
 * The editor "floats up" a block's effective theme value so an unset control
 * shows what is already in effect. Those floated values come from
 * BrandColorsContext; what actually paints the canvas, the preview, and the
 * published page comes from resolveBrandKit's --pf-* vars. If the two ever
 * disagree, a control confidently displays a value the block does not render.
 *
 * These tests build the context exactly the way EditorShell does and assert
 * parity against the resolved vars, for every shipped preset.
 */

// Mirrors EditorShell's brandColors construction.
function editorBrandColors(brandKit: PortfolioBrandKit): BrandColorMap {
  const { headingFont, bodyFont } = resolveEffectiveFonts(brandKit);
  return {
    primary: brandKit.primaryColor,
    secondary: brandKit.secondaryColor,
    accent: brandKit.accentColor,
    background: brandKit.backgroundColor,
    foreground: brandKit.foregroundColor,
    brandRadius: brandKit.radius,
    headingFont,
    bodyFont,
  };
}

function wrapperFor(brandKit: PortfolioBrandKit) {
  const value = editorBrandColors(brandKit);
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrandColorsContext.Provider value={value}>
        {children}
      </BrandColorsContext.Provider>
    );
  };
}

describe("preset effective-default parity", () => {
  it("floats the same colors every preset renders", () => {
    for (const [preset, def] of Object.entries(THEME_PRESET_DEFINITIONS)) {
      const { cssVars } = resolveBrandKit(def.brandKit);
      const { result } = renderHook(() => useBrandColors(), {
        wrapper: wrapperFor(def.brandKit),
      });
      expect(
        {
          primary: result.current.primary,
          secondary: result.current.secondary,
          accent: result.current.accent,
          background: result.current.background,
          foreground: result.current.foreground,
        },
        preset
      ).toEqual({
        primary: cssVars["--pf-color-primary"],
        secondary: cssVars["--pf-color-secondary"],
        accent: cssVars["--pf-color-accent"],
        background: cssVars["--pf-color-bg"],
        foreground: cssVars["--pf-color-fg"],
      });
    }
  });

  it("floats the same radius every preset renders", () => {
    // --pf-radius is emitted as a CSS length; the floated control value is a
    // number of pixels. 1rem = 16px.
    const toPx = (value: string) =>
      value.endsWith("rem") ? parseFloat(value) * 16 : parseFloat(value);

    for (const [preset, def] of Object.entries(THEME_PRESET_DEFINITIONS)) {
      const { cssVars } = resolveBrandKit(def.brandKit);
      const { result } = renderHook(() => useEffectiveBrandRadius(), {
        wrapper: wrapperFor(def.brandKit),
      });
      expect(result.current, preset).toBe(toPx(cssVars["--pf-radius"]));
    }
  });

  // Bold and Romantic carry a legacy `fontPair` that no longer matches their
  // headingFont/bodyFont. Both the float and the renderer must ignore it.
  it("floats the same fonts every preset renders", () => {
    for (const [preset, def] of Object.entries(THEME_PRESET_DEFINITIONS)) {
      const { cssVars } = resolveBrandKit(def.brandKit);
      const wrapper = wrapperFor(def.brandKit);
      const { result: heading } = renderHook(
        () => useEffectiveBrandFont("heading"),
        { wrapper }
      );
      const { result: body } = renderHook(() => useEffectiveBrandFont("body"), {
        wrapper,
      });
      expect(fontFamilyValue(heading.current!), `${preset} heading`).toBe(
        cssVars["--pf-font-heading"]
      );
      expect(fontFamilyValue(body.current!), `${preset} body`).toBe(
        cssVars["--pf-font-body"]
      );
    }
  });
});
