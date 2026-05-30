import { describe, it, expect } from "vitest";
import {
  brandKitSchema,
  portfolioPuckDataSchema,
  portfolioContactConfigSchema,
} from "./publicPage";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

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

  it("rejects an out-of-set button color (arbitrary hex is not allowed)", () => {
    const result = portfolioContactConfigSchema.safeParse({ buttonColor: "#ff0000" });
    expect(result.success).toBe(false);
  });

  it("rejects an over-long title", () => {
    const result = portfolioContactConfigSchema.safeParse({ title: "x".repeat(81) });
    expect(result.success).toBe(false);
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
