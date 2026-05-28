import { describe, it, expect } from "vitest";
import { resolveBrandKit } from "./resolveBrandKit";
import { DEFAULT_BRAND_KIT } from "./types";
import type { PortfolioBrandKit } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kit(overrides: Partial<PortfolioBrandKit> = {}): PortfolioBrandKit {
  return { ...DEFAULT_BRAND_KIT, ...overrides };
}

// ---------------------------------------------------------------------------
// CSS variable key contract
// ---------------------------------------------------------------------------

describe("resolveBrandKit — CSS variable keys", () => {
  it("all returned keys are --pf-* prefixed", () => {
    const { cssVars } = resolveBrandKit(DEFAULT_BRAND_KIT);
    const keys = Object.keys(cssVars);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key).toMatch(/^--pf-/);
    }
  });

  it("returns all expected CSS variable keys", () => {
    const { cssVars } = resolveBrandKit(DEFAULT_BRAND_KIT);
    expect(cssVars).toHaveProperty("--pf-color-primary");
    expect(cssVars).toHaveProperty("--pf-color-secondary");
    expect(cssVars).toHaveProperty("--pf-color-accent");
    expect(cssVars).toHaveProperty("--pf-color-bg");
    expect(cssVars).toHaveProperty("--pf-color-fg");
    expect(cssVars).toHaveProperty("--pf-radius");
    expect(cssVars).toHaveProperty("--pf-font-heading");
    expect(cssVars).toHaveProperty("--pf-font-body");
  });
});

// ---------------------------------------------------------------------------
// className contract
// ---------------------------------------------------------------------------

describe("resolveBrandKit — className format", () => {
  it("format is `pf-theme-<preset> pf-button-<style>`", () => {
    const { className } = resolveBrandKit(DEFAULT_BRAND_KIT);
    expect(className).toBe("pf-theme-minimal pf-button-solid");
  });

  it("reflects different theme presets", () => {
    const { className } = resolveBrandKit(kit({ themePreset: "luxury", buttonStyle: "outline" }));
    expect(className).toBe("pf-theme-luxury pf-button-outline");
  });

  it("reflects all button styles", () => {
    expect(resolveBrandKit(kit({ buttonStyle: "solid" })).className).toContain("pf-button-solid");
    expect(resolveBrandKit(kit({ buttonStyle: "outline" })).className).toContain("pf-button-outline");
    expect(resolveBrandKit(kit({ buttonStyle: "soft" })).className).toContain("pf-button-soft");
  });
});

// ---------------------------------------------------------------------------
// Color passthrough
// ---------------------------------------------------------------------------

describe("resolveBrandKit — color values", () => {
  it("passes colors through verbatim", () => {
    const custom = kit({
      primaryColor: "#aabbcc",
      secondaryColor: "#112233",
      accentColor: "#ff0000",
      backgroundColor: "#fefefe",
      foregroundColor: "#010101",
    });
    const { cssVars } = resolveBrandKit(custom);
    expect(cssVars["--pf-color-primary"]).toBe("#aabbcc");
    expect(cssVars["--pf-color-secondary"]).toBe("#112233");
    expect(cssVars["--pf-color-accent"]).toBe("#ff0000");
    expect(cssVars["--pf-color-bg"]).toBe("#fefefe");
    expect(cssVars["--pf-color-fg"]).toBe("#010101");
  });
});

// ---------------------------------------------------------------------------
// Radius variants
// ---------------------------------------------------------------------------

describe("resolveBrandKit — radius", () => {
  it("sharp → 0", () => {
    const { cssVars } = resolveBrandKit(kit({ radius: "sharp" }));
    expect(cssVars["--pf-radius"]).toBe("0");
  });

  it("subtle → 0.25rem", () => {
    const { cssVars } = resolveBrandKit(kit({ radius: "subtle" }));
    expect(cssVars["--pf-radius"]).toBe("0.25rem");
  });

  it("rounded → 0.5rem", () => {
    const { cssVars } = resolveBrandKit(kit({ radius: "rounded" }));
    expect(cssVars["--pf-radius"]).toBe("0.5rem");
  });
});

// ---------------------------------------------------------------------------
// Font pair variants
// ---------------------------------------------------------------------------

