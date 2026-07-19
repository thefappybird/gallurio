import { describe, expect, it } from "vitest";
import {
  businessStepSchema,
  workspaceSetupSchema,
  currencySchema,
  coerceBillingCountry,
  slugSchema,
  SUPPORTED_CURRENCIES,
  BILLING_COUNTRY_VALUES,
  COUNTRY_TO_CURRENCY,
} from "./workspace";

const validBusiness = {
  firstName: "Sarah",
  lastName: "Bell",
  name: "Sarah Bell Photography",
  businessType: "photographer" as const,
};

const validWorkspaceSetup = {
  slug: "sarah-bell-photo",
  country: "PH" as const,
  timezone: "Asia/Manila",
  timeFormat: "24h" as const,
};

describe("slugSchema", () => {
  it("accepts lowercase kebab-case", () => {
    expect(slugSchema.safeParse("sarah-bell-photo").success).toBe(true);
    expect(slugSchema.safeParse("a1b2c3").success).toBe(true);
  });

  it("rejects uppercase, spaces, underscores, leading/trailing/double hyphens", () => {
    expect(slugSchema.safeParse("Sarah-Bell").success).toBe(false);
    expect(slugSchema.safeParse("sarah bell").success).toBe(false);
    expect(slugSchema.safeParse("sarah_bell").success).toBe(false);
    expect(slugSchema.safeParse("-sarah").success).toBe(false);
    expect(slugSchema.safeParse("sarah-").success).toBe(false);
    expect(slugSchema.safeParse("sarah--bell").success).toBe(false);
  });

  it("enforces length bounds", () => {
    expect(slugSchema.safeParse("ab").success).toBe(false);
    expect(slugSchema.safeParse("a".repeat(51)).success).toBe(false);
  });

  it("rejects reserved infra labels", () => {
    expect(slugSchema.safeParse("dev").success).toBe(false);
    expect(slugSchema.safeParse("admin").success).toBe(false);
    expect(slugSchema.safeParse("www").success).toBe(false);
    expect(slugSchema.safeParse("banaag-studio").success).toBe(true);
  });
});

