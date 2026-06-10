import { describe, it, expect } from "vitest";
import { normalizeThemeName, isThemeNameTaken } from "./themeNames";

const saved = [
  { id: "1", name: "My Wedding" },
  { id: "2", name: "Studio Dark" },
];

describe("normalizeThemeName", () => {
  it("trims and lowercases", () => {
    expect(normalizeThemeName("  My Theme  ")).toBe("my theme");
  });
});

describe("isThemeNameTaken", () => {
  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(isThemeNameTaken("my wedding", saved)).toBe(true);
    expect(isThemeNameTaken("  STUDIO DARK ", saved)).toBe(true);
  });
  it("is false for a free name", () => {
    expect(isThemeNameTaken("Spring 26", saved)).toBe(false);
  });
  it("excludes the theme's own id (rename keeping the same name)", () => {
    expect(isThemeNameTaken("My Wedding", saved, "1")).toBe(false);
    expect(isThemeNameTaken("My Wedding", saved, "2")).toBe(true);
  });
  it("treats an empty name as not taken (other validation handles it)", () => {
    expect(isThemeNameTaken("   ", saved)).toBe(false);
  });
});
