import { describe, it, expect } from "vitest";
import {
  brandKitSchema,
  portfolioPuckDataSchema,
  portfolioContactConfigSchema,
  portfolioCollectionsPopupConfigSchema,
  savedThemeSchema,
  savedThemesSchema,
} from "./publicPage";
import { DEFAULT_BRAND_KIT, SAVED_THEMES_MAX } from "@/lib/page-builder/types";

// ---------------------------------------------------------------------------
// portfolioCollectionsPopupConfigSchema
// ---------------------------------------------------------------------------

describe("portfolioCollectionsPopupConfigSchema", () => {
  it("accepts an empty object (all optional → flat sharp defaults)", () => {
    expect(portfolioCollectionsPopupConfigSchema.parse({})).toEqual({});
  });
  it("accepts valid border/background/radius", () => {
    const v = { backgroundColor: "surface", borderColor: "#1a1a1a", borderWidth: 2, radius: "subtle" as const };
    expect(portfolioCollectionsPopupConfigSchema.parse(v)).toEqual(v);
  });
  it("rejects borderWidth out of range", () => {
    expect(portfolioCollectionsPopupConfigSchema.safeParse({ borderWidth: 999 }).success).toBe(false);
  });
  it("rejects an unknown radius", () => {
    expect(portfolioCollectionsPopupConfigSchema.safeParse({ radius: "huge" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// portfolioCollectionsPopupConfigSchema — new title + close-button fields
// ---------------------------------------------------------------------------

describe("portfolioCollectionsPopupConfigSchema new fields", () => {
  it("keeps title + close-button fields through parse", () => {
    const input = {
      backgroundColor: "primary",
      titleText: "Galleries",
      titleFontSize: 24,
      titleColorToken: "foreground",
      titleBold: true,
      titleAlign: "center",
      closeButtonSize: 44,
      closeButtonRadius: "rounded",
      closeButtonBorderWidth: 2,
      closeButtonBorderColorToken: "foreground",
      closeButtonOpacity: 80,
      closeButtonBgColorToken: "background",
    };
    const parsed = portfolioCollectionsPopupConfigSchema.parse(input);
    expect(parsed.titleText).toBe("Galleries");
    expect(parsed.titleAlign).toBe("center");
    expect(parsed.closeButtonSize).toBe(44);
    expect(parsed.closeButtonRadius).toBe("rounded");
    expect(parsed.closeButtonBgColorToken).toBe("background");
  });
});

// ---------------------------------------------------------------------------
// portfolioContactConfigSchema
// ---------------------------------------------------------------------------

describe("portfolioContactConfigSchema", () => {
  it("accepts an empty object (all fields optional → brand-kit fallbacks)", () => {
    expect(portfolioContactConfigSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a fully specified valid config", () => {
    const result = portfolioContactConfigSchema.safeParse({
      title: "Let's work together",
      description: "Tell us about your event.",
      buttonStyle: "outline",
      buttonColor: "accent",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty-string values for optional fields", () => {
    const result = portfolioContactConfigSchema.safeParse({
      title: "",
      description: "",
      buttonStyle: "",
      buttonColor: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an out-of-set button style", () => {
    const result = portfolioContactConfigSchema.safeParse({ buttonStyle: "ghost" });
    expect(result.success).toBe(false);
  });

  it("accepts a hex button color (spectrum picker produces hex values)", () => {
    const result = portfolioContactConfigSchema.safeParse({ buttonColor: "#ff0000" });
    expect(result.success).toBe(true);
  });

  it("rejects a button color that exceeds the max length", () => {
    const result = portfolioContactConfigSchema.safeParse({ buttonColor: "#" + "a".repeat(32) });
    expect(result.success).toBe(false);
  });

  it("rejects an over-long title", () => {
    const result = portfolioContactConfigSchema.safeParse({ title: "x".repeat(81) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// portfolioContactConfigSchema — tab styling fields
// ---------------------------------------------------------------------------

describe("portfolioContactConfigSchema — tab styling fields", () => {
  it("accepts all new tab fields in a valid config", () => {
    const result = portfolioContactConfigSchema.safeParse({
      tabFontSize: "sm",
      tabColor: "primary",
      activeTabColor: "accent",
      activeTabScale: true,
      activeTabHighlight: true,
      tabHighlightColor: "secondary",
      tabHighlightOpacity: 80,
      activeTabRadius: "subtle",
      activeTabUnderline: true,
      tabUnderlineColor: "#112233",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty string for tabFontSize (reset to default)", () => {
    expect(portfolioContactConfigSchema.safeParse({ tabFontSize: "" }).success).toBe(true);
  });

  it("rejects an out-of-set tabFontSize", () => {
    expect(portfolioContactConfigSchema.safeParse({ tabFontSize: "xl" }).success).toBe(false);
  });

  it("accepts empty string for activeTabRadius (reset to default)", () => {
    expect(portfolioContactConfigSchema.safeParse({ activeTabRadius: "" }).success).toBe(true);
  });

  it("rejects an out-of-set activeTabRadius", () => {
    expect(portfolioContactConfigSchema.safeParse({ activeTabRadius: "pill" }).success).toBe(false);
  });

  it("rejects tabHighlightOpacity out of range", () => {
    expect(portfolioContactConfigSchema.safeParse({ tabHighlightOpacity: 150 }).success).toBe(false);
    expect(portfolioContactConfigSchema.safeParse({ tabHighlightOpacity: -1 }).success).toBe(false);
  });

  it("accepts tabHighlightOpacity at boundaries (0 and 100)", () => {
    expect(portfolioContactConfigSchema.safeParse({ tabHighlightOpacity: 0 }).success).toBe(true);
    expect(portfolioContactConfigSchema.safeParse({ tabHighlightOpacity: 100 }).success).toBe(true);
  });

  it("accepts a hex tabColor (spectrum picker output)", () => {
    expect(portfolioContactConfigSchema.safeParse({ tabColor: "#ff0000" }).success).toBe(true);
  });

  it("accepts a hex tabUnderlineColor", () => {
    expect(portfolioContactConfigSchema.safeParse({ tabUnderlineColor: "#abcdef" }).success).toBe(true);
  });

  it("rejects a tabColor exceeding max length", () => {
    expect(portfolioContactConfigSchema.safeParse({ tabColor: "#" + "a".repeat(32) }).success).toBe(false);
  });

  it("tab fields round-trip through parse", () => {
    const input = {
      tabFontSize: "lg" as const,
      tabColor: "foreground",
      activeTabColor: "accent",
      activeTabScale: false,
      activeTabHighlight: true,
      tabHighlightColor: "#ff0000",
      tabHighlightOpacity: 60,
      activeTabRadius: "rounded" as const,
      activeTabUnderline: false,
      tabUnderlineColor: "",
    };
    const parsed = portfolioContactConfigSchema.parse(input);
    expect(parsed.tabFontSize).toBe("lg");
    expect(parsed.tabColor).toBe("foreground");
    expect(parsed.tabHighlightOpacity).toBe(60);
    expect(parsed.activeTabRadius).toBe("rounded");
  });
});

// ---------------------------------------------------------------------------
// brandKitSchema
// ---------------------------------------------------------------------------

describe("brandKitSchema — valid input", () => {
  it("accepts a valid DEFAULT_BRAND_KIT object", () => {
    const result = brandKitSchema.safeParse(DEFAULT_BRAND_KIT);
    expect(result.success).toBe(true);
  });

  it("accepts uppercase hex colors", () => {
    const result = brandKitSchema.safeParse({
      ...DEFAULT_BRAND_KIT,
      primaryColor: "#AABBCC",
      secondaryColor: "#112233",
    });
    expect(result.success).toBe(true);
  });

  it("accepts mixed-case hex colors", () => {
    const result = brandKitSchema.safeParse({
      ...DEFAULT_BRAND_KIT,
      accentColor: "#aAbBcC",
    });
    expect(result.success).toBe(true);
  });
});

describe("brandKitSchema — invalid hex colors", () => {
  const colorFields: Array<keyof typeof DEFAULT_BRAND_KIT> = [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "backgroundColor",
    "foregroundColor",
  ];

  for (const field of colorFields) {
    it(`rejects color name "red" in ${field}`, () => {
      const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, [field]: "red" });
      expect(result.success).toBe(false);
    });

    it(`rejects invalid hex "#zzz" in ${field}`, () => {
      const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, [field]: "#zzz" });
      expect(result.success).toBe(false);
    });

    it(`rejects empty string in ${field}`, () => {
      const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, [field]: "" });
      expect(result.success).toBe(false);
    });

    it(`rejects 3-digit hex "#abc" in ${field}`, () => {
      const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, [field]: "#abc" });
      expect(result.success).toBe(false);
    });

    it(`rejects hex without hash "aabbcc" in ${field}`, () => {
      const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, [field]: "aabbcc" });
      expect(result.success).toBe(false);
    });
  }
});

describe("brandKitSchema — invalid enums", () => {
  it("rejects unknown themePreset", () => {
    const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, themePreset: "neon" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fontPair", () => {
    const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, fontPair: "comic-sans" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown radius", () => {
    const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, radius: "pill" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown buttonStyle", () => {
    const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, buttonStyle: "ghost" });
    expect(result.success).toBe(false);
  });

  it("rejects all valid themePresets list exhaustively", () => {
    // Positive check — every valid preset must pass
    const validPresets = ["minimal", "editorial", "luxury", "bold", "romantic", "modern"] as const;
    for (const preset of validPresets) {
      const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, themePreset: preset });
      expect(result.success, `expected '${preset}' to be valid`).toBe(true);
    }
  });

  it("rejects all valid fontPairs list exhaustively", () => {
    const validPairs = [
      "merriweather-only",
      "playfair-inter",
      "dm-serif-dm-sans",
      "cormorant-montserrat",
      "fraunces-inter",
    ] as const;
    for (const pair of validPairs) {
      const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, fontPair: pair });
      expect(result.success, `expected '${pair}' to be valid`).toBe(true);
    }
  });

  it("rejects all valid radii list exhaustively", () => {
    const validRadii = ["sharp", "subtle", "rounded"] as const;
    for (const r of validRadii) {
      const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, radius: r });
      expect(result.success, `expected '${r}' to be valid`).toBe(true);
    }
  });

  it("rejects all valid buttonStyles list exhaustively", () => {
    const validStyles = ["solid", "outline", "soft"] as const;
    for (const s of validStyles) {
      const result = brandKitSchema.safeParse({ ...DEFAULT_BRAND_KIT, buttonStyle: s });
      expect(result.success, `expected '${s}' to be valid`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// portfolioPuckDataSchema
// ---------------------------------------------------------------------------

describe("portfolioPuckDataSchema — valid inputs", () => {
  it("accepts { home: null, gallery: null }", () => {
    const result = portfolioPuckDataSchema.safeParse({ home: null, gallery: null });
    expect(result.success).toBe(true);
  });

  it("accepts a valid Puck-shaped object for home with gallery null", () => {
    const result = portfolioPuckDataSchema.safeParse({
      home: {
        root: { props: { someOption: true } },
        content: [
          { type: "Hero", props: { headline: "Welcome" } },
          { type: "CTABanner", props: { text: "Book me" } },
        ],
        zones: {
          "Hero:slot": [{ type: "Image", props: { src: "https://example.com/img.jpg" } }],
        },
      },
      gallery: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid Puck data for both home and gallery", () => {
    const puckPage = {
      root: {},
      content: [{ type: "GalleryGrid", props: { collectionId: "abc123" } }],
    };
    const result = portfolioPuckDataSchema.safeParse({ home: puckPage, gallery: puckPage });
    expect(result.success).toBe(true);
  });

  it("accepts a Puck data object without root or zones (minimal shape)", () => {
    const result = portfolioPuckDataSchema.safeParse({
      home: { content: [] },
      gallery: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("portfolioPuckDataSchema — invalid inputs", () => {
  it("rejects when content is not an array", () => {
    const result = portfolioPuckDataSchema.safeParse({
      home: { content: "not-an-array" },
      gallery: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when content is missing entirely", () => {
    const result = portfolioPuckDataSchema.safeParse({
      home: { root: {} },
      gallery: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when a content entry is missing type", () => {
    const result = portfolioPuckDataSchema.safeParse({
      home: { content: [{ props: { headline: "hi" } }] },
      gallery: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when a content entry is missing props", () => {
    const result = portfolioPuckDataSchema.safeParse({
      home: { content: [{ type: "Hero" }] },
      gallery: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when home is a number instead of object or null", () => {
    const result = portfolioPuckDataSchema.safeParse({ home: 42, gallery: null });
    expect(result.success).toBe(false);
  });

  it("rejects when either field is missing entirely", () => {
    // home field missing
    const result1 = portfolioPuckDataSchema.safeParse({ gallery: null });
    expect(result1.success).toBe(false);

    // gallery field missing
    const result2 = portfolioPuckDataSchema.safeParse({ home: null });
    expect(result2.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// savedThemeSchema
// ---------------------------------------------------------------------------

describe("savedThemeSchema", () => {
  const validTheme = {
    id: "theme-abc-123",
    name: "My Theme",
    brandKit: DEFAULT_BRAND_KIT,
  };

  it("accepts a valid {id, name, brandKit}", () => {
    expect(savedThemeSchema.safeParse(validTheme).success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = savedThemeSchema.safeParse({ ...validTheme, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name that is only whitespace (trim + min 1 check)", () => {
    const result = savedThemeSchema.safeParse({ ...validTheme, name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 60 chars", () => {
    const result = savedThemeSchema.safeParse({ ...validTheme, name: "x".repeat(61) });
    expect(result.success).toBe(false);
  });

  it("accepts name exactly 60 chars", () => {
    const result = savedThemeSchema.safeParse({ ...validTheme, name: "a".repeat(60) });
    expect(result.success).toBe(true);
  });

  it("rejects empty id", () => {
    const result = savedThemeSchema.safeParse({ ...validTheme, id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects id longer than 64 chars", () => {
    const result = savedThemeSchema.safeParse({ ...validTheme, id: "x".repeat(65) });
    expect(result.success).toBe(false);
  });

  it("accepts id exactly 64 chars", () => {
    const result = savedThemeSchema.safeParse({ ...validTheme, id: "a".repeat(64) });
    expect(result.success).toBe(true);
  });

  it("rejects when brandKit is missing", () => {
    const { brandKit: _ignored, ...withoutBrandKit } = validTheme;
    const result = savedThemeSchema.safeParse(withoutBrandKit);
    expect(result.success).toBe(false);
  });

  it("rejects when brandKit has an invalid color", () => {
    const result = savedThemeSchema.safeParse({
      ...validTheme,
      brandKit: { ...DEFAULT_BRAND_KIT, primaryColor: "red" },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// savedThemesSchema
// ---------------------------------------------------------------------------

describe("savedThemesSchema", () => {
  const validTheme = {
    id: "t1",
    name: "Theme 1",
    brandKit: DEFAULT_BRAND_KIT,
  };

  it("accepts an empty array", () => {
    expect(savedThemesSchema.safeParse([]).success).toBe(true);
  });

  it("accepts an array with one valid theme", () => {
    expect(savedThemesSchema.safeParse([validTheme]).success).toBe(true);
  });

  it(`accepts exactly ${SAVED_THEMES_MAX} themes (the max)`, () => {
    const themes = Array.from({ length: SAVED_THEMES_MAX }, (_, i) => ({
      ...validTheme,
      id: `theme-${i}`,
      name: `Theme ${i}`,
    }));
    expect(savedThemesSchema.safeParse(themes).success).toBe(true);
  });

  it(`rejects an array with ${SAVED_THEMES_MAX + 1} themes (over the max)`, () => {
    const themes = Array.from({ length: SAVED_THEMES_MAX + 1 }, (_, i) => ({
      ...validTheme,
      id: `theme-${i}`,
      name: `Theme ${i}`,
    }));
    expect(savedThemesSchema.safeParse(themes).success).toBe(false);
  });

  it("rejects a non-array value", () => {
    expect(savedThemesSchema.safeParse("not-an-array").success).toBe(false);
    expect(savedThemesSchema.safeParse(null).success).toBe(false);
    expect(savedThemesSchema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// brandKitSchema — optional headingFont/bodyFont (back-compat)
// ---------------------------------------------------------------------------

describe("brandKitSchema — optional independent font keys", () => {
  it("accepts a brandKit WITHOUT headingFont/bodyFont (back-compat)", () => {
    const { headingFont: _h, bodyFont: _b, ...withoutFonts } = DEFAULT_BRAND_KIT;
    const result = brandKitSchema.safeParse(withoutFonts);
    expect(result.success).toBe(true);
  });

  it("accepts a brandKit WITH headingFont set to a valid key", () => {
    const result = brandKitSchema.safeParse({
      ...DEFAULT_BRAND_KIT,
      headingFont: "playfair",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a brandKit WITH bodyFont set to a valid key", () => {
    const result = brandKitSchema.safeParse({
      ...DEFAULT_BRAND_KIT,
      bodyFont: "inter",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a brandKit WITH both headingFont and bodyFont set", () => {
    const result = brandKitSchema.safeParse({
      ...DEFAULT_BRAND_KIT,
      headingFont: "fraunces",
      bodyFont: "montserrat",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid headingFont key", () => {
    const result = brandKitSchema.safeParse({
      ...DEFAULT_BRAND_KIT,
      headingFont: "comic-sans",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid bodyFont key", () => {
    const result = brandKitSchema.safeParse({
      ...DEFAULT_BRAND_KIT,
      bodyFont: "times-new-roman",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a legacy fontPair string as headingFont value", () => {
    const result = brandKitSchema.safeParse({
      ...DEFAULT_BRAND_KIT,
      headingFont: "playfair-inter",
    });
    expect(result.success).toBe(false);
  });
});
