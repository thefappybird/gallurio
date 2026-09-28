import { describe, expect, it } from "vitest";
import { reconcileContainerAnchors } from "./containerAnchorReconciler";
import { CONTAINER_PRESET_KEYS } from "./blocks/sectionPresets";

const presetKey = CONTAINER_PRESET_KEYS[0];

const anchor = (id = "container--anchor") => ({
  type: "ContainerAnchor",
  props: { id },
});

const heading = { type: "Heading", props: { id: "heading", text: "Hello" } };

describe("reconcileContainerAnchors", () => {
  it("removes an anchor from a mixed-content container", () => {
    const data = {
      content: [{
        type: "Container",
        props: { id: "container", content: [anchor(), heading, anchor("old")] },
      }],
    };

    expect(reconcileContainerAnchors(data).content?.[0].props.content).toEqual([heading]);
  });

  it("adds an anchor to an empty container", () => {
    const data = { content: [{ type: "Container", props: { id: "container", content: [] } }] };
    expect(reconcileContainerAnchors(data).content?.[0].props.content).toEqual([anchor()]);
  });

  it("keeps anchors for nested containers and dynamic zones", () => {
    const data = {
      content: [{
        type: "Columns",
        props: {
          id: "columns",
          content: [{ type: "Container", props: { id: "nested", content: [anchor("old"), heading] } }],
        },
      }],
      zones: {
        footer: [{ type: "Container", props: { id: "footer", content: [anchor("footer--anchor")] } }],
      },
    };

    const normalized = reconcileContainerAnchors(data);
    const columnsContent = normalized.content?.[0].props.content as Array<{ props: { content: unknown } }>;
    expect(columnsContent[0].props.content).toEqual([heading]);
    expect(normalized.zones?.footer[0].props.content).toEqual([anchor("footer--anchor")]);
  });

  it("is referentially stable and idempotent once anchors are canonical", () => {
    const data = { content: [{ type: "Container", props: { id: "container", content: [heading] } }] };
    const first = reconcileContainerAnchors(data);
    expect(reconcileContainerAnchors(first)).toBe(first);

    const fromLegacy = reconcileContainerAnchors({
      content: [{ type: "Container", props: { id: "container", content: [anchor(), heading] } }],
    });
    expect(reconcileContainerAnchors(fromLegacy)).toBe(fromLegacy);
  });

  it("leaves a nav-preset section (not an anchor host) untouched", () => {
    const data = { content: [{ type: "HeroSection", props: { id: "hero", content: [anchor()] } }] };
    expect(reconcileContainerAnchors(data)).toBe(data);
  });

  it("keeps exactly one trailing anchor when Container children are Container/Columns/a container preset", () => {
    const data = {
      content: [{
        type: "Container",
        props: {
          id: "root",
          content: [
            { type: "Container", props: { id: "c1", content: [] } },
            { type: "Columns", props: { id: "c2", content: [] } },
            { type: presetKey, props: { id: "c3", content: [] } },
          ],
        },
      }],
    };
    const result = reconcileContainerAnchors(data).content?.[0].props.content as unknown[];
    expect(result.at(-1)).toEqual(anchor("root--anchor"));
    expect(result.filter((item) => (item as { type: string }).type === "ContainerAnchor")).toHaveLength(1);
  });

  it("appends a host anchor to a container-preset node whose only child is a Container", () => {
    const data = {
      content: [{
        type: presetKey,
        props: { id: "section", content: [{ type: "Container", props: { id: "inner", content: [] } }] },
      }],
    };
    const content = reconcileContainerAnchors(data).content?.[0].props.content as unknown[];
    expect(content.at(-1)).toEqual(anchor("section--anchor"));
  });

  it("keeps no anchor on a container-preset node with a Heading child, and strips a stale one", () => {
    const data = {
      content: [{
        type: presetKey,
        props: { id: "section", content: [anchor("section--anchor"), heading] },
      }],
    };
    expect(reconcileContainerAnchors(data).content?.[0].props.content).toEqual([heading]);
  });

  it("Columns with only Container children gets no anchor of its own (Columns is not a host)", () => {
    const data = {
      content: [{
        type: "Columns",
        props: {
          id: "cols",
          content: [{ type: "Container", props: { id: "c1", content: [heading] } }],
        },
      }],
    };
    const columnsContent = reconcileContainerAnchors(data).content?.[0].props.content as unknown[];
    expect(columnsContent.some((item) => (item as { type: string }).type === "ContainerAnchor")).toBe(false);
  });

  it("is idempotent/reference-stable on a preset tree with a canonical anchor", () => {
    const data = {
      content: [{
        type: presetKey,
        props: { id: "section", content: [{ type: "Container", props: { id: "inner", content: [] } }] },
      }],
    };
    const first = reconcileContainerAnchors(data);
    expect(reconcileContainerAnchors(first)).toBe(first);
  });
});
