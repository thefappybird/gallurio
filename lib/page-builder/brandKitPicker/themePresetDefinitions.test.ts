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

  // DESIGN.md -> the presets carry the app's Never-Pure discipline outward:
  // near-black rather than black, near-white rather than white.
  it("never grounds a preset on pure black or pure white", () => {
    const pure = ["#ffffff", "#fff", "#000000", "#000"];
    for (const [preset, def] of Object.entries(THEME_PRESET_DEFINITIONS)) {
      expect(
        pure.includes(def.brandKit.backgroundColor.toLowerCase()),
        `${preset} background ${def.brandKit.backgroundColor}`
      ).toBe(false);
    }
  });

  // Every palette color can be chosen as a section/card surface. The theme's
  // foreground ("Text" in the picker) must remain readable on all of them.
  it("meets the preset contrast bar", () => {
    const channel = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (hex: string) => {
      const h = hex.replace("#", "");
      return (
        0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
        0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
        0.0722 * channel(parseInt(h.slice(4, 6), 16))
      );
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    const failures: string[] = [];
    for (const [preset, def] of Object.entries(THEME_PRESET_DEFINITIONS)) {
      const { foregroundColor } = def.brandKit;
      const checks: [string, number][] = [
        ["foreground/background", ratio(foregroundColor, def.brandKit.backgroundColor)],
        ["foreground/primary", ratio(foregroundColor, def.brandKit.primaryColor)],
        ["foreground/secondary", ratio(foregroundColor, def.brandKit.secondaryColor)],
        ["foreground/accent", ratio(foregroundColor, def.brandKit.accentColor)],
      ];
      for (const [label, value] of checks) {
        if (value < 4.5) {
          failures.push(`${preset} ${label} ${value.toFixed(2)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  // DESIGN.md -> The Preset Distinction Rule: each preset must be identifiable
  // at a glance from its ground, accent, and type pairing together.
  it("gives every preset a unique accent", () => {
    const accents = Object.values(THEME_PRESET_DEFINITIONS).map((d) =>
      d.brandKit.accentColor.toLowerCase()
    );
    expect(new Set(accents).size).toBe(accents.length);
  });

  it("gives every preset a unique primary and foreground", () => {
    const primaries = Object.values(THEME_PRESET_DEFINITIONS).map((d) => d.brandKit.primaryColor.toLowerCase());
    const foregrounds = Object.values(THEME_PRESET_DEFINITIONS).map((d) => d.brandKit.foregroundColor.toLowerCase());
    expect(new Set(primaries).size).toBe(primaries.length);
    expect(new Set(foregrounds).size).toBe(foregrounds.length);
  });
});
