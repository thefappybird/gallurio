import { describe, it, expect } from "vitest";
import { invoiceThemeSchema } from "./invoiceTheme";

describe("invoiceThemeSchema", () => {
  it("accepts a valid preset with hex colors", () => {
    const result = invoiceThemeSchema.safeParse({
      preset: "classic",
      main: "#1a1a1a",
      accent: "#ffffff",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-hex color", () => {
    const result = invoiceThemeSchema.safeParse({
      preset: "custom",
      main: "black",
      accent: "#ffffff",
    });
    expect(result.success).toBe(false);
  });
});
