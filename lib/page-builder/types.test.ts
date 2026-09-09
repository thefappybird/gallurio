import { describe, it, expect } from "vitest";
import type { PortfolioCollectionsPopupConfig } from "./types";
import { resolvePopupColumns, resolvePopupLayout, resolveImageModalLayout, resolveNavOrder } from "./types";

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
      popupColumns: 5,
      imageModalLayout: "cinema",
    };
    expect(c.popupLayout).toBe("immersive");
    expect(c.popupColumns).toBe(5);
    expect(c.imageModalLayout).toBe("cinema");
  });
});

describe("resolvePopupColumns", () => {
  it("defaults unset and invalid values to three", () => {
    expect(resolvePopupColumns(undefined)).toBe(3);
    expect(resolvePopupColumns(0)).toBe(3);
    expect(resolvePopupColumns(7)).toBe(3);
  });

  it("passes through supported column counts", () => {
    expect(resolvePopupColumns(1)).toBe(1);
    expect(resolvePopupColumns(6)).toBe(6);
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

describe("resolveNavOrder", () => {
  const DEFAULT = ["logo", "home", "gallery", "contact"];

  it("defaults undefined, empty, and non-array input to the default order", () => {
    expect(resolveNavOrder(undefined)).toEqual(DEFAULT);
    expect(resolveNavOrder([])).toEqual(DEFAULT);
    expect(resolveNavOrder("garbage")).toEqual(DEFAULT);
    expect(resolveNavOrder(null)).toEqual(DEFAULT);
  });

  it("passes through a full valid permutation unchanged", () => {
    expect(resolveNavOrder(["contact", "gallery", "home", "logo"])).toEqual([
      "contact",
      "gallery",
      "home",
      "logo",
    ]);
  });

  it("appends missing keys in their default relative order", () => {
    expect(resolveNavOrder(["contact", "logo"])).toEqual(["contact", "logo", "home", "gallery"]);
  });

  it("dedupes repeated keys, keeping the first occurrence's position", () => {
    expect(resolveNavOrder(["contact", "contact", "home"])).toEqual(["contact", "home", "logo", "gallery"]);
  });

  it("drops unknown keys", () => {
    expect(resolveNavOrder(["fake", "home"])).toEqual(["home", "logo", "gallery", "contact"]);
  });
});
