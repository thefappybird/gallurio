import { describe, expect, it } from "vitest";
import { localeForCountry, resolvePublicChromeLocale } from "./localeForCountry";
import { routing } from "./routing";

describe("i18n routing", () => {
  it("supports en, fil, id, ar, and th app locales", () => {
    expect(routing.locales).toEqual(["en", "fil", "id", "ar", "th"]);
  });

  it("does not emit hreflang Link response headers from the intl middleware", () => {
    // Editorial pages are English-only and 308-redirect any prefixed alternate
    // (see proxy.ts); a Link header advertising those alternates contradicts
    // the HTML <head> (lib/seo/metadata.ts), which is the GSC "Page with
    // redirect" signal this setting clears.
    expect(routing.alternateLinks).toBe(false);
  });

  it("falls back to English for unsupported countries", () => {
    expect(localeForCountry("VN")).toBe("en");
  });

  it("keeps Gulf tenants on English chrome (Arabic auto-default is deferred)", () => {
    for (const gulf of ["AE", "SA", "QA", "KW", "OM", "BH"]) {
      expect(localeForCountry(gulf)).toBe("en");
    }
  });

  it("falls back to English when a workspace still stores a removed public-page locale", () => {
    expect(resolvePublicChromeLocale({ country: "VN", publicPage: { formLocale: "xx" } })).toBe("en");
  });

  it("honours an explicitly chosen Arabic public-page form locale", () => {
    expect(resolvePublicChromeLocale({ country: "AE", publicPage: { formLocale: "ar" } })).toBe(
      "ar",
    );
  });
});
