import { describe, it, expect } from "vitest";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";
import {
  BRAND_KIT_THEME_PRESETS,
  BRAND_KIT_RADII,
  BRAND_KIT_BUTTON_STYLES,
} from "@/lib/page-builder/types";
import { PORTFOLIO_FONT_KEYS } from "@/lib/page-builder/fonts";

const HEX_RE = /^#[0-9a-f]{6}$/i;
const COLOR_FIELDS = [
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "backgroundColor",
  "foregroundColor",
] as const;

describe("THEME_PRESET_DEFINITIONS", () => {
  it("defines exactly the built-in presets", () => {
    expect(Object.keys(THEME_PRESET_DEFINITIONS).sort()).toEqual(
      [...BRAND_KIT_THEME_PRESETS].sort()
    );
  });

  for (const preset of BRAND_KIT_THEME_PRESETS) {
    describe(preset, () => {
      const def = THEME_PRESET_DEFINITIONS[preset];

      it("has a non-empty name and self-consistent themePreset", () => {
        expect(def.name.length).toBeGreaterThan(0);
        expect(def.brandKit.themePreset).toBe(preset);
      });

      it("has 5 valid hex colors", () => {
        for (const field of COLOR_FIELDS) {
          expect(def.brandKit[field]).toMatch(HEX_RE);
        }
      });

      it("uses distinct primary and accent (legible 2-swatch thumbnail)", () => {
        expect(def.brandKit.primaryColor.toLowerCase()).not.toBe(
          def.brandKit.accentColor.toLowerCase()
        );
      });

      it("uses valid font keys, radius, and button style", () => {
        expect(PORTFOLIO_FONT_KEYS).toContain(def.brandKit.headingFont);
        expect(PORTFOLIO_FONT_KEYS).toContain(def.brandKit.bodyFont);
        expect(BRAND_KIT_RADII).toContain(def.brandKit.radius);
        expect(BRAND_KIT_BUTTON_STYLES).toContain(def.brandKit.buttonStyle);
      });
    });
  }
});
