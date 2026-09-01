/**
 * Contrast contract for the section-preset library.
 *
 * The preset quality bar requires every preset to stay legible on every
 * committed brand kit, including the dark Luxury kit. A preset can only fail
 * that in one of a few token-level ways, and all of them are computable from the
 * preset DATA plus the kit palette — no browser needed. So this suite walks all
 * 33 compositions against all 6 kits and measures WCAG 2.1 contrast for every
 * piece of text and every button.
 *
 * The theme contract also guarantees that foreground copy clears WCAG AA
 * against every background, primary, secondary, and accent surface.
 *
 * The color model below mirrors `resolveBlockStyle` and `ButtonBlock` exactly.
 * If either changes, this test must change with it — that coupling is the point.
 */

import { describe, it, expect } from "vitest";
import { THEME_PRESET_DEFINITIONS } from "../brandKitPicker/themePresetDefinitions";
import { SECTION_PRESETS, SECTION_PRESET_KEYS } from "./sectionPresets";
import { PORTFOLIO_TEMPLATES } from "../templates";
import type { StyleColorToken } from "../styleToolkit";

// ---------------------------------------------------------------------------
// WCAG 2.1 relative luminance
// ---------------------------------------------------------------------------

function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function linear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Alpha-composite `fg` over opaque `bg` — how a translucent fill actually reads. */
function composite(fg: string, bg: string, alpha: number): string {
  const F = channels(fg);
  const B = channels(bg);
  return (
    "#" +
    [0, 1, 2]
      .map((i) => Math.round(F[i] * alpha + B[i] * (1 - alpha)).toString(16).padStart(2, "0"))
      .join("")
  );
}

// ---------------------------------------------------------------------------
// Kit palettes, keyed by the `--pf-color-*` token names blocks actually write
// ---------------------------------------------------------------------------

type Palette = Record<StyleColorToken, string>;

const KITS: Record<string, Palette> = Object.fromEntries(
  Object.entries(THEME_PRESET_DEFINITIONS).map(([id, { brandKit }]) => [
    id,
    {
      primary: brandKit.primaryColor,
      secondary: brandKit.secondaryColor,
      accent: brandKit.accentColor,
      background: brandKit.backgroundColor,
      foreground: brandKit.foregroundColor,
    } satisfies Palette,
  ])
);

const KIT_IDS = Object.keys(KITS);

/** Tokens are the only legal color source in a preset; anything else is a bug. */
function resolve(palette: Palette, token: unknown, fallback: StyleColorToken): string {
  return typeof token === "string" && token in palette
    ? palette[token as StyleColorToken]
    : palette[fallback];
}

// ---------------------------------------------------------------------------
// Walking a composition
// ---------------------------------------------------------------------------

type Style = Record<string, unknown>;
type Block = { type?: string; props?: Record<string, unknown> };

/** One measured pair, named well enough to debug from the failure message alone. */
type Measurement = { what: string; fg: string; bg: string; min: number };

const TEXT_BLOCKS = new Set(["Heading", "Text"]);

