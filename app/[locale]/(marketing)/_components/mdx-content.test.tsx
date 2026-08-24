import { Suspense } from "react";
import { describe, expect, it } from "vitest";
import { buildMdxComponents } from "./mdx-content";
import { GallurioPrice } from "./GallurioPrice";

describe("buildMdxComponents", () => {
  it("wraps GallurioPrice in its own Suspense boundary, not the whole article", () => {
    const components = buildMdxComponents();
    const el = components.GallurioPrice({ period: "monthly" });

    expect(el.type).toBe(Suspense);
    expect(el.props.children.type).toBe(GallurioPrice);
    expect(el.props.children.props).toEqual({ period: "monthly" });
  });

  it("wraps table output in an overflow-x-auto container so wide tables scroll instead of the page", () => {
    const components = buildMdxComponents();
    const el = components.table({ children: "row" });

    expect(el.type).toBe("div");
    expect(el.props.className).toContain("overflow-x-auto");
    expect(el.props.children.type).toBe("table");
    expect(el.props.children.props.children).toBe("row");
  });
});
