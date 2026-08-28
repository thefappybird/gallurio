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
});
