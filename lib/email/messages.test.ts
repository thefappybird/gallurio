import { describe, it, expect } from "vitest";
import { EMAIL_COPY, emailLocale } from "./messages";

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
});
