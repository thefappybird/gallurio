import { describe, it, expect } from "vitest";
import { EMAIL_COPY, emailLocale, lifecycleEmailLocale } from "./messages";

describe("email messages", () => {
  it("maps workspace country to a supported locale", () => {
    expect(emailLocale("PH")).toBe("fil");
    expect(emailLocale("xx")).toBe("en");
    expect(emailLocale(null)).toBe("en");
  });
  it("every copy key has all four locales", () => {
    for (const key of (Object.keys(EMAIL_COPY) as Array<keyof typeof EMAIL_COPY>)) {
      for (const loc of ["en", "fil", "ms", "id"] as const) {
        expect(EMAIL_COPY[key][loc], `${key}.${loc}`).toBeTruthy();
      }
    }
  });
  it("every lifecycle copy key also has Arabic copy", () => {
    const lifecycleKeys = [
      "lifecyclePreExpiry",
      "lifecycleExpired",
      "lifecycleRemind1",
      "lifecycleRemind2",
    ] as const;
    for (const key of lifecycleKeys) {
      expect(EMAIL_COPY[key].ar, `${key}.ar`).toBeTruthy();
    }
  });
  it("resolves Gulf countries to Arabic and leaves others unaffected", () => {
    expect(lifecycleEmailLocale("AE")).toBe("ar");
    expect(lifecycleEmailLocale("sa")).toBe("ar");
    expect(lifecycleEmailLocale("PH")).toBe("fil");
    expect(lifecycleEmailLocale("xx")).toBe("en");
    expect(lifecycleEmailLocale(null)).toBe("en");
  });
});
