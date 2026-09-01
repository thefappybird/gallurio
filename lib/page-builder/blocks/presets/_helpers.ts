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
// Foreground is guaranteed to clear AA against every theme surface:
// background, primary, secondary, and accent. This lets owners safely use any
// palette color as a section/card ground without changing its text token.
// ---------------------------------------------------------------------------

/** Text sitting on a scrim or colored fill uses the universal foreground. */
export const onDark = { textColorToken: "foreground" } as const;

/**
 * A Button sitting on an accent band. The foreground token is guaranteed to
 * clear AA against every committed accent surface.
 */
export const onAccentBand = {
  buttonStyle: "outline",
  buttonColorToken: "foreground",
  textColorToken: "foreground",
} as const;

/**
 * A Button sitting on a primary-token band. Pin its label and stroke to the
 * universal foreground instead of inheriting the same token as its ground.
 */
export const onPrimaryBand = {
  buttonStyle: "outline",
  buttonColorToken: "foreground",
} as const;

/**
 * Section style for a contrasting band built on the primary token. The section's
 * own `textColorToken` cascades to unstyled children through
 * `--pf-block-text-color`, so nested Heading/Text need no per-block override.
 */
export const primaryBandSection = {
  bgColorToken: "primary",
  textColorToken: "foreground",
} as const;

/** A full-strength accent band with copy in the universal foreground. */
export const accentBandSection = {
  bgColorToken: "accent",
  textColorToken: "foreground",
} as const;

/**
 * Section style for a plain (non-band) section. Unstyled children default to the
 * theme foreground, which is light on dark kits — without an explicit
 * ground they would render on an unstyled white surface and be illegible on
 * Luxury. Pin the section to the theme's own background token.
 */
export const pageSection = { bgColorToken: "background" } as const;

/** Reset both the ground and text cascade for a page-colored inset inside a band. */
export const pageInsetSection = {
  bgColorToken: "background",
  textColorToken: "foreground",
} as const;

/** A hairline frame that earns itself by grouping — never decorative. */
export const hairlineFrame = {
  borderWidth: 1,
  borderColorToken: "foreground",
} as const;
