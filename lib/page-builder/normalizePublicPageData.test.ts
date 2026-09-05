import { describe, it, expect, vi } from "vitest";
import { normalizePublicPageData, hasRenderableBlocks } from "./normalizePublicPageData";

const known = new Set(["Heading", "Text"]);

function bodyContent(data: ReturnType<typeof normalizePublicPageData>) {
  return (data!.content[0].props.content ?? []) as Array<{
    type: string;
    props: Record<string, unknown>;
  }>;
}

describe("normalizePublicPageData", () => {
  it("returns null for null / undefined / non-object input", () => {
    expect(normalizePublicPageData(null, known)).toBeNull();
    expect(normalizePublicPageData(undefined, known)).toBeNull();
    expect(normalizePublicPageData("nope", known)).toBeNull();
    expect(normalizePublicPageData(42, known)).toBeNull();
  });

  it("defaults a missing root to an object so RSC Render never does `'props' in undefined`", () => {
    // This is the exact 500 repro: data is truthy but has no `root`.
    const out = normalizePublicPageData(
      { content: [{ type: "Heading", props: { text: "Hi" } }] },
      known
    );
    expect(out).not.toBeNull();
    expect(out!.root).toBeTypeOf("object");
    expect(out!.root).not.toBeNull();
    // The invariant the RSC renderer relies on: `'props' in data.root` must not throw.
    expect(() => "props" in (out!.root as object)).not.toThrow();
  });

  it("treats an undefined/null root as a missing root", () => {
    const out = normalizePublicPageData(
      { root: undefined, content: [{ type: "Text", props: {} }] },
      known
    );
    expect(out!.root).toEqual({});
  });

  it("drops null / undefined / non-object content entries", () => {
    const out = normalizePublicPageData(
      { root: {}, content: [null, { type: "Heading", props: {} }, undefined, 5] },
      known
    );
    expect(bodyContent(out)).toHaveLength(1);
    expect(bodyContent(out)[0].type).toBe("Heading");
  });

  it("drops blocks whose type is not registered in the config", () => {
    const out = normalizePublicPageData(
      { root: {}, content: [{ type: "Ghost", props: {} }, { type: "Text", props: {} }] },
      known
    );
    expect(bodyContent(out).map((b) => b.type)).toEqual(["Text"]);
  });

  it("defaults a missing block `props` to an object", () => {
    const out = normalizePublicPageData({ root: {}, content: [{ type: "Heading" }] }, known);
    expect(bodyContent(out)[0].props).toEqual({});
  });

  it("returns null when nothing is renderable (so the caller shows its fallback)", () => {
    expect(normalizePublicPageData({ root: {}, content: [] }, known)).toBeNull();
    expect(normalizePublicPageData({ content: [{ type: "Ghost", props: {} }] }, known)).toBeNull();
    expect(normalizePublicPageData({}, known)).toBeNull();
  });

  it("passes valid data through with root and content intact", () => {
    const data = {
      root: { props: { title: "T" } },
      content: [{ type: "Heading", props: { text: "H" } }],
    };
    const out = normalizePublicPageData(data, known);
    expect(out!.root).toEqual({ props: { title: "T" } });
    expect(bodyContent(out)).toEqual([{ type: "Heading", props: { text: "H" } }]);
  });

  it("keeps a page whose blocks live only in zones even if top-level content is empty", () => {
    const out = normalizePublicPageData(
      { root: {}, content: [], zones: { "x:zone": [{ type: "Heading", props: {} }] } },
      known
    );
    expect(out).not.toBeNull();
    expect(out!.zones).toBeDefined();
  });

  it("warns when it has to repair malformed data (observability for the upstream cause)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    normalizePublicPageData(
      { content: [{ type: "Heading", props: {} }, { type: "Ghost", props: {} }] },
      known,
      "home"
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("passes a legacy-shape Image block's props through untouched (imagePublicId/imageUrl survive, no bgImagePublicId required)", () => {
    // Image blocks saved before the background-image redesign (ee5084d) carry
    // imagePublicId/imageUrl at the top level with no _style.bgImagePublicId.
    // normalizePublicPageData must not drop/rewrite these — ImageBlock's own
    // render-time fallback is what resolves them into the visible picture.
    const imageKnown = new Set(["Image"]);
    const out = normalizePublicPageData(
      {
        root: {},
        content: [{ type: "Image", props: { imagePublicId: "ws/legacy.jpg", imageUrl: "", alt: "Legacy photo", fit: "cover" } }],
      },
      imageKnown
    );
    expect(bodyContent(out)[0].props).toEqual({
      imagePublicId: "ws/legacy.jpg",
      imageUrl: "",
      alt: "Legacy photo",
      fit: "cover",
    });
  });

  it("hasRenderableBlocks: true when content is non-empty or a zone has entries, false otherwise", () => {
    expect(hasRenderableBlocks({ root: {}, content: [{ type: "Heading", props: {} }] })).toBe(true);
    expect(
      hasRenderableBlocks({ root: {}, content: [], zones: { "x:zone": [{ type: "Heading", props: {} }] } })
    ).toBe(true);
    expect(hasRenderableBlocks({ root: {}, content: [] })).toBe(false);
    expect(hasRenderableBlocks(null)).toBe(false);
    expect(hasRenderableBlocks(undefined)).toBe(false);
    expect(hasRenderableBlocks("nope")).toBe(false);
  });

  it("stays silent for healthy data", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    normalizePublicPageData(
      { root: { props: {} }, content: [{ type: "Heading", props: {} }] },
      known,
      "home"
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
