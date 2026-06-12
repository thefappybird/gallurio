import { describe, it, expect } from "vitest";
import type { PortfolioCollectionsPopupConfig } from "./types";

describe("PortfolioCollectionsPopupConfig title + button fields", () => {
  it("accepts the new optional fields", () => {
    const c: PortfolioCollectionsPopupConfig = {
      titleText: "Custom",
      titleFontSize: 24,
      titleColorToken: "primary",
      titleBold: true,
      titleItalic: false,
      titleUnderline: false,
      titleAlign: "center",
      closeButtonSize: 40,
      closeButtonRadius: "rounded",
      closeButtonBorderWidth: 1,
      closeButtonBorderColorToken: "foreground",
      closeButtonOpacity: 80,
      closeButtonBgColorToken: "background",
    };
    expect(c.titleText).toBe("Custom");
    expect(c.closeButtonSize).toBe(40);
  });
});
