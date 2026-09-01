import { describe, expect, it } from "vitest";
import {
  createNavigationData,
  normalizeSharedChromeData,
  readNavigationConfig,
  stripPageLocalFooters,
} from "./sharedChrome";
import type { PuckData } from "./types";

const EMPTY = { content: [], root: {} };

describe("shared portfolio chrome", () => {
  it("migrates the legacy header into one locked Navigation block", () => {
    const navigation = createNavigationData({ brandText: "Luna", navbarSize: "sleek" });

    expect(navigation.content).toEqual([
      expect.objectContaining({
        type: "Navigation",
        props: expect.objectContaining({
          config: { brandText: "Luna", navbarSize: "sleek" },
        }),
      }),
    ]);
    expect(readNavigationConfig(navigation, {})).toEqual({
      brandText: "Luna",
      navbarSize: "sleek",
    });
  });

  it("moves Home's first footer preset into shared footer and strips page-local copies", () => {
    const localFooter = {
      type: "FooterSignaturePreset",
      props: { id: "footer-home", content: [] },
    };
    const normalized = normalizeSharedChromeData(
      {
        home: { ...EMPTY, content: [{ type: "Heading", props: { id: "h" } }, localFooter] },
        gallery: { ...EMPTY, content: [localFooter] },
      },
      { brandText: "Legacy" },
    );

    expect(normalized.footer.content).toEqual([localFooter]);
    expect(normalized.home.content.map((block) => block.type)).toEqual(["Heading"]);
    expect(normalized.gallery.content).toEqual([]);
    expect(readNavigationConfig(normalized.navigation, {})).toEqual({ brandText: "Legacy" });
  });

  it("strips nested page-local footer presets without touching ordinary blocks", () => {
    const page = {
      ...EMPTY,
      content: [
        {
          type: "Container",
          props: {
            id: "outer",
            content: [
              { type: "Text", props: { id: "copy" } },
              { type: "FooterDirectoryPreset", props: { id: "nested-footer", content: [] } },
            ],
          },
        },
      ],
    };

    expect(stripPageLocalFooters(page).content[0].props.content).toEqual([
      { type: "Text", props: { id: "copy" } },
    ]);
  });

  it("preserves already-shared navigation and footer documents", () => {
    const navigation = createNavigationData({ brandText: "Shared" });
    const footer = {
      ...EMPTY,
      content: [{ type: "FooterStatementPreset", props: { id: "shared-footer", content: [] } }],
    };
    const normalized = normalizeSharedChromeData(
      { home: EMPTY, gallery: EMPTY, navigation, footer },
      { brandText: "Legacy" },
    );

    expect(normalized.navigation).toEqual(navigation);
    expect(normalized.footer).toEqual(footer);
  });

  it("ignores malformed legacy entries while normalizing chrome", () => {
    const malformed = {
      content: [null, { type: "Heading", props: null }],
      root: {},
    } as unknown as PuckData;

    expect(() => normalizeSharedChromeData({ home: malformed, gallery: EMPTY }, {})).not.toThrow();
    expect(stripPageLocalFooters(malformed).content).toEqual([
      { type: "Heading", props: {} },
    ]);
  });
});
