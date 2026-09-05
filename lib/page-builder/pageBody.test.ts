import { describe, expect, it } from "vitest";
import type { ComponentData, Data } from "@measured/puck";
import {
  PAGE_BODY_ID,
  PAGE_BODY_TYPE,
  getPageBodyContent,
  normalizePageBody,
} from "./pageBody";

function block(type: string, id: string, props: Record<string, unknown> = {}): ComponentData {
  return { type, props: { id, ...props } } as ComponentData;
}

function zone(content: ComponentData[]): Data {
  return { root: {}, content } as Data;
}

describe("normalizePageBody", () => {
  it("wraps loose content between pinned navigation and footer", () => {
    const nav = block("Navigation", "nav", { _chrome: "nav" });
    const hero = block("HeroPreset", "hero");
    const text = block("Text", "text");
    const footer = block("FooterDirectoryPreset", "footer", { _chrome: "footer" });

    const result = normalizePageBody(zone([nav, hero, text, footer]));

    expect(result.content?.map((entry) => entry.type)).toEqual([
      "Navigation",
      PAGE_BODY_TYPE,
      "FooterDirectoryPreset",
    ]);
    expect(result.content?.[1].props.id).toBe(PAGE_BODY_ID);
    expect(getPageBodyContent(result).map((entry) => entry.type)).toEqual(["HeroPreset", "Text"]);
  });

  it("creates an empty body for a chrome-only page", () => {
    const nav = block("Navigation", "nav", { _chrome: "nav" });
    const footer = block("FooterStatementPreset", "footer", { _chrome: "footer" });

    const result = normalizePageBody(zone([nav, footer]));

    expect(result.content?.map((entry) => entry.type)).toEqual([
      "Navigation",
      PAGE_BODY_TYPE,
      "FooterStatementPreset",
    ]);
    expect(getPageBodyContent(result)).toEqual([]);
  });

  it("preserves the existing body id and margin while absorbing newly-loose blocks", () => {
    const nav = block("Navigation", "nav", { _chrome: "nav" });
    const existing = block(PAGE_BODY_TYPE, "custom-body", {
      marginX: "3rem",
      content: [block("Heading", "heading")],
    });
    const loose = block("Image", "image");

    const result = normalizePageBody(zone([nav, existing, loose]));
    const body = result.content?.[1];

    expect(body?.props.id).toBe("custom-body");
    expect(body?.props.marginX).toBe("3rem");
    expect(getPageBodyContent(result).map((entry) => entry.type)).toEqual(["Heading", "Image"]);
  });

  it("merges duplicate bodies without losing either body’s children", () => {
    const first = block(PAGE_BODY_TYPE, "body-a", {
      content: [block("Heading", "heading")],
    });
    const second = block(PAGE_BODY_TYPE, "body-b", {
      content: [block("Text", "text")],
    });

    const result = normalizePageBody(zone([first, second]));

    expect(result.content).toHaveLength(1);
    expect(result.content?.[0].props.id).toBe("body-a");
    expect(getPageBodyContent(result).map((entry) => entry.type)).toEqual(["Heading", "Text"]);
  });

  it("returns the same reference when the body is already canonical", () => {
    const canonical = zone([
      block("Navigation", "nav", { _chrome: "nav" }),
      block(PAGE_BODY_TYPE, "body", { marginX: "1.5rem", content: [block("Text", "text")] }),
      block("FooterStatementPreset", "footer", { _chrome: "footer" }),
    ]);

    expect(normalizePageBody(canonical)).toBe(canonical);
  });
});
