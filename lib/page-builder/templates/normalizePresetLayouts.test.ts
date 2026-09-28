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

  it("leaves an already-full-width Container next to a Divider unwrapped", () => {
    const input = {
      root: {},
      content: [{
        type: "GalleryLandingMastheadPreset",
        props: {
          overallWidth: "full",
          content: [
            {
              type: "Container",
              props: {
                id: "masthead-copy",
                overallWidth: "full",
                _style: { bgColorToken: "accent" },
                content: [{ type: "Heading", props: {} }, { type: "Text", props: {} }],
              },
            },
            { type: "Divider", props: {} },
          ],
        },
      }],
    };
    const result = normalizePresetLayouts(input);
    const preset = result.content[0] as { props: Record<string, unknown> };
    const children = preset.props.content as Array<{ type: string; props: Record<string, unknown> }>;
    expect(children.map((c) => c.type)).toEqual(["Container", "Divider"]);
    expect(children[0].props.id).toBe("masthead-copy");
    expect(children[0].props.overallWidth).toBe("full");
    expect((children[0].props._style as Record<string, unknown>).bgColorToken).toBe("accent");
    expect(normalizePresetLayouts(result)).toBe(result);
  });

  it("nests Lead collections' heading/text inside a full-width accent band over a page-fit shell", () => {
    const input = {
      root: {},
      content: [{
        type: "FeaturedWorkLeadPreset",
        props: {
          content: [
            { type: "Heading", props: { text: "Featured work" } },
            { type: "Text", props: { text: "Two projects..." } },
            {
              type: "Container",
              props: {
                overallWidth: "page-fit",
                content: [{ type: "Columns", props: { overallWidth: "full", content: [] } }],
              },
            },
          ],
        },
      }],
    };
    const result = normalizePresetLayouts(input);
    const preset = result.content[0] as { props: Record<string, unknown> };
    const [band, columnsShell] = preset.props.content as Array<{ type: string; props: Record<string, unknown> }>;

    expect(band.type).toBe("Container");
    expect(band.props.overallWidth).toBe("full");
    expect((band.props._style as Record<string, unknown>).bgColorToken).toBe("accent");
    const bandContent = band.props.content as Array<{ type: string; props: Record<string, unknown> }>;
    expect(bandContent).toHaveLength(1);
    const inner = bandContent[0];
    expect(inner.type).toBe("Container");
    expect(inner.props.overallWidth).toBe("page-fit");
    expect((inner.props._style as Record<string, unknown>).bgColorToken).toBeUndefined();
    expect((inner.props.content as Array<{ type: string }>).map((c) => c.type)).toEqual(["Heading", "Text"]);

    expect(columnsShell.type).toBe("Container");
    expect(columnsShell.props.overallWidth).toBe("page-fit");

    expect(normalizePresetLayouts(result)).toBe(result);
  });

  // `findNested` walks depth-first pre-order, so searching the whole footer
  // subtree for a "Text" reached the tagline INSIDE the directory Columns
  // before the footer's own credits line that follows the second Divider.
  // That re-emitted one block in two slots at once — two DOM nodes sharing a
  // single Puck component id, only one of which dnd-kit registers — and
  // dropped the real credits line entirely.
  it("uses the footer's own credits line, not a tagline nested inside the directory Columns", () => {
    const input = {
      root: {},
      content: [{
        type: "FooterDirectoryPreset",
        props: {
          content: [
            { type: "Divider", props: { id: "divider-top" } },
            {
              type: "Columns",
              props: {
                id: "directory-columns",
                content: [{
                  type: "Container",
                  props: {
                    id: "studio-column",
                    content: [
                      { type: "Heading", props: { id: "studio-name", text: "Lumen Studio" } },
                      { type: "Text", props: { id: "studio-tagline", text: "Fine art photography." } },
                    ],
                  },
                }],
              },
            },
            { type: "Divider", props: { id: "divider-bottom" } },
            { type: "Text", props: { id: "credits", text: "(c) 2026 Lumen Studio" } },
          ],
        },
      }],
    };
    const result = normalizePresetLayouts(input);
    const preset = result.content[0] as { props: Record<string, unknown> };
    const creditsShell = (preset.props.content as Array<{ props: Record<string, unknown> }>)[3];
    const credits = (creditsShell.props.content as Array<{ props: { id?: string } }>)[0];
    expect(credits.props.id).toBe("credits");
  });
});