describe("resolveBrandKit — font pairs", () => {
  it("merriweather-only → both heading and body are Merriweather", () => {
    const { cssVars } = resolveBrandKit(kit({ fontPair: "merriweather-only" }));
    expect(cssVars["--pf-font-heading"]).toBe("'Merriweather', serif");
    expect(cssVars["--pf-font-body"]).toBe("'Merriweather', serif");
  });

  it("playfair-inter → Playfair Display heading, Inter body", () => {
    const { cssVars } = resolveBrandKit(kit({ fontPair: "playfair-inter" }));
    expect(cssVars["--pf-font-heading"]).toBe("'Playfair Display', serif");
    expect(cssVars["--pf-font-body"]).toBe("'Inter', sans-serif");
  });

  it("dm-serif-dm-sans → DM Serif Display heading, DM Sans body", () => {
    const { cssVars } = resolveBrandKit(kit({ fontPair: "dm-serif-dm-sans" }));
    expect(cssVars["--pf-font-heading"]).toBe("'DM Serif Display', serif");
    expect(cssVars["--pf-font-body"]).toBe("'DM Sans', sans-serif");
  });

  it("cormorant-montserrat → Cormorant Garamond heading, Montserrat body", () => {
    const { cssVars } = resolveBrandKit(kit({ fontPair: "cormorant-montserrat" }));
    expect(cssVars["--pf-font-heading"]).toBe("'Cormorant Garamond', serif");
    expect(cssVars["--pf-font-body"]).toBe("'Montserrat', sans-serif");
  });

  it("fraunces-inter → Fraunces heading, Inter body", () => {
    const { cssVars } = resolveBrandKit(kit({ fontPair: "fraunces-inter" }));
    expect(cssVars["--pf-font-heading"]).toBe("'Fraunces', serif");
    expect(cssVars["--pf-font-body"]).toBe("'Inter', sans-serif");
  });
});

// ---------------------------------------------------------------------------
// Table-driven permutation: 2 radii × 2 font pairs × 2 button styles
// ---------------------------------------------------------------------------

describe("resolveBrandKit — permutation table", () => {
  const cases: Array<{
    label: string;
    overrides: Partial<PortfolioBrandKit>;
    expectedRadius: string;
    expectedHeading: string;
    expectedClassName: string;
  }> = [
    {
      label: "sharp + merriweather-only + solid",
      overrides: { radius: "sharp", fontPair: "merriweather-only", buttonStyle: "solid", themePreset: "minimal" },
      expectedRadius: "0",
      expectedHeading: "'Merriweather', serif",
      expectedClassName: "pf-theme-minimal pf-button-solid",
    },
    {
      label: "subtle + playfair-inter + outline",
      overrides: { radius: "subtle", fontPair: "playfair-inter", buttonStyle: "outline", themePreset: "editorial" },
      expectedRadius: "0.25rem",
      expectedHeading: "'Playfair Display', serif",
      expectedClassName: "pf-theme-editorial pf-button-outline",
    },
    {
      label: "rounded + dm-serif-dm-sans + soft",
      overrides: { radius: "rounded", fontPair: "dm-serif-dm-sans", buttonStyle: "soft", themePreset: "luxury" },
      expectedRadius: "0.5rem",
      expectedHeading: "'DM Serif Display', serif",
      expectedClassName: "pf-theme-luxury pf-button-soft",
    },
    {
      label: "sharp + fraunces-inter + outline",
      overrides: { radius: "sharp", fontPair: "fraunces-inter", buttonStyle: "outline", themePreset: "bold" },
      expectedRadius: "0",
      expectedHeading: "'Fraunces', serif",
      expectedClassName: "pf-theme-bold pf-button-outline",
    },
  ];

  for (const { label, overrides, expectedRadius, expectedHeading, expectedClassName } of cases) {
    it(label, () => {
      const { cssVars, className } = resolveBrandKit(kit(overrides));
      expect(cssVars["--pf-radius"]).toBe(expectedRadius);
      expect(cssVars["--pf-font-heading"]).toBe(expectedHeading);
      expect(className).toBe(expectedClassName);
    });
  }
});
