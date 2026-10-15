import { describe, it, expect } from "vitest";
import { BRAND_KIT_THEME_PRESETS } from "@/lib/page-builder/types";
import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import {
  INVOICE_THEME_PRESETS,
  contrastRatio,
  INVOICE_THEME_DEFAULT_PRESET,
  invoiceColorsFromBrandKit,
  normalizeInvoiceTheme,
  publishedBrandKit,
  resolveInvoiceTheme,
} from "./theme";

const MINIMAL = { main: "#ece5d8", accent: "#ddd0ba", text: "#1f1c16" };
const kit = THEME_PRESET_DEFINITIONS.bold.brandKit;

describe("resolveInvoiceTheme", () => {
  it("falls back to the minimal preset (with dark text) when theme is null", () => {
    expect(resolveInvoiceTheme(null)).toEqual(MINIMAL);
  });

  it("keeps a legacy preset's stored colors (as custom) instead of falling back", () => {
    const legacy = { preset: "classic", main: "#1A1A1A", accent: "#FFFFFF" } as never;
    expect(resolveInvoiceTheme(legacy)).toEqual({ main: "#1A1A1A", accent: "#FFFFFF", text: "#FFFFFF" });
  });

  it("resolves every portfolio preset from its definition", () => {
    for (const id of BRAND_KIT_THEME_PRESETS) {
      const expected = invoiceColorsFromBrandKit(THEME_PRESET_DEFINITIONS[id].brandKit);
      expect(resolveInvoiceTheme({ preset: id, main: "x", accent: "x" })).toEqual(expected);
      expect(INVOICE_THEME_PRESETS[id]).toEqual(expected);
    }
  });

  it("portfolio resolves live from the passed brand kit and changes with it", () => {
    const t = { preset: "portfolio", main: "#000000", accent: "#000000" } as const;
    const a = resolveInvoiceTheme(t, kit);
    const b = resolveInvoiceTheme(t, { ...kit, primaryColor: "#102030" });
    expect(a.main).toBe(kit.primaryColor);
    expect(b.main).toBe("#102030");
  });

  it("portfolio without a brand kit falls back to the stored snapshot", () => {
    const t = { preset: "portfolio", main: "#123456", accent: "#abcdef", text: "#ffffff" } as const;
    expect(resolveInvoiceTheme(t, null)).toEqual({ main: "#123456", accent: "#abcdef", text: "#ffffff" });
  });

  it("saved uses the stored snapshot and ignores the live kit", () => {
    const t = { preset: "saved", savedThemeId: "s1", main: "#123456", accent: "#abcdef", text: "#ffffff" } as const;
    expect(resolveInvoiceTheme(t, kit)).toEqual({ main: "#123456", accent: "#abcdef", text: "#ffffff" });
  });

  it("custom uses its colors and computes text when missing", () => {
    expect(resolveInvoiceTheme({ preset: "custom", main: "#111111", accent: "#222222" })).toEqual({
      main: "#111111",
      accent: "#222222",
      text: "#FFFFFF",
    });
    expect(resolveInvoiceTheme({ preset: "custom", main: "#f0f0f0", accent: "#222222" }).text).toBe("#111111");
  });
});

describe("publishedBrandKit", () => {
  it("returns the kit only once the portfolio has been published", () => {
    expect(publishedBrandKit({ brandKit: kit, publishedAt: null })).toBeNull();
    expect(publishedBrandKit({ brandKit: kit })).toBeNull();
    expect(publishedBrandKit(undefined)).toBeNull();
    expect(publishedBrandKit({ brandKit: kit, publishedAt: new Date() })).toBe(kit);
    expect(publishedBrandKit({ brandKit: undefined, publishedAt: new Date() })).toBeNull();
  });
});

describe("normalizeInvoiceTheme", () => {
  it("turns a legacy theme into custom keeping stored colors", () => {
    const legacy = { preset: "slate", main: "#123456", accent: "#abcdef" } as never;
    expect(normalizeInvoiceTheme(legacy)).toEqual({
      preset: "custom",
      savedThemeId: null,
      main: "#123456",
      accent: "#abcdef",
      text: "#FFFFFF",
    });
  });

  it("uses the legacy palette when stored colors are not valid hex", () => {
    const legacy = { preset: "navyGold", main: "bad", accent: "" } as never;
    expect(normalizeInvoiceTheme(legacy)).toEqual({
      preset: "custom",
      savedThemeId: null,
      main: "#0F1B33",
      accent: "#C9A24B",
      text: "#FFFFFF",
    });
  });

  it("keeps a valid stored text color on a legacy theme", () => {
    const legacy = { preset: "forest", main: "#1F3D2B", accent: "#E8E2D0", text: "#fafafa" } as never;
    expect(normalizeInvoiceTheme(legacy).text).toBe("#fafafa");
  });

  it("falls back to minimal for an unknown id", () => {
    const t = { preset: "nope", main: "#123456", accent: "#abcdef" } as never;
    expect(normalizeInvoiceTheme(t)).toEqual({ preset: INVOICE_THEME_DEFAULT_PRESET, ...MINIMAL });
  });

  it("returns current presets unchanged", () => {
    for (const preset of ["bold", "portfolio", "saved", "custom"] as const) {
      const t = { preset, main: "#123456", accent: "#abcdef" };
      expect(normalizeInvoiceTheme(t)).toBe(t);
    }
  });
});

describe("invoiceColorsFromBrandKit", () => {
  it("picks dark text on light Minimal and light text on dark Luxury/Romantic", () => {
    expect(INVOICE_THEME_PRESETS.minimal.text).toBe("#1f1c16");
    expect(INVOICE_THEME_PRESETS.luxury.text).toBe("#eceef4");
    expect(INVOICE_THEME_PRESETS.romantic.text).toBe("#f4e9e7");
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white and symmetric", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });
});
