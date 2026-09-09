import { describe, expect, it } from "vitest";
import { reconcileMasonryClones } from "./masonryCloneReconciler";

type Item = { type: string; props: Record<string, unknown> };

const image = (id: string, height: string): Item => ({
  type: "Image",
  props: { id, alt: id, _style: { bgImagePublicId: `asset/${id}`, height } },
});

const lane = (prefix: string): Item[] => [
  image(`${prefix}-1`, "16rem"),
  image(`${prefix}-2`, "22rem"),
  image(`${prefix}-3`, "18rem"),
];

describe("reconcileMasonryClones", () => {
  it("adds one read-only derived clone to every eligible active lane", () => {
    const data: { content: Item[] } = {
      content: [{
        type: "GalleryMasonry",
        props: {
          id: "masonry",
          masonryLayout: "columns",
          masonryLoop: true,
          _style: { galleryColumns: 3, galleryGap: "normal" },
          column1: lane("a"),
          column2: lane("b"),
          column3: lane("c"),
          column4: [],
        },
      }],
    };

    const normalized = reconcileMasonryClones(data);
    const props = normalized.content![0].props;
    for (let column = 1; column <= 3; column += 1) {
      const items = props[`column${column}`] as Array<{ type: string; props: Record<string, unknown> }>;
      expect(items.map((item) => item.type)).toEqual(["Image", "Image", "Image", "MasonryClone"]);
      expect(items[3].props.id).toBe(`masonry--clone-${column}`);
      expect(items[3].props.sourceId).toBe(`${String.fromCharCode(96 + column)}-1`);
      expect((items[3].props.imageProps as Record<string, unknown>).alt).toBe(`${String.fromCharCode(96 + column)}-1`);
    }
  });

  it("updates the clone when the first image changes and removes all clones below the three-image gate", () => {
    const base: { content: Item[] } = {
      content: [{
        type: "GalleryMasonry",
        props: {
          id: "masonry",
          masonryLayout: "columns",
          masonryLoop: true,
          _style: { galleryColumns: 2 },
          column1: lane("a"),
          column2: lane("b"),
          column3: [],
          column4: [],
        },
      }],
    };
    const withClones = reconcileMasonryClones(base);
    const props = withClones.content![0].props;
    props.column1 = [image("replacement", "30rem"), ...(props.column1 as Item[]).slice(1)];
    const updated = reconcileMasonryClones(withClones);
    const clone = (updated.content![0].props.column1 as Array<{ type: string; props: Record<string, unknown> }>).at(-1)!;
    expect((clone.props.imageProps as Record<string, unknown>).alt).toBe("replacement");

    updated.content![0].props.column2 = (updated.content![0].props.column2 as Item[]).slice(0, 2);
    const ineligible = reconcileMasonryClones(updated);
    expect((ineligible.content![0].props.column1 as Array<{ type: string }>).some((item) => item.type === "MasonryClone")).toBe(false);
    expect((ineligible.content![0].props.column2 as Array<{ type: string }>).some((item) => item.type === "MasonryClone")).toBe(false);
  });

  it("supports Puck zone-backed lanes and is stable after reconciliation", () => {
    const data: { content: Item[]; zones: Record<string, Item[]> } = {
      content: [{
        type: "GalleryMasonry",
        props: { id: "zoned", masonryLayout: "columns", masonryLoop: true, _style: { galleryColumns: 2 } },
      }],
      zones: {
        "zoned:column1": lane("a"),
        "zoned:column2": lane("b"),
      },
    };
    const normalized = reconcileMasonryClones(data);
    expect(normalized.zones!["zoned:column1"].at(-1)?.type).toBe("MasonryClone");
    expect(normalized.zones!["zoned:column2"].at(-1)?.type).toBe("MasonryClone");
    expect(reconcileMasonryClones(normalized)).toBe(normalized);
  });

  it("assigns stable source ids to fresh inline preset images before linking clones", () => {
    const withoutIds = () => Array.from({ length: 3 }, (_, index) => ({
      type: "Image",
      props: { alt: `photo-${index + 1}`, _style: { bgImagePublicId: `asset/photo-${index + 1}` } },
    }));
    const data: { content: Item[] } = {
      content: [{
        type: "GalleryMasonry",
        props: {
          id: "fresh-masonry",
          masonryLayout: "columns",
          masonryLoop: true,
          _style: { galleryColumns: 2 },
          column1: withoutIds(),
          column2: withoutIds(),
        },
      }],
    };

    const normalized = reconcileMasonryClones(data);
    const firstLane = normalized.content[0].props.column1 as Item[];
    expect(firstLane[0].props.id).toBe("fresh-masonry--column-1-item-1");
    expect(firstLane.at(-1)?.props.sourceId).toBe("fresh-masonry--column-1-item-1");
    expect((firstLane.at(-1)?.props.imageProps as Record<string, unknown>)._style)
      .toEqual({ bgImagePublicId: "asset/photo-1" });
    expect(reconcileMasonryClones(normalized)).toBe(normalized);
  });
});
