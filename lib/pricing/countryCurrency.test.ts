import { describe, it, expect } from "vitest";
import { currencyForCountry } from "./countryCurrency";

describe("currencyForCountry", () => {
  it("maps a known country code to its currency", () => {
    expect(currencyForCountry("PH")).toBe("PHP");
  });

  it("falls back to USD for an unmapped or missing country", () => {
    expect(currencyForCountry("ZZ")).toBe("USD");
    expect(currencyForCountry(null)).toBe("USD");
    expect(currencyForCountry(undefined)).toBe("USD");
    expect(currencyForCountry("")).toBe("USD");
  });

  it("normalizes casing and surrounding whitespace", () => {
    expect(currencyForCountry("ae")).toBe("AED");
    expect(currencyForCountry(" th ")).toBe("THB");
  });

  it("maps every euro-area member in the table to EUR", () => {
    for (const country of ["DE", "FR", "ES", "IT", "NL", "IE", "PT", "FI", "AT", "BE"]) {
      expect(currencyForCountry(country)).toBe("EUR");
    }
  });
});
