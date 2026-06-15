import { describe, expect, it } from "vitest";
import {
  businessStepSchema,
  brandingStepSchema,
  slugSchema,
  SUPPORTED_CURRENCIES,
  BILLING_COUNTRY_VALUES,
  COUNTRY_TO_CURRENCY,
} from "./workspace";

const validBusiness = {
  firstName: "Sarah",
  lastName: "Bell",
  name: "Sarah Bell Photography",
  slug: "sarah-bell-photo",
  businessType: "photographer" as const,
  country: "PH" as const,
  currency: "PHP" as const,
  timezone: "Asia/Manila",
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
});

describe("businessStepSchema", () => {
  it("accepts a complete valid input", () => {
    expect(businessStepSchema.safeParse(validBusiness).success).toBe(true);
  });

  it("requires currency", () => {
    const { currency: _omit, ...rest } = validBusiness;
    void _omit;
    const parsed = businessStepSchema.safeParse(rest);
    expect(parsed.success).toBe(false);
  });

  it("rejects an unsupported currency", () => {
    const parsed = businessStepSchema.safeParse({ ...validBusiness, currency: "JPY" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unsupported country", () => {
    const parsed = businessStepSchema.safeParse({ ...validBusiness, country: "JP" });
    expect(parsed.success).toBe(false);
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
    const { currency } = businessStepSchema.shape;
    expect(currency.safeParse("AED").success).toBe(true);
    expect(currency.safeParse("SAR").success).toBe(true);
    expect(currency.safeParse("QAR").success).toBe(true);
    expect(currency.safeParse("KWD").success).toBe(true);
    expect(currency.safeParse("OMR").success).toBe(true);
    expect(currency.safeParse("BHD").success).toBe(true);
  });

  it("Gulf countries are accepted by the country zod enum", () => {
    const { country } = businessStepSchema.shape;
    expect(country.safeParse("AE").success).toBe(true);
    expect(country.safeParse("SA").success).toBe(true);
    expect(country.safeParse("QA").success).toBe(true);
    expect(country.safeParse("KW").success).toBe(true);
    expect(country.safeParse("OM").success).toBe(true);
    expect(country.safeParse("BH").success).toBe(true);
  });

  it("rejects unsupported country codes", () => {
    const { country } = businessStepSchema.shape;
    expect(country.safeParse("ZZ").success).toBe(false);
    expect(country.safeParse("JP").success).toBe(false);
  });

  it("rejects unsupported currency codes", () => {
    const { currency } = businessStepSchema.shape;
    expect(currency.safeParse("XYZ").success).toBe(false);
    expect(currency.safeParse("JPY").success).toBe(false);
  });
});

describe("brandingStepSchema", () => {
  it("requires 6-digit hex colors", () => {
    const ok = brandingStepSchema.safeParse({
      primaryColor: "#1a1a1a",
      secondaryColor: "#f5f5f5",
    });
    expect(ok.success).toBe(true);

    const bad = brandingStepSchema.safeParse({
      primaryColor: "blue",
      secondaryColor: "#f5f5f5",
    });
    expect(bad.success).toBe(false);
  });
});

// ---- Post-onboarding settings schemas ----------------------------------------

import {
  updateWorkspaceBusinessSchema,
  updateWorkspaceBrandingSchema,
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
});

const validUpdateBranding = {
  primaryColor: "#1a1a1a",
  secondaryColor: "#f5f5f5",
};

describe("updateWorkspaceBrandingSchema", () => {
  it("accepts valid hex colors with no optional fields", () => {
    expect(updateWorkspaceBrandingSchema.safeParse(validUpdateBranding).success).toBe(true);
  });

  it("accepts valid hex colors with all optional fields", () => {
    const ok = updateWorkspaceBrandingSchema.safeParse({
      ...validUpdateBranding,
      logoUrl: "https://example.com/logo.png",
      logoAssetId: "gallurio/ws_123/logo",
      tagline: "Your perfect moment, captured.",
      description: "We shoot weddings and portraits across the Philippines.",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects an invalid hex color (no hash)", () => {
    const bad = updateWorkspaceBrandingSchema.safeParse({
      ...validUpdateBranding,
      primaryColor: "blue",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects a 3-digit shorthand hex", () => {
    const bad = updateWorkspaceBrandingSchema.safeParse({
      ...validUpdateBranding,
      secondaryColor: "#fff",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects tagline over 120 characters", () => {
    const bad = updateWorkspaceBrandingSchema.safeParse({
      ...validUpdateBranding,
      tagline: "a".repeat(121),
    });
    expect(bad.success).toBe(false);
  });

  it("accepts tagline of exactly 120 characters", () => {
    const ok = updateWorkspaceBrandingSchema.safeParse({
      ...validUpdateBranding,
      tagline: "a".repeat(120),
    });
    expect(ok.success).toBe(true);
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
});
