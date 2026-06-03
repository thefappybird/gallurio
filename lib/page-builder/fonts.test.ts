import { describe, it, expect } from "vitest";
import {
  legacyFontPairToFonts,
  fontFamilyValue,
  isPortfolioFontKey,
  PORTFOLIO_FONTS,
  DEFAULT_HEADING_FONT,
  DEFAULT_BODY_FONT,
} from "./fonts";

// ---------------------------------------------------------------------------
// legacyFontPairToFonts
// ---------------------------------------------------------------------------

describe("legacyFontPairToFonts — known pairs", () => {
  it("merriweather-only → both merriweather", () => {
    const result = legacyFontPairToFonts("merriweather-only");
    expect(result.headingFont).toBe("merriweather");
    expect(result.bodyFont).toBe("merriweather");
  });

  it("playfair-inter → playfair heading, inter body", () => {
    const result = legacyFontPairToFonts("playfair-inter");
    expect(result.headingFont).toBe("playfair");
    expect(result.bodyFont).toBe("inter");
  });

  it("dm-serif-dm-sans → dm-serif heading, dm-sans body", () => {
    const result = legacyFontPairToFonts("dm-serif-dm-sans");
    expect(result.headingFont).toBe("dm-serif");
    expect(result.bodyFont).toBe("dm-sans");
  });

  it("cormorant-montserrat → cormorant heading, montserrat body", () => {
    const result = legacyFontPairToFonts("cormorant-montserrat");
    expect(result.headingFont).toBe("cormorant");
    expect(result.bodyFont).toBe("montserrat");
  });

  it("fraunces-inter → fraunces heading, inter body", () => {
    const result = legacyFontPairToFonts("fraunces-inter");
    expect(result.headingFont).toBe("fraunces");
    expect(result.bodyFont).toBe("inter");
  });
});

describe("legacyFontPairToFonts — default fallback", () => {
  it("unknown string → defaults (merriweather/merriweather)", () => {
    const result = legacyFontPairToFonts("some-unknown-pair");
    expect(result.headingFont).toBe(DEFAULT_HEADING_FONT);
    expect(result.bodyFont).toBe(DEFAULT_BODY_FONT);
  });

  it("empty string → defaults", () => {
    const result = legacyFontPairToFonts("");
    expect(result.headingFont).toBe(DEFAULT_HEADING_FONT);
    expect(result.bodyFont).toBe(DEFAULT_BODY_FONT);
  });

  it("undefined → defaults", () => {
    const result = legacyFontPairToFonts(undefined);
    expect(result.headingFont).toBe(DEFAULT_HEADING_FONT);
    expect(result.bodyFont).toBe(DEFAULT_BODY_FONT);
  });

  it("null → defaults", () => {
    const result = legacyFontPairToFonts(null);
    expect(result.headingFont).toBe(DEFAULT_HEADING_FONT);
    expect(result.bodyFont).toBe(DEFAULT_BODY_FONT);
  });

  it("default heading and body are both 'merriweather'", () => {
    expect(DEFAULT_HEADING_FONT).toBe("merriweather");
    expect(DEFAULT_BODY_FONT).toBe("merriweather");
  });
});

// ---------------------------------------------------------------------------
// fontFamilyValue
// ---------------------------------------------------------------------------

describe("fontFamilyValue — known keys", () => {
  it("merriweather → contains 'merriweather' in the family string", () => {
    const val = fontFamilyValue("merriweather");
    expect(val).toBeDefined();
    expect(val).toBe(PORTFOLIO_FONTS.merriweather.family);
    expect(val).toContain("merriweather");
  });

  it("playfair → contains 'playfair' in the family string", () => {
    const val = fontFamilyValue("playfair");
    expect(val).toBeDefined();
    expect(val).toContain("playfair");
  });

  it("fraunces → contains 'fraunces'", () => {
    expect(fontFamilyValue("fraunces")).toContain("fraunces");
  });

  it("cormorant → contains 'cormorant'", () => {
    expect(fontFamilyValue("cormorant")).toContain("cormorant");
  });

  it("dm-serif → contains 'dm-serif'", () => {
    expect(fontFamilyValue("dm-serif")).toContain("dm-serif");
  });

  it("inter → contains 'inter'", () => {
    expect(fontFamilyValue("inter")).toContain("inter");
  });

  it("montserrat → contains 'montserrat'", () => {
    expect(fontFamilyValue("montserrat")).toContain("montserrat");
  });

  it("dm-sans → contains 'dm-sans'", () => {
    expect(fontFamilyValue("dm-sans")).toContain("dm-sans");
  });
});

describe("fontFamilyValue — unknown / falsy keys", () => {
  it("unknown string → undefined", () => {
    expect(fontFamilyValue("comic-sans" as never)).toBeUndefined();
  });

  it("undefined → undefined", () => {
    expect(fontFamilyValue(undefined)).toBeUndefined();
  });

  it("null → undefined", () => {
    expect(fontFamilyValue(null)).toBeUndefined();
  });

  it("empty string → undefined (empty string is not a valid key)", () => {
    expect(fontFamilyValue("" as never)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isPortfolioFontKey
// ---------------------------------------------------------------------------

describe("isPortfolioFontKey", () => {
  it("returns true for all valid font keys", () => {
    const validKeys = [
      "merriweather",
      "playfair",
      "fraunces",
      "cormorant",
      "dm-serif",
      "inter",
      "montserrat",
      "dm-sans",
    ] as const;
    for (const key of validKeys) {
      expect(isPortfolioFontKey(key), `expected '${key}' to be valid`).toBe(true);
    }
  });

  it("returns false for an unknown string", () => {
    expect(isPortfolioFontKey("comic-sans")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isPortfolioFontKey("")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isPortfolioFontKey(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isPortfolioFontKey(null)).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isPortfolioFontKey(42)).toBe(false);
  });

  it("returns false for an object", () => {
    expect(isPortfolioFontKey({ key: "inter" })).toBe(false);
  });

  it("returns false for a legacy font pair string (not a font key)", () => {
    expect(isPortfolioFontKey("playfair-inter")).toBe(false);
  });

  it("is case-sensitive — 'Merriweather' is not valid", () => {
    expect(isPortfolioFontKey("Merriweather")).toBe(false);
  });
});
