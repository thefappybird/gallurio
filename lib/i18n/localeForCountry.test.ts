import { describe, expect, it } from "vitest";
import { localeForCountry } from "./localeForCountry";

describe("localeForCountry", () => {
  it("returns fil for PH", () => {
    expect(localeForCountry("PH")).toBe("fil");
    expect(localeForCountry("ph")).toBe("fil");
  });

  it("returns id for ID", () => {
    expect(localeForCountry("ID")).toBe("id");
    expect(localeForCountry("id")).toBe("id");
  });

  it("returns th for TH", () => {
    expect(localeForCountry("TH")).toBe("th");
    expect(localeForCountry("th")).toBe("th");
  });

  it("returns en for SG", () => {
    expect(localeForCountry("SG")).toBe("en");
  });

  it("returns en for English-primary markets (AU, CA, NZ, GB, US)", () => {
    expect(localeForCountry("AU")).toBe("en");
    expect(localeForCountry("CA")).toBe("en");
    expect(localeForCountry("NZ")).toBe("en");
    expect(localeForCountry("GB")).toBe("en");
    expect(localeForCountry("US")).toBe("en");
  });

  it("returns en for Gulf markets (Arabic locale deferred)", () => {
    expect(localeForCountry("AE")).toBe("en");
    expect(localeForCountry("SA")).toBe("en");
    expect(localeForCountry("QA")).toBe("en");
    expect(localeForCountry("KW")).toBe("en");
    expect(localeForCountry("OM")).toBe("en");
    expect(localeForCountry("BH")).toBe("en");
  });

  it("returns en for unknown country codes", () => {
    expect(localeForCountry("JP")).toBe("en");
    expect(localeForCountry("ZZ")).toBe("en");
    expect(localeForCountry("XX")).toBe("en");
  });

  it("returns en for null input", () => {
    expect(localeForCountry(null)).toBe("en");
  });

  it("returns en for undefined input", () => {
    expect(localeForCountry(undefined)).toBe("en");
  });

  it("returns en for empty string", () => {
    expect(localeForCountry("")).toBe("en");
  });
});
