import { describe, expect, it } from "vitest";

import { HERO_PRESET, HERO_SPLIT_PRESET, HERO_STATEMENT_PRESET } from "./hero";
import { ABOUT_PRESET, ABOUT_PORTRAIT_PRESET, ABOUT_PROFILE_PRESET } from "./about";
import { SERVICES_PRESET, SERVICES_MENU_PRESET, SERVICES_FEATURE_PRESET } from "./services";
import { CTA_PRESET, CTA_IMAGE_PRESET, CTA_MINIMAL_PRESET } from "./cta";
import { CONTACT_PRESET, CONTACT_SPLIT_PRESET, CONTACT_BAR_PRESET } from "./contact";
import { FOOTER_SIGNATURE_PRESET, FOOTER_DIRECTORY_PRESET, FOOTER_STATEMENT_PRESET } from "./footer";

type Node = { type: string; props: Record<string, unknown> };

const ALL_PRESETS: Record<string, Node> = {
  HERO_PRESET: HERO_PRESET as unknown as Node,
  HERO_SPLIT_PRESET: HERO_SPLIT_PRESET as unknown as Node,
  HERO_STATEMENT_PRESET: HERO_STATEMENT_PRESET as unknown as Node,
  ABOUT_PRESET: ABOUT_PRESET as unknown as Node,
  ABOUT_PORTRAIT_PRESET: ABOUT_PORTRAIT_PRESET as unknown as Node,
  ABOUT_PROFILE_PRESET: ABOUT_PROFILE_PRESET as unknown as Node,
  SERVICES_PRESET: SERVICES_PRESET as unknown as Node,
  SERVICES_MENU_PRESET: SERVICES_MENU_PRESET as unknown as Node,
  SERVICES_FEATURE_PRESET: SERVICES_FEATURE_PRESET as unknown as Node,
  CTA_PRESET: CTA_PRESET as unknown as Node,
  CTA_IMAGE_PRESET: CTA_IMAGE_PRESET as unknown as Node,
  CTA_MINIMAL_PRESET: CTA_MINIMAL_PRESET as unknown as Node,
  CONTACT_PRESET: CONTACT_PRESET as unknown as Node,
  CONTACT_SPLIT_PRESET: CONTACT_SPLIT_PRESET as unknown as Node,
  CONTACT_BAR_PRESET: CONTACT_BAR_PRESET as unknown as Node,
  FOOTER_SIGNATURE_PRESET: FOOTER_SIGNATURE_PRESET as unknown as Node,
  FOOTER_DIRECTORY_PRESET: FOOTER_DIRECTORY_PRESET as unknown as Node,
  FOOTER_STATEMENT_PRESET: FOOTER_STATEMENT_PRESET as unknown as Node,
};

function childrenOf(node: Node): Node[] {
  const content = node.props?.content as unknown;
  return Array.isArray(content) ? (content as Node[]) : [];
}

/** Depth-first walk of every block in a preset's tree, including the root. */
function walk(node: Node, visit: (n: Node) => void) {
  visit(node);
  for (const child of childrenOf(node)) walk(child, visit);
}

function collectColumnsNodes(root: Node): Node[] {
  const found: Node[] = [];
  walk(root, (n) => {
    if (n.type === "Columns") found.push(n);
  });
  return found;
}

function firstHeadingLevel(root: Node): string | undefined {
  let level: string | undefined;
  walk(root, (n) => {
    if (level === undefined && n.type === "Heading") {
      level = n.props?.level as string;
    }
  });
  return level;
}

describe("preset composition — backgroundImages / content", () => {
  for (const [name, preset] of Object.entries(ALL_PRESETS)) {
    it(`${name} has backgroundImages: [] and non-empty content`, () => {
      const bg = (preset as unknown as { backgroundImages: unknown[] }).backgroundImages;
      expect(bg).toEqual([]);
      const content = (preset as unknown as { content: unknown[] }).content;
      expect(Array.isArray(content)).toBe(true);
      expect((content as unknown[]).length).toBeGreaterThan(0);
    });
  }
});

describe("preset composition — Columns minHeight", () => {
  // SERVICES_PRESET is the one verbatim-moved preset that contains a Columns
  // block; the spec pins it "move verbatim, no changes", so its inherited
  // 320px minHeight is intentional, not a rule-3 violation.
  const EXEMPT = new Set(["SERVICES_PRESET"]);

  for (const [name, preset] of Object.entries(ALL_PRESETS)) {
    if (EXEMPT.has(name)) continue;
    // The top-level preset object isn't itself a `{type,props}` node — wrap it
    // so `walk` can traverse its `content` slot uniformly.
    const root: Node = { type: "Container", props: preset as unknown as Record<string, unknown> };

    it(`${name}: every Columns block sets an explicit minHeight`, () => {
      for (const columns of collectColumnsNodes(root)) {
        expect(columns.props.minHeight, `Columns in ${name} is missing minHeight`).toBeTruthy();
      }
    });
  }
});

