import { describe, expect, it } from "vitest";
import { localeForCountry, resolvePublicChromeLocale } from "./localeForCountry";
import { routing } from "./routing";

describe("i18n routing", () => {
  it("supports en, fil, ms, id, and ar app locales", () => {
    expect(routing.locales).toEqual(["en", "fil", "ms", "id", "ar"]);
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
