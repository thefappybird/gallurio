import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";
import th from "@/messages/th.json";
import id from "@/messages/id.json";

const REQUIRED_KEYS = [
  "themes",
  "searchPlaceholder",
  "noThemesMatch",
  "prevPage",
  "nextPage",
  "pageIndicator",
  "applyTheme",
  "deleteTheme",
  "saveCurrentAsTheme",
  "themeNamePlaceholder",
  "saveAction",
  "enterThemeName",
  "nameTooLong",
  "saveThemeError",
  "themeLimitReached",
  "currentTheme",
  "editTheme",
  "editThemeName",
  "overrideCurrentTitle",
  "overrideCurrentBody",
  "continueAction",
  "cancelAction",
  "unsavedChangesTitle",
  "unsavedChangesBody",
  "discardAction",
  "saveAndCloseAction",
  "themeNameExists",
  "applyAction",
  "saveThemeName",
  "curatedFontsGroup",
  "googleFontsGroup",
  "customGoogleFontOption",
] as const;

const locales = { en, fil, th, id } as const;

describe("brandKit locale keys", () => {
  for (const [name, messages] of Object.entries(locales)) {
    it(`${name} defines all new theme-grid keys`, () => {
      const bk = (messages as unknown as {
        app: { pageBuilder: { brandKit: Record<string, string> } };
      }).app.pageBuilder.brandKit;
      for (const key of REQUIRED_KEYS) {
        expect(typeof bk[key], `${name}.${key}`).toBe("string");
        expect(bk[key].length, `${name}.${key}`).toBeGreaterThan(0);
      }
    });
  }

  it("interpolation placeholders are present where required", () => {
    const bk = (en as unknown as {
      app: { pageBuilder: { brandKit: Record<string, string> } };
    }).app.pageBuilder.brandKit;
    expect(bk.applyTheme).toContain("{name}");
    expect(bk.deleteTheme).toContain("{name}");
    expect(bk.pageIndicator).toContain("{current}");
    expect(bk.pageIndicator).toContain("{total}");
    expect(bk.themeLimitReached).toContain("{max}");
    expect(bk.editTheme).toContain("{name}");
    expect(bk.overrideCurrentBody).toContain("{name}");
  });
});
