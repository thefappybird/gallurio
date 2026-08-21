import { describe, it, expect } from "vitest";
import { tierForCountry } from "./pricingTier";

describe("tierForCountry", () => {
  it("returns 'global' for a high-income country", () => {
    expect(tierForCountry("US")).toBe("global");
  });

  it("returns 'base' for the launch market", () => {
    expect(tierForCountry("PH")).toBe("base");
  });

  it("returns 'base' for Cloudflare's unknown-country code XX", () => {
    expect(tierForCountry("XX")).toBe("base");
  });

  it("returns 'base' for Tor traffic (T1)", () => {
    expect(tierForCountry("T1")).toBe("base");
  });

  it("returns 'base' for a missing country", () => {
    expect(tierForCountry(null)).toBe("base");
    expect(tierForCountry(undefined)).toBe("base");
  });

  it("normalizes casing", () => {
    expect(tierForCountry("us")).toBe("global");
  });

  it("maps every documented global country", () => {
    const globalCountries = [
      "US", "CA", "GB", "IE", "FR", "DE", "NL", "BE", "LU", "AT", "CH", "DK",
      "SE", "NO", "FI", "IS", "IT", "ES", "PT", "AU", "NZ", "JP", "SG", "HK",
      "KR", "TW", "IL", "AE",
    ];
    for (const country of globalCountries) {
      expect(tierForCountry(country)).toBe("global");
    }
  });
});
