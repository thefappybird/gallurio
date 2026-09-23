import { describe, expect, it } from "vitest";
import { reconcileContainerAnchors } from "./containerAnchorReconciler";

const anchor = (id = "container--anchor") => ({
  type: "ContainerAnchor",
  props: { id, height: 0 },
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

  it("leaves non-Container preset sections untouched", () => {
    const data = { content: [{ type: "HeroSection", props: { id: "hero", content: [anchor()] } }] };
    expect(reconcileContainerAnchors(data)).toBe(data);
  });
});
