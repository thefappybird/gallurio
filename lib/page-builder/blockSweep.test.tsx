/**
 * Exhaustive block sweep — the Puck 0.23 upgrade gate.
 *
 * The existing suites check the registry's SHAPE (blockShapes), the
 * editor/production config PARITY (editorConfig.test), the templates'
 * STRUCTURE (templates.test) and a hand-picked set of floated-default
 * controls (floatedDefaultParity). None of them actually renders every
 * registered component through Puck's renderer, so a renderer regression in
 * a block nobody wrote a bespoke test for would ship silently.
 *
 * This file closes that gap by driving the registry itself: every case below
 * is generated from `puckConfig.components`, `SECTION_PRESET_KEYS`,
 * `MANUAL_BLOCK_KEYS` and `PORTFOLIO_TEMPLATES`, so a new block is covered the
 * day it is registered rather than the day someone remembers to add a test.
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Render, type Config, type Data } from "@puckeditor/core";
import React from "react";

// GalleryGrid/GalleryMasonry/FeaturedWork/CollectionCard/MasonryClone wrap
// lazy-loaded client islands (item 2b, docs/portfolio/puck-023-followups.md)
// behind the real (unmocked) next/dynamic. Every assertion below reads either
// the block's OWN outer element (data-block, _style, inline style — painted
// synchronously by the isomorphic block itself, not the island) or only
// checks "doesn't throw", so the island's dynamic()-loading state (which
// paints nothing until its import() resolves) never affects these — no mock
// needed. lazy.test.tsx/lazySplit.test.tsx/lazySsr.test.tsx cover the split
// and its content directly.
import { puckConfig } from "./config";
import { SECTION_PRESET_KEYS } from "./blocks/sectionPresets";
import { MANUAL_BLOCK_KEYS } from "./blockCategories";
import { PORTFOLIO_TEMPLATES } from "./templates";
import { STYLE_FIELD_KEY } from "./styleToolkit";

vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: vi.fn(
    (publicId: string) => `https://res.cloudinary.com/test/image/upload/${publicId}`
  ),
}));

const renderConfig = puckConfig as unknown as Config;

type AnyProps = Record<string, unknown>;

const COMPONENT_TYPES = Object.keys(puckConfig.components);

function componentConfig(type: string) {
  return (puckConfig.components as Record<string, { fields?: AnyProps; defaultProps?: AnyProps }>)[
    type
  ];
}

/** Render one block in isolation through the real production renderer. */
function renderBlock(type: string, propOverrides: AnyProps = {}) {
  const defaults = componentConfig(type).defaultProps ?? {};
  const data = {
    root: {},
    content: [{ type, props: { ...defaults, id: `${type}-sweep`, ...propOverrides } }],
  } as unknown as Data;
  const { container, unmount } = render(<Render config={renderConfig} data={data} />);
  const html = container.innerHTML;
  unmount();
  return html;
}

// ---------------------------------------------------------------------------
// 1. Every registered component renders through Puck 0.23
// ---------------------------------------------------------------------------

