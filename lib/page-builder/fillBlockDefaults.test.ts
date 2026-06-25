import { describe, it, expect } from "vitest";
import { fillBlockDefaults } from "./fillBlockDefaults";

describe("fillBlockDefaults", () => {
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
});