describe("businessStepSchema", () => {
  it("accepts a complete valid input", () => {
    expect(businessStepSchema.safeParse(validBusiness).success).toBe(true);
  });

  it("accepts businessType artists", () => {
    expect(
      businessStepSchema.safeParse({ ...validBusiness, businessType: "artists" }).success
    ).toBe(true);
  });

  it("accepts businessType other with a valid businessTypeOther", () => {
    const parsed = businessStepSchema.safeParse({
      ...validBusiness,
      businessType: "other",
      businessTypeOther: "tattoo studio",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.businessTypeOther).toBe("tattoo studio");
  });

  it("rejects businessType other with an empty businessTypeOther", () => {
    const parsed = businessStepSchema.safeParse({
      ...validBusiness,
      businessType: "other",
      businessTypeOther: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["businessTypeOther"]);
    }
  });

  it("accepts a non-other businessType with an empty businessTypeOther", () => {
    const parsed = businessStepSchema.safeParse({
      ...validBusiness,
      businessType: "photographer",
      businessTypeOther: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("trims firstName and name", () => {
    const parsed = businessStepSchema.safeParse({
      ...validBusiness,
      firstName: "  Sarah  ",
      name: "  Sarah Bell Photography  ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.firstName).toBe("Sarah");
      expect(parsed.data.name).toBe("Sarah Bell Photography");
    }
  });
});

describe("workspaceSetupSchema", () => {
  it("accepts a valid input and has no currency field", () => {
    expect(workspaceSetupSchema.safeParse(validWorkspaceSetup).success).toBe(true);
    expect(workspaceSetupSchema.shape).not.toHaveProperty("currency");
  });

  it("rejects an unsupported country, an empty timezone, and an invalid timeFormat", () => {
    expect(workspaceSetupSchema.safeParse({ ...validWorkspaceSetup, country: "JP" }).success).toBe(
      false
    );
    expect(workspaceSetupSchema.safeParse({ ...validWorkspaceSetup, timezone: "" }).success).toBe(
      false
    );
    expect(
      workspaceSetupSchema.safeParse({ ...validWorkspaceSetup, timeFormat: "36h" }).success
    ).toBe(false);
    expect(
      workspaceSetupSchema.safeParse({ ...validWorkspaceSetup, timeFormat: "12h" }).success
    ).toBe(true);
  });
});

describe("coerceBillingCountry", () => {
  it("returns supported values as-is and falls back to PH (or a custom fallback) otherwise", () => {
    expect(coerceBillingCountry("SG")).toBe("SG");
    expect(coerceBillingCountry(null)).toBe("PH");
    expect(coerceBillingCountry(undefined)).toBe("PH");
    expect(coerceBillingCountry("ZZ")).toBe("PH");
    expect(coerceBillingCountry("ZZ", "US")).toBe("US");
  });
});

describe("currency / country tables stay in sync", () => {
  it("every billing country maps to a supported currency", () => {
    for (const country of BILLING_COUNTRY_VALUES) {
      const currency = COUNTRY_TO_CURRENCY[country];
      expect(SUPPORTED_CURRENCIES).toContain(currency);
    }
  });

  it("every supported currency is reachable via at least one country", () => {
    const reachable = new Set(Object.values(COUNTRY_TO_CURRENCY));
    for (const currency of SUPPORTED_CURRENCIES) {
      expect(reachable.has(currency)).toBe(true);
    }
  });

  it("Gulf countries each map to their correct currency", () => {
    expect(COUNTRY_TO_CURRENCY["AE"]).toBe("AED");
    expect(COUNTRY_TO_CURRENCY["SA"]).toBe("SAR");
    expect(COUNTRY_TO_CURRENCY["QA"]).toBe("QAR");
    expect(COUNTRY_TO_CURRENCY["KW"]).toBe("KWD");
    expect(COUNTRY_TO_CURRENCY["OM"]).toBe("OMR");
    expect(COUNTRY_TO_CURRENCY["BH"]).toBe("BHD");
  });

  it("Gulf currencies are accepted by the currency zod enum", () => {
    expect(currencySchema.safeParse("AED").success).toBe(true);
    expect(currencySchema.safeParse("SAR").success).toBe(true);
    expect(currencySchema.safeParse("QAR").success).toBe(true);
    expect(currencySchema.safeParse("KWD").success).toBe(true);
    expect(currencySchema.safeParse("OMR").success).toBe(true);
    expect(currencySchema.safeParse("BHD").success).toBe(true);
  });

  it("Gulf countries are accepted by the country zod enum", () => {
    const { country } = workspaceSetupSchema.shape;
    expect(country.safeParse("AE").success).toBe(true);
    expect(country.safeParse("SA").success).toBe(true);
    expect(country.safeParse("QA").success).toBe(true);
    expect(country.safeParse("KW").success).toBe(true);
    expect(country.safeParse("OM").success).toBe(true);
    expect(country.safeParse("BH").success).toBe(true);
  });

  it("rejects unsupported country codes", () => {
    const { country } = workspaceSetupSchema.shape;
    expect(country.safeParse("ZZ").success).toBe(false);
    expect(country.safeParse("JP").success).toBe(false);
  });

  it("rejects unsupported currency codes", () => {
    expect(currencySchema.safeParse("XYZ").success).toBe(false);
    expect(currencySchema.safeParse("JPY").success).toBe(false);
  });
});

// ---- Post-onboarding settings schemas ----------------------------------------

import {
  updateWorkspaceBusinessSchema,
  publicPageSettingsSchema,
} from "./workspace";

const validUpdateBusiness = {
  name: "Sarah Bell Photography",
  slug: "sarah-bell-photo",
  businessType: "photographer" as const,
  country: "PH" as const,
  currency: "PHP" as const,
  timezone: "Asia/Manila",
};

describe("updateWorkspaceBusinessSchema", () => {
  it("accepts a fully valid input", () => {
    expect(updateWorkspaceBusinessSchema.safeParse(validUpdateBusiness).success).toBe(true);
  });

  it("requires currency", () => {
    const { currency: _omit, ...rest } = validUpdateBusiness;
    void _omit;
    expect(updateWorkspaceBusinessSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects businessType other with an empty businessTypeOther", () => {
    const bad = updateWorkspaceBusinessSchema.safeParse({
      ...validUpdateBusiness,
      businessType: "other",
      businessTypeOther: "",
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.path).toEqual(["businessTypeOther"]);
    }
  });

  it("accepts businessType artists", () => {
    expect(
      updateWorkspaceBusinessSchema.safeParse({ ...validUpdateBusiness, businessType: "artists" })
        .success
    ).toBe(true);
  });

  it("accepts businessType other with a valid businessTypeOther", () => {
    const ok = updateWorkspaceBusinessSchema.safeParse({
      ...validUpdateBusiness,
      businessType: "other",
      businessTypeOther: "tattoo studio",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.businessTypeOther).toBe("tattoo studio");
  });

  it("accepts a non-other businessType with an empty businessTypeOther", () => {
    expect(
      updateWorkspaceBusinessSchema.safeParse({
        ...validUpdateBusiness,
        businessType: "photographer",
        businessTypeOther: "",
      }).success
    ).toBe(true);
  });

  it("rejects an unsupported country", () => {
    const bad = updateWorkspaceBusinessSchema.safeParse({
      ...validUpdateBusiness,
      country: "JP",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects an unsupported currency", () => {
    const bad = updateWorkspaceBusinessSchema.safeParse({
      ...validUpdateBusiness,
      currency: "JPY",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects a slug with uppercase letters", () => {
    expect(
      updateWorkspaceBusinessSchema.safeParse({ ...validUpdateBusiness, slug: "Sarah-Bell" })
        .success
    ).toBe(false);
  });

  it("defaults contactEmail, contactAddress, logoUrl, logoAssetId to empty string when omitted", () => {
    const result = updateWorkspaceBusinessSchema.safeParse(validUpdateBusiness);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contactEmail).toBe("");
      expect(result.data.contactAddress).toBe("");
      expect(result.data.logoUrl).toBe("");
      expect(result.data.logoAssetId).toBe("");
    }
  });

  it("accepts a valid contactEmail and logoUrl, preserves them through parse", () => {
    const result = updateWorkspaceBusinessSchema.safeParse({
      ...validUpdateBusiness,
      contactEmail: "hello@sarah.com",
      contactAddress: "123 Manila St",
      logoUrl: "https://cdn.example.com/logo.png",
      logoAssetId: "logo_abc",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contactEmail).toBe("hello@sarah.com");
      expect(result.data.contactAddress).toBe("123 Manila St");
      expect(result.data.logoUrl).toBe("https://cdn.example.com/logo.png");
      expect(result.data.logoAssetId).toBe("logo_abc");
    }
  });

  it("rejects an invalid contactEmail", () => {
    const result = updateWorkspaceBusinessSchema.safeParse({
      ...validUpdateBusiness,
      contactEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-URL non-empty logoUrl", () => {
    const result = updateWorkspaceBusinessSchema.safeParse({
      ...validUpdateBusiness,
      logoUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional contactAddressLat/Lng within range and rejects out-of-range values", () => {
    const ok = updateWorkspaceBusinessSchema.safeParse({
      ...validUpdateBusiness,
      contactAddressLat: 14.5995,
      contactAddressLng: 120.9842,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.contactAddressLat).toBe(14.5995);
      expect(ok.data.contactAddressLng).toBe(120.9842);
    }

    const bad = updateWorkspaceBusinessSchema.safeParse({
      ...validUpdateBusiness,
      contactAddressLat: 200,
    });
    expect(bad.success).toBe(false);
  });
});

describe("publicPageSettingsSchema", () => {
  it("accepts an empty object (all fields optional with defaults)", () => {
    const result = publicPageSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inquiryRecipientEmail).toBe("");
      expect(result.data.seoTitle).toBe("");
      expect(result.data.seoDescription).toBe("");
    }
  });

  it("allows empty string for inquiryRecipientEmail", () => {
    const ok = publicPageSettingsSchema.safeParse({ inquiryRecipientEmail: "" });
    expect(ok.success).toBe(true);
  });

  it("accepts a valid email for inquiryRecipientEmail", () => {
    const ok = publicPageSettingsSchema.safeParse({
      inquiryRecipientEmail: "hello@studio.com",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.inquiryRecipientEmail).toBe("hello@studio.com");
  });

  it("rejects an invalid email for inquiryRecipientEmail", () => {
    const bad = publicPageSettingsSchema.safeParse({
      inquiryRecipientEmail: "not-an-email",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects seoTitle over 70 characters", () => {
    const bad = publicPageSettingsSchema.safeParse({
      seoTitle: "a".repeat(71),
    });
    expect(bad.success).toBe(false);
  });

  it("accepts seoTitle of exactly 70 characters", () => {
    const ok = publicPageSettingsSchema.safeParse({ seoTitle: "a".repeat(70) });
    expect(ok.success).toBe(true);
  });

  it("rejects seoDescription over 160 characters", () => {
    const bad = publicPageSettingsSchema.safeParse({
      seoDescription: "a".repeat(161),
    });
    expect(bad.success).toBe(false);
  });

  it("accepts seoDescription of exactly 160 characters", () => {
    const ok = publicPageSettingsSchema.safeParse({
      seoDescription: "a".repeat(160),
    });
    expect(ok.success).toBe(true);
  });

  it("accepts valid siteIconUrl and preserves it in output", () => {
    const result = publicPageSettingsSchema.safeParse({
      siteIconUrl: "https://example.com/icon.png",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as { siteIconUrl?: string }).siteIconUrl).toBe(
        "https://example.com/icon.png"
      );
    }
  });

  it("accepts empty string siteIconUrl", () => {
    const result = publicPageSettingsSchema.safeParse({ siteIconUrl: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as { siteIconUrl?: string }).siteIconUrl).toBe("");
    }
  });

  it("defaults siteIconUrl to empty string when omitted", () => {
    const result = publicPageSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as { siteIconUrl?: string }).siteIconUrl).toBe("");
    }
  });

  it("rejects non-URL non-empty siteIconUrl", () => {
    const result = publicPageSettingsSchema.safeParse({ siteIconUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("accepts siteIconAssetId and preserves it in output", () => {
    const result = publicPageSettingsSchema.safeParse({ siteIconAssetId: "abc123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as { siteIconAssetId?: string }).siteIconAssetId).toBe("abc123");
    }
  });

  it("defaults logoUrl and logoAssetId to empty string when omitted", () => {
    const result = publicPageSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as { logoUrl?: string }).logoUrl).toBe("");
      expect((result.data as { logoAssetId?: string }).logoAssetId).toBe("");
    }
  });
});

describe("publicPageSettingsSchema — seo sub-object", () => {
  it("accepts an empty object (seo omitted) — seo is undefined, parse still succeeds", () => {
    const result = publicPageSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      const seo = (result.data as { seo?: { noindex?: boolean } }).seo;
      expect(seo).toBeUndefined();
    }
  });

  it("when seo is provided as an empty object, noindex defaults to false", () => {
    const result = publicPageSettingsSchema.safeParse({ seo: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      const seo = (result.data as { seo?: { noindex?: boolean; keywords?: string[] } }).seo;
      expect(seo?.noindex).toBe(false);
      expect(seo?.keywords).toEqual([]);
    }
  });

  it("accepts up to 10 seo.keywords and preserves them", () => {
    const result = publicPageSettingsSchema.safeParse({
      seo: { keywords: ["wedding", "editorial", "bay area"] },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as { seo: { keywords: string[] } }).seo.keywords).toEqual([
        "wedding",
        "editorial",
        "bay area",
      ]);
    }
  });

  it("rejects more than 10 seo.keywords", () => {
    const result = publicPageSettingsSchema.safeParse({
      seo: { keywords: Array.from({ length: 11 }, (_, i) => `kw${i}`) },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an seo keyword longer than 40 characters", () => {
    const result = publicPageSettingsSchema.safeParse({
      seo: { keywords: ["a".repeat(41)] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects seo.galleryDescription over 160 characters", () => {
    const result = publicPageSettingsSchema.safeParse({
      seo: { galleryDescription: "a".repeat(161) },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-URL non-empty seo.ogImageUrl", () => {
    const result = publicPageSettingsSchema.safeParse({
      seo: { ogImageUrl: "not-a-url" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid https URL for seo.ogImageUrl", () => {
    const result = publicPageSettingsSchema.safeParse({
      seo: { ogImageUrl: "https://imagedelivery.net/abc/def/public" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as { seo: { ogImageUrl: string } }).seo.ogImageUrl).toBe(
        "https://imagedelivery.net/abc/def/public"
      );
    }
  });

  it("accepts seo.noindex true and preserves it through parse", () => {
    const result = publicPageSettingsSchema.safeParse({ seo: { noindex: true } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as { seo: { noindex: boolean } }).seo.noindex).toBe(true);
    }
  });
});
