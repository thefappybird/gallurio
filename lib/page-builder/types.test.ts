import { describe, it, expect } from "vitest";
import type { PortfolioCollectionsPopupConfig } from "./types";
import { resolvePopupLayout, resolveImageModalLayout } from "./types";

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

  it("accepts popupLayout and imageModalLayout", () => {
    const c: PortfolioCollectionsPopupConfig = {
      popupLayout: "immersive",
      imageModalLayout: "cinema",
    };
    expect(c.popupLayout).toBe("immersive");
    expect(c.imageModalLayout).toBe("cinema");
  });
});

describe("resolvePopupLayout", () => {
  it("resolves '' to 'contact-sheet'", () => {
    expect(resolvePopupLayout("")).toBe("contact-sheet");
  });
  it("resolves undefined to 'contact-sheet'", () => {
    expect(resolvePopupLayout(undefined)).toBe("contact-sheet");
  });
  it("passes through a real value", () => {
    expect(resolvePopupLayout("split-index")).toBe("split-index");
  });
});

describe("resolveImageModalLayout", () => {
  it("resolves '' to 'caption'", () => {
    expect(resolveImageModalLayout("")).toBe("caption");
  });
  it("resolves undefined to 'caption'", () => {
    expect(resolveImageModalLayout(undefined)).toBe("caption");
  });
  it("passes through a real value", () => {
    expect(resolveImageModalLayout("sheet")).toBe("sheet");
  });
});
