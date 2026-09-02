import { describe, expect, it } from "vitest";
import { reconcileContainerAnchors } from "./containerAnchorReconciler";

const anchor = (id = "container--anchor") => ({
  type: "ContainerAnchor",
  props: { id, height: 0 },
});

const heading = { type: "Heading", props: { id: "heading", text: "Hello" } };

describe("reconcileContainerAnchors", () => {
  it("removes anchors from populated containers immediately after a drop", () => {
    const data = {
      content: [{
        type: "Container",
        props: { id: "container", content: [anchor(), heading] },
      }],
    };

    expect(reconcileContainerAnchors(data).content?.[0].props.content).toEqual([heading]);
  });

  it("adds an anchor as soon as the final real child is deleted", () => {
    const data = {
      content: [{ type: "Container", props: { id: "container", content: [] } }],
    };

    expect(reconcileContainerAnchors(data).content?.[0].props.content).toEqual([anchor()]);
  });

  it("normalizes restored nested containers and dynamic zones", () => {
    const data = {
      content: [{
        type: "Columns",
        props: {
          id: "columns",
          content: [{ type: "Container", props: { id: "nested", content: [anchor("old"), heading] } }],
        },
      }],
      zones: {
        footer: [{ type: "Container", props: { id: "footer", content: [] } }],
      },
    };

    const normalized = reconcileContainerAnchors(data);
    const columnsContent = normalized.content?.[0].props.content as Array<{ props: { content: unknown } }>;
    expect(columnsContent[0].props.content).toEqual([heading]);
    expect(normalized.zones?.footer[0].props.content).toEqual([anchor("footer--anchor")]);
  });

  it("is referentially stable when all anchors already match their container state", () => {
    const data = {
      content: [
        { type: "Container", props: { id: "empty", content: [anchor("empty--anchor")] } },
        { type: "Container", props: { id: "full", content: [heading] } },
      ],
    };

    expect(reconcileContainerAnchors(data)).toBe(data);
  });

  it("keeps the anchor (appended last) when the only child is a Columns block", () => {
    const columns = { type: "Columns", props: { id: "cols", content: [] } };
    const data = { content: [{ type: "Container", props: { id: "container", content: [columns] } }] };

    expect(reconcileContainerAnchors(data).content?.[0].props.content).toEqual([
      columns,
      anchor(),
    ]);
  });

  it("keeps the anchor (appended last) when the only child is a Container block", () => {
    const inner = { type: "Container", props: { id: "inner", content: [] } };
    const data = { content: [{ type: "Container", props: { id: "container", content: [inner] } }] };

    const result = reconcileContainerAnchors(data).content?.[0].props.content as Array<{ props: { id: string } }>;
    expect(result[0].props.id).toBe("inner");
    expect(result[1]).toEqual(anchor());
  });

  it("keeps the anchor when there are two container-class children", () => {
    const cols = { type: "Columns", props: { id: "cols", content: [] } };
    const inner = { type: "Container", props: { id: "inner", content: [] } };
    const data = { content: [{ type: "Container", props: { id: "container", content: [cols, inner] } }] };

    const result = reconcileContainerAnchors(data).content?.[0].props.content as SlotItemLike[];
    expect(result).toHaveLength(3);
    expect(result[result.length - 1].type).toBe("ContainerAnchor");
  });

  it("drops the anchor when a Columns child sits alongside a non-container child", () => {
    const columns = { type: "Columns", props: { id: "cols", content: [] } };
    const data = {
      content: [{ type: "Container", props: { id: "container", content: [columns, heading] } }],
    };

    expect(reconcileContainerAnchors(data).content?.[0].props.content).toEqual([columns, heading]);
  });

  it("leaves preset sections untouched even when they nest only container-class children", () => {
    const columns = { type: "Columns", props: { id: "cols", content: [] } };
    const data = { content: [{ type: "HeroSection", props: { id: "hero", content: [columns] } }] };

    expect(reconcileContainerAnchors(data)).toBe(data);
  });

  it("reconciles a Container nested inside a Container inside a zone", () => {
    const data = {
      zones: {
        footer: [{
          type: "Container",
          props: {
            id: "outer",
            content: [{ type: "Container", props: { id: "inner", content: [] } }],
          },
        }],
      },
    };

    const normalized = reconcileContainerAnchors(data);
    const outerContent = normalized.zones?.footer[0].props.content as SlotItemLike[];
    expect(outerContent).toHaveLength(2);
    expect(outerContent[1].type).toBe("ContainerAnchor");
    const innerContent = (outerContent[0] as { props: { content: SlotItemLike[] } }).props.content;
    expect(innerContent).toEqual([anchor("inner--anchor")]);
  });

  it("is idempotent for the container-class bridge case: a second pass returns the same reference", () => {
    const columns = { type: "Columns", props: { id: "cols", content: [] } };
    const data = { content: [{ type: "Container", props: { id: "container", content: [columns] } }] };

    const first = reconcileContainerAnchors(data);
    const second = reconcileContainerAnchors(first);
    expect(second).toBe(first);
  });
});

type SlotItemLike = { type: string; props: Record<string, unknown> };
