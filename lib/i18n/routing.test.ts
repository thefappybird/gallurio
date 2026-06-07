import { describe, expect, it } from "vitest";
import { localeForCountry, resolvePublicChromeLocale } from "./localeForCountry";
import { routing } from "./routing";

describe("i18n routing", () => {
  it("supports only en, fil, ms, and id app locales", () => {
    expect(routing.locales).toEqual(["en", "fil", "ms", "id"]);
  });

  it("falls back to English for unsupported countries", () => {
    expect(localeForCountry("VN")).toBe("en");
  });

  it("falls back to English when a workspace still stores a removed public-page locale", () => {
    expect(resolvePublicChromeLocale({ country: "VN", publicPage: { formLocale: "xx" } })).toBe("en");
  });
});
