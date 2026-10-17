import { describe, it, expect } from "vitest";
import { invoiceThemeSchema } from "./invoiceTheme";

describe("invoiceThemeSchema", () => {
  it("accepts a valid preset with hex colors", () => {
    const result = invoiceThemeSchema.safeParse({
      preset: "minimal",
      main: "#1a1a1a",
      accent: "#ffffff",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a legacy preset id (normalized on read, not accepted on write)", () => {
    const result = invoiceThemeSchema.safeParse({
      preset: "classic",
      main: "#1a1a1a",
      accent: "#ffffff",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the portfolio preset", () => {
    const result = invoiceThemeSchema.safeParse({
      preset: "portfolio",
      main: "#1a1a1a",
      accent: "#ffffff",
    });
    expect(result.success).toBe(true);
  });

  it("accepts the saved preset with a savedThemeId", () => {
    const result = invoiceThemeSchema.safeParse({
      preset: "saved",
      savedThemeId: "theme_1",
      main: "#1a1a1a",
      accent: "#ffffff",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a savedThemeId longer than 64 characters", () => {
    const result = invoiceThemeSchema.safeParse({
      preset: "saved",
      savedThemeId: "x".repeat(65),
      main: "#1a1a1a",
      accent: "#ffffff",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an optional hex text color", () => {
    const result = invoiceThemeSchema.safeParse({
      preset: "custom",
      main: "#1a1a1a",
      accent: "#ffffff",
      text: "#222222",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-hex text color", () => {
    const result = invoiceThemeSchema.safeParse({
      preset: "custom",
      main: "#1a1a1a",
      accent: "#ffffff",
      text: "dark",
    });
    expect(result.success).toBe(false);
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