function collect(
  block: Block,
  palette: Palette,
  inherited: { ground: string; text: StyleColorToken | string },
  path: string,
  out: Measurement[]
): void {
  const props = block.props ?? {};
  const style = (props._style ?? {}) as Style;
  const type = block.type ?? "?";

  // A section's own background token becomes the ground for everything inside it.
  const ground = style.bgColorToken ? resolve(palette, style.bgColorToken, "background") : inherited.ground;
  // `resolveBlockStyle` publishes a section's textColorToken as --pf-block-text-color,
  // which nested Heading/Text read before falling back to the theme foreground.
  const textToken = (style.textColorToken as string | undefined) ?? inherited.text;
  const here = `${path} > ${type}`;

  if (TEXT_BLOCKS.has(type)) {
    out.push({
      what: `${here} text`,
      fg: resolve(palette, textToken, "foreground"),
      bg: ground,
      min: 4.5,
    });
  }

  if (type === "Button") {
    // Mirrors ButtonBlock's five branches. The brand kit's own buttonStyle is
    // deliberately NOT consulted — ButtonBlock reads only `_style.buttonStyle`.
    const fill = resolve(palette, style.buttonColorToken, "primary");
    const custom = style.textColorToken as string | undefined;
    const variant = style.buttonStyle as string | undefined;

    if (variant === "link") {
      // Transparent, borderless. Like Heading/Text, ButtonBlock's link branch
      // reads the section's cascaded `--pf-block-text-color` and only falls back
      // to `--pf-color-fg` when no ancestor set one — same as the legacy/unset
      // branch below. `textToken` already folds the button's own override in.
      out.push({ what: `${here} link label`, fg: resolve(palette, textToken, "foreground"), bg: ground, min: 4.5 });
    } else if (variant === "outline") {
      // Transparent fill: the label sits directly on the section ground.
      out.push({ what: `${here} outline label`, fg: custom ? resolve(palette, custom, "foreground") : palette.foreground, bg: ground, min: 4.5 });
    } else if (variant === "soft") {
      const wash = composite(fill, ground, 0.15);
      out.push({ what: `${here} soft label`, fg: custom ? resolve(palette, custom, "foreground") : palette.foreground, bg: wash, min: 4.5 });
    } else if (variant === "solid") {
      out.push({ what: `${here} solid label`, fg: custom ? resolve(palette, custom, "foreground") : palette.foreground, bg: fill, min: 4.5 });
      // A solid fill must also be distinguishable FROM the band it sits on, or the
      // button reads as floating text. 3:1 is the non-text UI-component threshold.
      out.push({ what: `${here} solid fill vs ground`, fg: fill, bg: ground, min: 3 });
    } else {
      // Unset: transparent fill; label and 2px border follow the same text
      // cascade the link branch does.
      const hasColor = style.buttonColorToken !== undefined;
      const bg = hasColor ? fill : ground;
      out.push({ what: `${here} default label`, fg: resolve(palette, textToken, "foreground"), bg, min: 4.5 });
    }
  }

  if (type === "ContactDetails") {
    // buildContactLabelStyle / buildContactValueStyle / buildContactIconColor
    // hardcode their defaults to a TOKEN each, and deliberately ignore the
    // section's textColorToken cascade — so `textToken` must not appear here.
    out.push({
      what: `${here} label`,
      fg: resolve(palette, style.labelColorToken as string | undefined, "foreground"),
      bg: ground,
      min: 4.5,
    });
    out.push({
      what: `${here} value`,
      fg: resolve(palette, style.valueColorToken as string | undefined, "foreground"),
      bg: ground,
      min: 4.5,
    });
    // Social icons are non-text UI: the 3:1 component threshold applies.
    out.push({
      what: `${here} social icons`,
      fg: resolve(palette, style.iconColorToken as string | undefined, "foreground"),
      bg: ground,
      min: 3,
    });
  }

  const children = props.content;
  if (Array.isArray(children)) {
    children.forEach((c, i) =>
      collect(c as Block, palette, { ground, text: textToken }, `${here}[${i}]`, out)
    );
  }
}

function measure(presetKey: string, kitId: string): Measurement[] {
  const palette = KITS[kitId];
  const preset = SECTION_PRESETS[presetKey as keyof typeof SECTION_PRESETS];
  const out: Measurement[] = [];
  collect(
    { type: presetKey, props: preset.defaultProps as unknown as Record<string, unknown> },
    palette,
    { ground: palette.background, text: "foreground" },
    presetKey,
    out
  );
  return out;
}

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------

describe("preset contrast against every committed brand kit", () => {
  it("covers all 33 presets and all 6 kits", () => {
    expect(SECTION_PRESET_KEYS).toHaveLength(33);
    expect(KIT_IDS).toHaveLength(6);
  });

  for (const kitId of Object.keys(KITS)) {
    describe(`${kitId} kit`, () => {
      it.each(SECTION_PRESET_KEYS)("%s stays legible", (presetKey) => {
        const failures = measure(presetKey, kitId)
          .map((m) => ({ ...m, value: contrast(m.fg, m.bg) }))
          .filter((m) => m.value < m.min)
          .map((m) => `${m.what}: ${m.value.toFixed(2)}:1 (needs ${m.min}:1, ${m.fg} on ${m.bg})`);

        expect(failures).toEqual([]);
      });
    });
  }
});

