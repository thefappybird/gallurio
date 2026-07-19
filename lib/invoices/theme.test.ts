import { describe, it, expect } from "vitest";
import { resolveInvoiceTheme } from "./theme";

describe("resolveInvoiceTheme", () => {
  it("falls back to the classic preset colors when theme is null", () => {
    expect(resolveInvoiceTheme(null)).toEqual({ main: "#1A1A1A", accent: "#FFFFFF" });
  });

  it("resolves a named preset to its fixed colors", () => {
    expect(resolveInvoiceTheme({ preset: "slate", main: "ignored", accent: "ignored" })).toEqual({
      main: "#1E293B",
      accent: "#0EA5A4",
    });
  });

  it("resolves a custom theme to its own main/accent colors", () => {
    expect(resolveInvoiceTheme({ preset: "custom", main: "#111111", accent: "#222222" })).toEqual({
      main: "#111111",
      accent: "#222222",
    });
  });
});
