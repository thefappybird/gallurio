import { describe, it, expect } from "vitest";
import {
  legacyFontPairToFonts,
  fontFamilyValue,
  isPortfolioFontKey,
  resolveEffectiveFonts,
  isGoogleFontSelection,
  googleFontFamilyName,
  toGoogleFontSelection,
  googleFontsCssUrl,
  googleFontSlug,
  collectGoogleFontFamilies,
  PORTFOLIO_FONTS,
  DEFAULT_HEADING_FONT,
  DEFAULT_BODY_FONT,
  GOOGLE_FONT_SHORTLIST,
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

// ---------------------------------------------------------------------------
// collectGoogleFontFamilies
// ---------------------------------------------------------------------------

describe("collectGoogleFontFamilies", () => {
  it("finds a single google: family nested inside an object", () => {
    expect(collectGoogleFontFamilies({ fontFamily: "google:Poppins" })).toEqual(["Poppins"]);
  });

  it("de-duplicates repeated google: families across a nested tree", () => {
    const data = {
      content: [
        { type: "Heading", props: { _style: { fontFamily: "google:Poppins" } } },
        { type: "Text", props: { _style: { fontFamily: "google:Poppins" } } },
      ],
    };
    expect(collectGoogleFontFamilies(data)).toEqual(["Poppins"]);
  });

  it("ignores curated font keys and non-font strings", () => {
    expect(
      collectGoogleFontFamilies({ fontFamily: "merriweather", label: "hello" })
    ).toEqual([]);
  });
});

describe("fontFamilyValue — google font selections", () => {
  it("google:Poppins → quoted family name with a sans-serif fallback", () => {
    expect(fontFamilyValue("google:Poppins")).toBe('"Poppins", sans-serif');
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

// ---------------------------------------------------------------------------
// isGoogleFontSelection
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GOOGLE_FONT_SHORTLIST
// ---------------------------------------------------------------------------

describe("GOOGLE_FONT_SHORTLIST", () => {
  it("contains at least 15 curated entries, each with a name and category", () => {
    expect(GOOGLE_FONT_SHORTLIST.length).toBeGreaterThanOrEqual(15);
    for (const entry of GOOGLE_FONT_SHORTLIST) {
      expect(typeof entry.name).toBe("string");
      expect(["serif", "sans"]).toContain(entry.category);
    }
  });
});

// ---------------------------------------------------------------------------
// resolveEffectiveFonts — Google Font pass-through
// ---------------------------------------------------------------------------

describe("resolveEffectiveFonts — google font selection", () => {
  it("passes through a google: headingFont instead of falling back to legacy", () => {
    const result = resolveEffectiveFonts({ headingFont: "google:Poppins", bodyFont: "inter" });
    expect(result.headingFont).toBe("google:Poppins");
  });
});

describe("isGoogleFontSelection", () => {
  it("returns true for a 'google:<Family Name>' selection", () => {
    expect(isGoogleFontSelection("google:Poppins")).toBe(true);
  });

  it("returns false for a curated font key", () => {
    expect(isGoogleFontSelection("merriweather")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// googleFontFamilyName
// ---------------------------------------------------------------------------

describe("googleFontFamilyName", () => {
  it("extracts the family name from a google: selection", () => {
    expect(googleFontFamilyName("google:Poppins")).toBe("Poppins");
  });
});

// ---------------------------------------------------------------------------
// toGoogleFontSelection
// ---------------------------------------------------------------------------

describe("toGoogleFontSelection", () => {
  it("wraps a family name into the tagged selection format", () => {
    expect(toGoogleFontSelection("Poppins")).toBe("google:Poppins");
  });
});

// ---------------------------------------------------------------------------
// googleFontsCssUrl
// ---------------------------------------------------------------------------

describe("googleFontsCssUrl", () => {
  it("builds the CSS2 stylesheet URL for a single-word family", () => {
    expect(googleFontsCssUrl("Poppins")).toBe(
      "https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap"
    );
  });

  it("joins multi-word family names with '+'", () => {
    expect(googleFontsCssUrl("Playfair Display")).toBe(
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap"
    );
  });

  it("trims surrounding whitespace before encoding", () => {
    expect(googleFontsCssUrl("  Open Sans  ")).toBe(
      "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap"
    );
  });
});

// ---------------------------------------------------------------------------
// googleFontSlug
// ---------------------------------------------------------------------------

describe("googleFontSlug", () => {
  it("lowercases and hyphenates a multi-word family name", () => {
    expect(googleFontSlug("Playfair Display")).toBe("playfair-display");
  });
});
