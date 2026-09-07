import { describe, expect, it } from "vitest";
import { normalizePresetLayouts } from "./normalizePresetLayouts";

describe("normalizePresetLayouts", () => {
  it("moves Divider siblings to a full root and gives each remaining run a page-fit group", () => {
    const input = {
      root: {},
      content: [{
        type: "CtaMinimalPreset",
        props: {
          content: [
            { type: "Divider", props: {} },
            { type: "Container", props: { overallWidth: "page-fit", content: [{ type: "Columns", props: { overallWidth: "full", content: [] } }] } },
          ],
        },
      }],
    };
    const result = normalizePresetLayouts(input);
    const preset = result.content[0] as { props: Record<string, unknown> };
    expect(preset.props.overallWidth).toBe("full");
    expect((preset.props.content as Array<{ type: string }>).map((block) => block.type)).toEqual(["Divider", "Container"]);
    const group = (preset.props.content as Array<{ props: Record<string, unknown> }>)[1];
    expect(group.props.overallWidth).toBe("page-fit");
    expect((group.props.content as Array<{ type: string; props: Record<string, unknown> }>)[0]).toMatchObject({
      type: "Columns",
      props: { overallWidth: "full" },
    });
    expect(normalizePresetLayouts(result)).toBe(result);
  });
});
