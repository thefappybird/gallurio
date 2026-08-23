import { describe, it, expect } from "vitest";
import { collectBlocks, mapBlocks } from "./blockTree";
import type { PuckData, PuckBlockEntry } from "./types";

function block(type: string, props: Record<string, unknown> = {}): PuckBlockEntry {
  return { type, props };
}

describe("collectBlocks", () => {
  it("collects root content in order", () => {
    const data: PuckData = { content: [block("A"), block("B")] };
    expect(collectBlocks(data).map((b) => b.type)).toEqual(["A", "B"]);
  });

  it("collects zone arrays", () => {
    const data: PuckData = { content: [], zones: { "z:1": [block("Z")] } };
    expect(collectBlocks(data).map((b) => b.type)).toEqual(["Z"]);
  });

  it("collects blocks nested inside a preset's props.content slot", () => {
    const data: PuckData = {
      content: [block("Preset", { content: [block("Heading"), block("GalleryGrid")] })],
    };
    expect(collectBlocks(data).map((b) => b.type)).toEqual(["Preset", "Heading", "GalleryGrid"]);
  });

  it("never recurses into images/backgroundImages prop arrays", () => {
    const data: PuckData = {
      content: [block("GalleryGrid", { images: [{ type: "not-a-block" }] })],
    };
    expect(collectBlocks(data).map((b) => b.type)).toEqual(["GalleryGrid"]);
  });

  it("terminates on a cyclic tree instead of hanging", () => {
    const cyclic: PuckBlockEntry = { type: "Recursive", props: {} };
    cyclic.props.content = [cyclic, block("Leaf")];
    const data: PuckData = { content: [cyclic] };
    expect(() => collectBlocks(data)).not.toThrow();
    expect(collectBlocks(data).map((b) => b.type)).toEqual(["Recursive", "Leaf"]);
  });

  it("bails out past the depth cap", () => {
    let leaf: PuckBlockEntry = block("Deepest");
    for (let i = 0; i < 15; i++) {
      leaf = block(`Wrapper${i}`, { content: [leaf] });
    }
    const data: PuckData = { content: [leaf] };
    const types = collectBlocks(data).map((b) => b.type);
    expect(types).not.toContain("Deepest");
  });
});

describe("mapBlocks", () => {
  it("applies fn to root content in order, preserving order", () => {
    const data: PuckData = { content: [block("A"), block("B")] };
    const out = mapBlocks(data, (b) => ({ ...b, props: { ...b.props, touched: true } }));
    expect(out.content.map((b) => b.type)).toEqual(["A", "B"]);
    expect(out.content.every((b) => b.props.touched)).toBe(true);
  });

  it("applies fn to zone blocks", () => {
    const data: PuckData = { content: [], zones: { "z:1": [block("Z")] } };
    const out = mapBlocks(data, (b) => ({ ...b, props: { ...b.props, touched: true } }));
    expect(out.zones!["z:1"][0].props.touched).toBe(true);
  });

  it("applies fn to a block nested inside a preset's props.content slot", () => {
    const data: PuckData = {
      content: [block("Preset", { content: [block("Heading"), block("GalleryGrid", { images: [1] })] })],
    };
    const out = mapBlocks(data, (b) => (b.type === "GalleryGrid" ? { ...b, props: { ...b.props, images: [] } } : b));
    const preset = out.content[0];
    const nested = (preset.props.content as PuckBlockEntry[])[1];
    expect(nested.props.images).toEqual([]);
  });

  it("never mutates the input data or its blocks", () => {
    const original: PuckData = { content: [block("A", { images: [{ id: "1" }] })] };
    const snapshot = JSON.parse(JSON.stringify(original));
    mapBlocks(original, (b) => ({ ...b, props: { ...b.props, images: [] } }));
    expect(original).toEqual(snapshot);
  });

  it("preserves prop key order on a transformed block", () => {
    const data: PuckData = { content: [block("A", { first: 1, images: [{ id: "1" }], last: 3 })] };
    const out = mapBlocks(data, (b) => ({ ...b, props: { ...b.props, images: [] } }));
    expect(Object.keys(out.content[0].props)).toEqual(["first", "images", "last"]);
  });

  it("returns the SAME block reference when fn returns the same block and nothing nested changed", () => {
    const untouched = block("Heading", { text: "x" });
    const data: PuckData = { content: [untouched] };
    const out = mapBlocks(data, (b) => b);
    expect(out.content[0]).toBe(untouched);
  });

  it("returns the SAME data reference when nothing anywhere changed", () => {
    const data: PuckData = { content: [block("Heading")] };
    const out = mapBlocks(data, (b) => b);
    expect(out).toBe(data);
  });

  it("terminates on a cyclic tree instead of hanging", () => {
    const cyclic: PuckBlockEntry = { type: "Recursive", props: {} };
    cyclic.props.content = [cyclic, block("Leaf")];
    const data: PuckData = { content: [cyclic] };
    expect(() => mapBlocks(data, (b) => b)).not.toThrow();
  });
});
