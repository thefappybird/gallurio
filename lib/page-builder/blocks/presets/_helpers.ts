/**
 * Shared building blocks for the section-preset compositions.
 *
 * Every preset is a `Container` whose `content` slot is pre-filled with manual
 * blocks. These helpers keep that data terse and keep the contrast decisions in
 * ONE place — a band's text/button token pairing is a correctness property (see
 * DESIGN.md's Preset Quality Bar), not a per-preset style choice.
 *
 * Pure data. No React, no server imports: the same module feeds the editor
 * canvas and the public renderer.
 */

import type { Slot } from "@measured/puck";

/** A child block in a preset's slot. Props are intentionally loose here — each
 *  child's real prop type is enforced where the block is defined. */
export function child(type: string, props: Record<string, unknown>) {
  return { type, props };
}

/** `content` literals are validated structurally by Puck at runtime; cast once. */
export const slot = (items: ReturnType<typeof child>[]): Slot => items as unknown as Slot;

// ---------------------------------------------------------------------------
// Contrast-safe band recipes
//
// Two token pairs are guaranteed opposites in every committed brand kit:
//   foreground / background   and   primary / background
// Anything pinned against one of those pairs stays legible on the dark pole
// (Luxury) as well as the five light kits. `accent` is only guaranteed against
// the kit's own ground, which is why accent bands invert rather than tint.
// ---------------------------------------------------------------------------

/** Text sitting on a dark scrim or an accent fill: the page's light pole. */
export const onDark = { textColorToken: "background" } as const;

/**
 * A Button sitting ON an accent band. ButtonBlock has no brand-kit fallback:
 * with `buttonStyle` unset it renders a transparent fill with its label and
 * border in `--pf-color-fg`, which against an accent background measures
 * 1.66:1 (Bold) to 3.54:1 (Editorial) — every committed kit fails the 4.5:1
 * bar. Inverting the band (background-token fill, accent label) clears it on
 * every kit, because the Preset Quality Bar already guarantees accent-on-ground.
 */
export const onAccentBand = {
  buttonStyle: "solid",
  buttonColorToken: "background",
  textColorToken: "accent",
} as const;

/**
 * A Button sitting ON a primary-token band. Outline takes its label and stroke
 * from `buttonColorToken`, which defaults to `primary` — invisible on a primary
 * ground. Pinning it to `background` uses primary's guaranteed opposite.
 */
export const onPrimaryBand = {
  buttonStyle: "outline",
  buttonColorToken: "background",
} as const;

/**
 * Section style for a contrasting band built on the primary token. The section's
 * own `textColorToken` cascades to unstyled children through
 * `--pf-block-text-color`, so nested Heading/Text need no per-block override.
 */
export const primaryBandSection = {
  bgColorToken: "primary",
  textColorToken: "background",
} as const;

/**
 * Section style for a plain (non-band) section. Unstyled children default to the
 * theme foreground, which is the LIGHT pole on dark kits — without an explicit
 * ground they would render on an unstyled white surface and be illegible on
 * Luxury. Pin the section to the theme's own background token.
 */
export const pageSection = { bgColorToken: "background" } as const;

/** A hairline frame that earns itself by grouping — never decorative. */
export const hairlineFrame = {
  borderWidth: 1,
  borderColorToken: "foreground",
} as const;
