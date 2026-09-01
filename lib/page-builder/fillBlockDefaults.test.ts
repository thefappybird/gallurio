import { describe, it, expect } from "vitest";
import { fillBlockDefaults, type BlockEntry } from "./fillBlockDefaults";
import { SECTION_PRESET_KEYS } from "./blocks/sectionPresets";

describe("fillBlockDefaults", () => {
  it.each(SECTION_PRESET_KEYS)(
    "normalizes every registry preset (%s) with container defaults (bgAnimation, bgSpeed)",
    (presetKey) => {
      const data = {
        content: [{ type: presetKey, props: { id: "p1", content: [] } }],
      };
      const result = fillBlockDefaults(data);
      expect(result.content[0].props.bgAnimation).toBe("crossfade");
      expect(result.content[0].props.bgSpeed).toBe("medium");
    },
  );

  it("fills missing gap in Columns _style from defaultProps", () => {
    const data = {
      content: [{ type: "Columns", props: { id: "c1", columns: 2, _style: {} } }],
    };
    const result = fillBlockDefaults(data);
    expect(
      (result.content[0].props._style as Record<string, unknown>).gap,
    ).toBe(16);
  });

  it("does NOT overwrite an existing gap value in Columns _style", () => {
    const data = {
      content: [{ type: "Columns", props: { id: "c1", columns: 2, _style: { gap: 32 } } }],
    };
    const result = fillBlockDefaults(data);
    expect(
      (result.content[0].props._style as Record<string, unknown>).gap,
    ).toBe(32);
  });

  it("fills bgAnimation and bgSpeed for Container", () => {
    const data = {
      content: [{ type: "Container", props: { id: "c1", content: [] } }],
    };
    const result = fillBlockDefaults(data);
    expect(result.content[0].props.bgAnimation).toBe("crossfade");
    expect(result.content[0].props.bgSpeed).toBe("medium");
  });

  it("does NOT overwrite existing bgAnimation in Container", () => {
    const data = {
      content: [{ type: "Container", props: { id: "c1", bgAnimation: "slide", content: [] } }],
    };
    const result = fillBlockDefaults(data);
    expect(result.content[0].props.bgAnimation).toBe("slide");
  });

  it("fills defaults in zone blocks (Columns children)", () => {
    const data = {
      content: [{ type: "Columns", props: { id: "col1", columns: 2, _style: {} } }],
      zones: {
        "col1:content": [{ type: "Heading", props: { id: "h1" } }],
      },
    };
    const result = fillBlockDefaults(data);
    expect(result.zones?.["col1:content"][0].props.text).toBe("Heading");
    expect(result.zones?.["col1:content"][0].props.level).toBe("h2");
  });

  it("does not mutate the input data", () => {
    const data = {
      content: [{ type: "Container", props: { id: "c1", content: [] } }],
    };
    const original = JSON.stringify(data);
    fillBlockDefaults(data);
    expect(JSON.stringify(data)).toBe(original);
  });

  it("unknown block types are passed through unchanged", () => {
    const data = {
      content: [{ type: "UnknownBlock", props: { id: "u1", foo: "bar" } }],
    };
    const result = fillBlockDefaults(data);
    expect(result.content[0].props.foo).toBe("bar");
  });

  it("migrates a legacy Image block's imagePublicId into _style.bgImagePublicId", () => {
    const data = {
      content: [
        { type: "Image", props: { id: "img1", imagePublicId: "ws/legacy.jpg", imageUrl: "", alt: "A photo", fit: "cover" } },
      ],
    };
    const result = fillBlockDefaults(data);
    const props = result.content[0].props as Record<string, unknown>;
    expect((props._style as Record<string, unknown>).bgImagePublicId).toBe("ws/legacy.jpg");
    expect(props.imagePublicId).toBeUndefined();
    expect(props.fit).toBeUndefined();
    expect(props.alt).toBe("A photo");
  });

  it("migrates a saved Masonry flow zone into ordered column lanes", () => {
    const images = Array.from({ length: 7 }, (_, index) => ({
      type: "Image",
      props: { id: `img-${index + 1}`, alt: `Image ${index + 1}` },
    }));
    const data = {
      content: [{
        type: "GalleryMasonry",
        props: { id: "masonry-1", masonryLayout: "flow", _style: { galleryColumns: 3 } },
      }],
      zones: { "masonry-1:content": images },
    };

    const result = fillBlockDefaults(data);

    expect(result.content[0].props.masonryLayout).toBe("columns");
    expect(result.zones?.["masonry-1:content"]).toBeUndefined();
    expect(result.zones?.["masonry-1:column1"].map((item) => item.props.id)).toEqual(["img-1", "img-4", "img-7"]);
    expect(result.zones?.["masonry-1:column2"].map((item) => item.props.id)).toEqual(["img-2", "img-5"]);
    expect(result.zones?.["masonry-1:column3"].map((item) => item.props.id)).toEqual(["img-3", "img-6"]);
    expect(data.zones["masonry-1:content"]).toHaveLength(7);
  });

  it("migrates nested inline Masonry preset children before Puck expands their slots", () => {
    const data = {
      content: [{
        type: "Container",
        props: {
          id: "section-1",
          content: [{
            type: "GalleryMasonry",
            props: {
              id: "masonry-2",
              content: Array.from({ length: 4 }, (_, index) => ({
                type: "Image",
                props: { id: `inline-${index + 1}` },
              })),
              _style: { galleryColumns: 2 },
            },
          }],
        },
      }],
    };

    const result = fillBlockDefaults(data);
    const masonry = (result.content[0].props.content as BlockEntry[])[0];

    expect(masonry.props.masonryLayout).toBe("columns");
    expect((masonry.props.column1 as BlockEntry[]).map((item) => item.props.id)).toEqual(["inline-1", "inline-3"]);
    expect((masonry.props.column2 as BlockEntry[]).map((item) => item.props.id)).toEqual(["inline-2", "inline-4"]);
    expect(masonry.props.content).toEqual([]);
  });
});