describe("scrimmed presets stay legible once a background image is added", () => {
  // The measurements above run against each preset's DEFAULT props, where
  // `backgroundImages` is empty and no scrim renders. The Luxury failures lived
  // exactly one step past that: the owner drops in a photo, the scrim appears,
  // and copy pinned to the background token lands on a BLACK wash that on Luxury
  // is the same near-black. So model the scrim explicitly here.
  const scrimmed = SECTION_PRESET_KEYS.filter(
    (key) => ((SECTION_PRESETS[key].defaultProps.overlayOpacity ?? 0) as number) > 0
  );

  it("there is at least one scrimmed preset to check", () => {
    expect(scrimmed.length).toBeGreaterThan(0);
  });

  it.each(scrimmed)("%s tints its scrim with a palette token, not black", (key) => {
    // Black is the legacy default and is only safe on light kits. Primary is
    // background's guaranteed opposite in every committed kit, so a scrim tinted
    // with it holds the copy on the dark pole too.
    const props = SECTION_PRESETS[key].defaultProps as { overlayColorToken?: string };
    expect(props.overlayColorToken).toBeDefined();
  });

  for (const kitId of Object.keys(KITS)) {
    it.each(scrimmed)(`%s copy survives its scrim on the ${kitId} kit`, (key) => {
      const palette = KITS[kitId];
      const props = SECTION_PRESETS[key].defaultProps as {
        overlayOpacity?: number;
        overlayColorToken?: string;
        _style?: Style;
        content?: unknown;
      };
      const base = resolve(palette, props._style?.bgColorToken, "background");
      const scrim = props.overlayColorToken
        ? resolve(palette, props.overlayColorToken, "background")
        : "#000000";
      const ground = composite(scrim, base, (props.overlayOpacity ?? 0) / 100);

      const out: Measurement[] = [];
      for (const [i, block] of (props.content as Block[]).entries()) {
        collect(block, palette, { ground, text: (props._style?.textColorToken as string) ?? "foreground" }, `${key}[${i}]`, out);
      }

      const failures = out
        .map((m) => ({ ...m, value: contrast(m.fg, m.bg) }))
        .filter((m) => m.value < m.min)
        .map((m) => `${m.what}: ${m.value.toFixed(2)}:1 (needs ${m.min}:1, ${m.fg} on ${m.bg})`);

      expect(failures).toEqual([]);
    });
  }
});

describe("template seed literals stay legible against every committed brand kit", () => {
  // bold/editorial/luxury/minimal hand-roll their own inline seed blocks rather
  // than drawing from SECTION_PRESETS, so they bypass the walk above entirely.
  // Same color model, same 6-kit sweep — an owner can switch theme after
  // applying a template, so a seed literal must survive every kit, not just
  // the template's own default brand kit.
  const templateIds = PORTFOLIO_TEMPLATES.map((t) => t.id);

  for (const kitId of Object.keys(KITS)) {
    describe(`${kitId} kit`, () => {
      it.each(templateIds)("%s template seed stays legible", (templateId) => {
        const template = PORTFOLIO_TEMPLATES.find((t) => t.id === templateId)!;
        const data = template.seedData({ workspace: { name: "Studio Aurora" } });
        const palette = KITS[kitId];
        const out: Measurement[] = [];

        for (const [zoneName, zoneData] of [["home", data.home], ["gallery", data.gallery]] as const) {
          (zoneData?.content ?? []).forEach((block, i) =>
            collect(block as Block, palette, { ground: palette.background, text: "foreground" }, `${templateId}.${zoneName}[${i}]`, out)
          );
        }

        const failures = out
          .map((m) => ({ ...m, value: contrast(m.fg, m.bg) }))
          .filter((m) => m.value < m.min)
          .map((m) => `${m.what}: ${m.value.toFixed(2)}:1 (needs ${m.min}:1, ${m.fg} on ${m.bg})`);

        expect(failures).toEqual([]);
      });
    });
  }
});

describe("the ContactDetails branch is actually reached by the walker", () => {
  // Guards against the failure mode where the branch above stops matching (a
  // renamed block type, a preset restructured so the walker never descends to
  // it) and every ContactDetails assertion silently becomes vacuous.
  it("measures the label, value and icons of every ContactDetails in the preset library", () => {
    const seen = SECTION_PRESET_KEYS.flatMap((key) =>
      measure(key, "minimal")
        .map((m) => m.what)
        .filter((w) => w.includes("ContactDetails")),
    );
    // contact.ts ships three, footer.ts one — four blocks, three checks each.
    expect(seen.filter((w) => w.endsWith("label"))).toHaveLength(4);
    expect(seen.filter((w) => w.endsWith("value"))).toHaveLength(4);
    expect(seen.filter((w) => w.endsWith("social icons"))).toHaveLength(4);
    // The directory footer is the one the icon-align bug was reported against.
    expect(
      measure("FooterDirectoryPreset", "minimal").some((m) =>
        m.what.includes("ContactDetails"),
      ),
    ).toBe(true);
  });
});

describe("the foreground token is safe on every theme surface", () => {
  // Two invariants make the preset recipes safe on the dark pole. If a future
  // brand kit breaks either, dozens of presets go illegible at once — so assert
  // them directly rather than only through the presets that depend on them.
  it.each(Object.keys(KITS))("%s: foreground is legible on every surface", (kitId) => {
    const p = KITS[kitId];
    for (const surface of [p.background, p.primary, p.secondary, p.accent]) {
      expect(contrast(p.foreground, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
