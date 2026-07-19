import { describe, it, expect } from "vitest";
import {
  contactGridTemplate,
  buildContactLabelStyle,
  buildContactValueStyle,
  buildContactIconColor,
  buildContactIconSize,
} from "../styleToolkit";
import { normalizeSocialUrl } from "./ContactDetailsBlock";

describe("contactGridTemplate", () => {
  it("returns a 1-column template when columns is undefined", () => {
    expect(contactGridTemplate(undefined)).toBe("repeat(1, minmax(0, 1fr))");
  });
});

describe("buildContactLabelStyle", () => {
  it("returns sensible defaults with no style", () => {
    const css = buildContactLabelStyle();
    expect(css.fontSize).toBe("0.6875rem");
    expect(css.fontWeight).toBe(700);
    expect(css.textTransform).toBe("uppercase");
    expect(css.color).toBe("var(--pf-color-fg)");
    expect(Number(css.opacity)).toBeCloseTo(0.45);
  });

  it("applies labelColorToken and clears opacity", () => {
    const css = buildContactLabelStyle({ labelColorToken: "accent" });
    expect(css.color).toBe("var(--pf-color-accent)");
    expect(css.opacity).toBe(1);
  });
});

describe("buildContactValueStyle", () => {
  it("returns accent color by default", () => {
    const css = buildContactValueStyle();
    expect(css.color).toBe("var(--pf-color-accent)");
    expect(css.margin).toBe(0);
  });
});

describe("normalizeSocialUrl — instagram", () => {
  it("prefixes a bare handle with the instagram base URL", () => {
    expect(normalizeSocialUrl("instagram", "myhandle")).toBe(
      "https://instagram.com/myhandle"
    );
  });
});

describe("buildContactIconColor", () => {
  it("returns accent by default", () => {
    expect(buildContactIconColor()).toBe("var(--pf-color-accent)");
  });
});

describe("buildContactIconSize", () => {
  it("returns 20 by default", () => {
    expect(buildContactIconSize()).toBe(20);
  });
});

describe("SocialIconLink", () => {
  it("is exported as a function", async () => {
    const mod = await import("./SocialIconLink");
    expect(typeof mod.SocialIconLink).toBe("function");
  });
});