describe("preset composition — colSpan never exceeds parent columns", () => {
  for (const [name, preset] of Object.entries(ALL_PRESETS)) {
    const root: Node = { type: "Container", props: preset as unknown as Record<string, unknown> };

    it(`${name}: no child colSpan exceeds its Columns' track count`, () => {
      for (const columns of collectColumnsNodes(root)) {
        const trackCount = columns.props.columns as number;
        for (const cell of childrenOf(columns)) {
          const style = cell.props?._style as { colSpan?: number } | undefined;
          if (style?.colSpan !== undefined) {
            expect(style.colSpan, `${name}: cell colSpan exceeds ${trackCount} tracks`).toBeLessThanOrEqual(trackCount);
          }
        }
      }
    });
  }
});

describe("hero group — reading order and heading levels", () => {
  it("HERO_SPLIT_PRESET lists the copy Container before the Image", () => {
    const root: Node = { type: "Container", props: HERO_SPLIT_PRESET as unknown as Record<string, unknown> };
    const columns = childrenOf(root).find((n) => n.type === "Columns")!;
    const cells = childrenOf(columns);
    expect(cells[0].type).toBe("Container");
    expect(cells[1].type).toBe("Image");
  });

  it("HERO_PRESET and HERO_STATEMENT_PRESET use an h1 lead heading", () => {
    const heroRoot: Node = { type: "Container", props: HERO_PRESET as unknown as Record<string, unknown> };
    const statementRoot: Node = { type: "Container", props: HERO_STATEMENT_PRESET as unknown as Record<string, unknown> };
    expect(firstHeadingLevel(heroRoot)).toBe("h1");
    expect(firstHeadingLevel(statementRoot)).toBe("h1");
  });

  it("non-hero verbatim presets keep an h2 lead heading", () => {
    for (const preset of [ABOUT_PRESET, SERVICES_PRESET, CTA_PRESET, CONTACT_PRESET]) {
      const root: Node = { type: "Container", props: preset as unknown as Record<string, unknown> };
      expect(firstHeadingLevel(root)).toBe("h2");
    }
  });
});

describe("CONTACT_BAR_PRESET — horizontal row, no Columns (item 4)", () => {
  it("drops the Columns layer and lays its 3 children out as a row", () => {
    const root: Node = { type: "Container", props: CONTACT_BAR_PRESET as unknown as Record<string, unknown> };
    expect(collectColumnsNodes(root)).toHaveLength(0);

    const style = (CONTACT_BAR_PRESET as unknown as { _style: Record<string, unknown> })._style;
    expect(style.flexDirection).toBe("row");
    expect(style.justifyContent).toBe("between");

    const children = childrenOf(root);
    expect(children.map((c) => c.type)).toEqual(["Container", "ContactDetails", "Button"]);
  });

  it("opts the row into wrapping so it stacks instead of compressing at 375px", () => {
    const style = (CONTACT_BAR_PRESET as unknown as { _style: Record<string, unknown> })._style;
    expect(style.flexWrap).toBe("wrap");
  });
});

describe("FOOTER_DIRECTORY_PRESET — page-fit credits wrapper (item 9)", () => {
  it("wraps only the trailing credits Text in a page-fit, start-aligned Container", () => {
    const root: Node = { type: "Container", props: FOOTER_DIRECTORY_PRESET as unknown as Record<string, unknown> };
    const top = childrenOf(root);
    const credits = top[top.length - 1];
    expect(credits.type).toBe("Container");
    expect(credits.props.overallWidth).toBe("page-fit");
    const style = credits.props._style as Record<string, unknown>;
    expect(style.contentHorizontalAlign).toBe("start");
    const inner = childrenOf(credits);
    expect(inner).toHaveLength(1);
    expect(inner[0].type).toBe("Text");
    expect(inner[0].props.text).toBe("© 2026 Lumen Studio");

    // The two Dividers stay full-bleed (untouched).
    const dividers = top.filter((n) => n.type === "Divider");
    expect(dividers).toHaveLength(2);
  });
});

describe("footer statement — contrast-safe button", () => {
  it("pins buttonStyle: outline and buttonColorToken: foreground", () => {
    const root: Node = { type: "Container", props: FOOTER_STATEMENT_PRESET as unknown as Record<string, unknown> };
    let button: Node | undefined;
    walk(root, (n) => {
      if (button === undefined && n.type === "Button" && n.props.label === "Get in Touch") button = n;
    });
    expect(button).toBeDefined();
    const style = button!.props._style as { buttonStyle?: string; buttonColorToken?: string };
    expect(style.buttonStyle).toBe("outline");
    expect(style.buttonColorToken).toBe("foreground");
  });
});

describe("overlayColorToken pinned to primary", () => {
  it("HERO_PRESET pins overlayColorToken: primary", () => {
    expect((HERO_PRESET as unknown as { overlayColorToken?: string }).overlayColorToken).toBe("primary");
  });

  // CTA_IMAGE_PRESET dropped its background image and scrim entirely — it is now
  // a two-column split (copy + Image) with no overlay, so it carries no scrim token.
  it("CTA_IMAGE_PRESET has no overlayOpacity/overlayColorToken (two-column split, no scrim)", () => {
    const props = CTA_IMAGE_PRESET as unknown as { overlayOpacity?: number; overlayColorToken?: string };
    expect(props.overlayOpacity).toBeUndefined();
    expect(props.overlayColorToken).toBeUndefined();
  });
});
