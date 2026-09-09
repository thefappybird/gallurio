import { describe, expect, it } from "vitest";
import { applyPageBodyContainerDefaults } from "./pageBodyContainerDefaults";
import type { PuckData } from "./types";

function data(children: PuckData["content"], defaults?: Record<string, unknown>): PuckData {
  return {
    root: {},
    content: [{
      type: "PageBody",
      props: { id: "page-body", containerDefaults: defaults, content: children },
    }],
  } as PuckData;
}

describe("applyPageBodyContainerDefaults", () => {
  it("only materializes configured defaults onto newly inserted containers inside PageBody", () => {
    const existing = { type: "Container", props: { id: "existing", content: [] } };
    const inserted = {
      type: "Container",
      props: {
        id: "inserted",
        overallWidth: "full",
        _style: { paddingTop: "2px" },
        content: [{ type: "Container", props: { id: "nested", content: [] } }],
      },
    };
    const previous = data([existing]);
    const next = data([existing, inserted], {
      radius: 12,
      paddingTop: "12px",
      paddingRight: "24px",
      paddingBottom: "12px",
      paddingLeft: "24px",
      marginTop: "0px",
      marginRight: "8px",
      marginBottom: "0px",
      marginLeft: "8px",
      gap: 20,
      overallWidth: "page-fit",
    });

    const result = applyPageBodyContainerDefaults(previous, next);
    const [sameExisting, configured] = (result.content[0].props.content as PuckData["content"]);
    const [nested] = configured.props.content as PuckData["content"];

    expect(sameExisting).toBe(existing);
    expect(configured.props.overallWidth).toBe("full");
    expect(configured.props._style).toMatchObject({
      radius: 12,
      gap: 20,
      paddingTop: "2px",
      paddingRight: "24px",
      paddingBottom: "12px",
      paddingLeft: "24px",
      marginTop: "0px",
      marginBottom: "0px",
      marginLeft: "8px",
    });
    expect(nested.props.overallWidth).toBe("page-fit");
    expect(nested.props._style).toMatchObject({ radius: 12, gap: 20, paddingTop: "12px", marginRight: "8px" });
  });

  it("materializes configured defaults onto a newly inserted preset or Columns block too, not just literal Container", () => {
    const previous = data([]);
    const insertedPreset = {
      type: "AboutPreset",
      props: { id: "inserted-preset", content: [] },
    };
    const insertedColumns = {
      type: "Columns",
      props: { id: "inserted-columns", columns: 2, content: [] },
    };
    const next = data([insertedPreset, insertedColumns], {
      paddingLeft: "0px",
      paddingRight: "0px",
    });

    const result = applyPageBodyContainerDefaults(previous, next);
    const [preset, columns] = result.content[0].props.content as PuckData["content"];

    expect(preset.props._style).toMatchObject({ paddingLeft: "0px", paddingRight: "0px" });
    expect(columns.props._style).toMatchObject({ paddingLeft: "0px", paddingRight: "0px" });
  });

  it("never applies PageBody defaults to chrome or existing containers", () => {
    const existing = { type: "Container", props: { id: "existing", content: [] } };
    const chromeContainer = { type: "Container", props: { id: "chrome-container", content: [] } };
    const previous = {
      root: {},
      content: [
        { type: "Navigation", props: { id: "nav", _chrome: "nav", content: [chromeContainer] } },
        ...data([existing], { padding: "16px" }).content,
      ],
    } as PuckData;
    const next = {
      ...previous,
      content: [
        previous.content[0],
        ...data([existing], { padding: "16px" }).content,
      ],
    } as PuckData;

    expect(applyPageBodyContainerDefaults(previous, next)).toBe(next);
  });
});