describe("block sweep — every registered component renders", () => {
  it("covers every section preset and manual block key", () => {
    // Guards the sweep itself: if a preset or manual block stops being
    // registered, the generated cases below would silently shrink.
    const missing = [...SECTION_PRESET_KEYS, ...MANUAL_BLOCK_KEYS].filter(
      (key) => !COMPONENT_TYPES.includes(key)
    );
    expect(missing).toEqual([]);
  });

  it.each(COMPONENT_TYPES)("%s renders from its own defaultProps without throwing", (type) => {
    expect(() => renderBlock(type)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Editor canvas and published page agree
// ---------------------------------------------------------------------------

// MasonryClone is the internal, never-insertable mirror of a masonry lane. Its
// editing branch calls `usePuck`, which throws outside a real <Puck> tree, so
// it can only be exercised in the editor's own e2e pass, not standalone here.
const PARITY_TYPES = COMPONENT_TYPES.filter((type) => type !== "MasonryClone");

describe("block sweep — canvas/publish parity", () => {
  // `puck.isEditing` drives editor-only affordances (anchors, drop hints).
  // Those may add markup, but they must not change the block's own identity:
  // whatever data-block element the published page paints must still be there.
  it.each(PARITY_TYPES)("%s keeps its data-block identity in both modes", (type) => {
    const published = renderBlock(type);
    const blockAttrs = [...published.matchAll(/data-block="([^"]+)"/g)].map((m) => m[1]).sort();
    const editing = renderBlock(type, { puck: { isEditing: true } });
    const editingAttrs = [...editing.matchAll(/data-block="([^"]+)"/g)].map((m) => m[1]).sort();
    expect(editingAttrs).toEqual(expect.arrayContaining(blockAttrs));
  });
});

// ---------------------------------------------------------------------------
// 3. The right-panel style controls actually reach the rendered output
// ---------------------------------------------------------------------------

const STYLE_BEARING = COMPONENT_TYPES.filter((type) =>
  Object.hasOwn(componentConfig(type).fields ?? {}, STYLE_FIELD_KEY)
);

describe("block sweep — style controls affect the render", () => {
  it("finds style-bearing blocks to exercise", () => {
    expect(STYLE_BEARING.length).toBeGreaterThan(0);
  });

  // Real BlockStyle keys, one per Design-tab section. Blocks legitimately
  // consume different subsets — Navigation has its own nav-style system, a
  // Button sizes from its variant — so requiring any ONE of these to land
  // proves the `_style` pipe reaches the renderer without asserting that
  // every block honours every control.
  const PROBES: Array<[string, AnyProps]> = [
    ["padding", { paddingTop: "37px", paddingBottom: "37px" }],
    ["background", { bgColorToken: "primary" }],
    ["border", { borderWidth: 7, borderColorToken: "foreground" }],
    ["radius", { radius: 13 }],
    ["margin", { marginTop: "29px" }],
    ["width", { width: "321px" }],
  ];

  /**
   * Navigation and its preset variants carry `_style` only so the key
   * round-trips: `NavigationBlock` destructures it as `_styleIgnored` and
   * styles itself from `PortfolioHeaderConfig` instead, edited through the
   * Navigation Content/Design panels. That is deliberate and predates the
   * Puck upgrade, so these are pinned as inert rather than skipped — if
   * someone wires `_style` through, this list is what tells them to move the
   * block into the honouring set.
   */
  const STYLE_INERT_BY_DESIGN = [
    "Navigation",
    "NavigationPreset",
    "NavBorderedPreset",
    "NavUnderlinedPreset",
    "NavScaledPreset",
  ];

  function landedProbes(type: string) {
    const defaults = (componentConfig(type).defaultProps?.[STYLE_FIELD_KEY] ?? {}) as AnyProps;
    const base = renderBlock(type);
    return PROBES.filter(([, patch]) => {
      const styled = renderBlock(type, { [STYLE_FIELD_KEY]: { ...defaults, ...patch } });
      return styled !== base;
    }).map(([name]) => name);
  }

  // A control the owner moves in the Design tab must change what is painted.
  // An inert control is the failure this catches: the field exists, the value
  // is stored, and the renderer ignores it.
  it.each(STYLE_BEARING.filter((t) => !STYLE_INERT_BY_DESIGN.includes(t)))(
    "%s honours at least one _style override",
    (type) => {
      expect(landedProbes(type)).not.toEqual([]);
    }
  );

  it.each(STYLE_INERT_BY_DESIGN)("%s keeps _style inert by design", (type) => {
    expect(landedProbes(type)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. Effective defaults float up rather than being materialized
// ---------------------------------------------------------------------------

describe("block sweep — effective defaults stay unset", () => {
  /**
   * The `portfolio-effective-defaults` contract: a control shows its current
   * effective value as a DISPLAY overlay while the block prop stays UNSET, so
   * the field keeps following the brand kit. Writing the value into
   * `defaultProps._style` instead ("materializing") makes the control read as
   * explicitly-set and silently decouples it from the theme — the control then
   * only *looks* right, which is exactly the "floats for display but isn't
   * really floating" failure.
   *
   * Spacing is the family the skill de-materialized, so it is the one pinned
   * here. A block that genuinely needs a grounded value should ground it in
   * its render, not in defaultProps.
   *
   * Scoped to the MANUAL primitives on purpose. A section preset is an
   * authored composition, and its spacing IS part of that design — the
   * "Minimal closing" band's 3rem is a deliberate authored value, not a theme
   * default that should follow the brand kit. Presets are covered instead by
   * the style-override and parity cases above.
   */
  const DISPLAY_ONLY_KEYS = [
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "marginTop",
    "marginBottom",
  ];

  const PRIMITIVES = STYLE_BEARING.filter((type) =>
    (MANUAL_BLOCK_KEYS as readonly string[]).includes(type)
  );

  it.each(PRIMITIVES)("%s does not materialize spacing into defaultProps", (type) => {
    const style = (componentConfig(type).defaultProps?.[STYLE_FIELD_KEY] ?? {}) as AnyProps;
    const materialized = DISPLAY_ONLY_KEYS.filter((k) => style[k] !== undefined);
    expect(materialized).toEqual([]);
  });

  /**
   * The parity invariant: canvas == preview == publish. An unset field that
   * resolves through CSS `inherit` paints the app-shell foreground in the
   * editor canvas but the brand foreground on the live page. With `_style`
   * unset, the block's own outer element must therefore carry the same inline
   * style in both modes.
   */
  function outerStyle(html: string): string | null {
    return html.match(/<[a-z][^>]*?\sstyle="([^"]*)"/i)?.[1] ?? null;
  }

  it.each(PARITY_TYPES)("%s resolves the same inline style in canvas and publish", (type) => {
    const published = outerStyle(renderBlock(type));
    const editing = outerStyle(renderBlock(type, { puck: { isEditing: true } }));
    expect(editing).toBe(published);
  });
});

// ---------------------------------------------------------------------------
// 5. Every template renders end to end, both zones
// ---------------------------------------------------------------------------

const TEMPLATE_ZONES = PORTFOLIO_TEMPLATES.flatMap((template) => {
  const seeded = template.seedData({ workspace: { name: "Sweep Studio" } });
  return (["home", "gallery"] as const).map((zone) => ({
    id: `${template.id}/${zone}`,
    data: seeded[zone],
  }));
});

describe("block sweep — templates render", () => {
  it("expands to both zones of every registered template", () => {
    expect(TEMPLATE_ZONES).toHaveLength(PORTFOLIO_TEMPLATES.length * 2);
  });

  it.each(TEMPLATE_ZONES.map((z) => [z.id, z.data] as const))(
    "%s renders through Puck without throwing",
    (_id, data) => {
      expect(() =>
        render(<Render config={renderConfig} data={data as unknown as Data} />)
      ).not.toThrow();
    }
  );
});
