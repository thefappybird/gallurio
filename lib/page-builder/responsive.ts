/**
 * Shared responsiveness helpers for portfolio blocks.
 *
 * Mechanism — a SINGLE container-query scope named `pfpage` is attached to the
 * page surface: the public root wrapper (`config.ts` `root.render`) and, in the
 * editor, the width-clamped Puck preview surface (`RootCanvasStyle` / iframe seam).
 * Block roots and their descendants are queried against that page width, so the
 * SAME design responds on the public page AND live in the editor viewport toggle.
 *
 * Why custom-property indirection — `resolveBlockStyle` (styleToolkit.ts) emits
 * padding / font-size as INLINE styles that beat any stylesheet rule (even with
 * `!important`). A stylesheet CANNOT override an inline literal, but a custom
 * property set in a stylesheet DOES cascade into an inline `var()` reference. So a
 * block sets `prop: var(--token, default)` inline and `PF_RESPONSIVE_CSS`
 * reassigns `--token` at breakpoints. When the user sets an explicit toolkit value
 * the toolkit emits the concrete inline property, which correctly wins.
 *
 * Why one container, not 22 — a container-query rule styles DESCENDANTS of the
 * container, never the container element itself, so a block root cannot restyle
 * its own padding from its own width. Putting `container-type` only on the page
 * surface also avoids per-block containment side effects (absolute-positioning
 * containing-block shifts, paint/layout containment, height collapse).
 */

import type { CSSProperties } from "react";

/** Container name for the page-level query scope (public root + editor canvas). */
export const PF_CONTAINER_NAME = "pfpage";

/**
 * Page-width breakpoints (px), aligned to the editor device-toggle widths
 * (Mobile 390 / Tablet 768 / Desktop 1280). Slightly above the raw device widths
 * so a block reliably trips the rule inside the clamped viewport.
 */
export const PF_BP_TABLET_MAX = 900; // tablet (768 viewport) upper edge
export const PF_BP_COMPACT = 600; // mobile (390 viewport)
export const PF_BP_NARROW = 400; // ultra-narrow phones

/**
 * Inline style fragment that makes an element the page query container. Spread
 * onto the public root wrapper. (The editor injects the equivalent CSS string —
 * `PF_PAGE_CONTAINER_CSS` — onto its preview surface.)
 */
export const PF_PAGE_CONTAINER: CSSProperties = {
  containerType: "inline-size",
  containerName: PF_CONTAINER_NAME,
};

/** CSS declaration establishing the page container — for injected `<style>` seams. */
export const PF_PAGE_CONTAINER_CSS = `container-type: inline-size; container-name: ${PF_CONTAINER_NAME};`;

/**
 * Section padding the gallery container blocks (GalleryGrid, GalleryMasonry,
 * FeaturedWork) paint when `_style` sets none. Lives here as ONE value so the
 * editor's padding controls can float exactly what the blocks apply — the two
 * drifting apart is what left those controls blank while the page had 64/24px.
 */
export const GALLERY_EFFECTIVE_PAD = {
  top: "4rem",
  right: "1.5rem",
  bottom: "4rem",
  left: "1.5rem",
} as const;

/** `GALLERY_EFFECTIVE_PAD` as the CSS shorthand the blocks hand to `padVar`. */
export const GALLERY_PAD_SHORTHAND = `${GALLERY_EFFECTIVE_PAD.top} ${GALLERY_EFFECTIVE_PAD.right}`;

/** Wrap a default value in the responsive padding custom property. */
export function padVar(defaultValue: string): string {
  return `var(--pf-pad, ${defaultValue})`;
}

/** Wrap a default grid-template-columns value in the responsive custom property. */
export function gridColsVar(defaultValue: string): string {
  return `var(--pf-grid-cols, ${defaultValue})`;
}

/** Wrap a default column-count value in the responsive custom property. */
export function masonryColsVar(defaultValue: string | number): string {
  return `var(--pf-masonry-cols, ${defaultValue})`;
}

/**
 * Global container-query rules. Reassign shared custom properties on block roots
 * (`[data-block]`) at page-width breakpoints; blocks reference these vars inline.
 * Injected once on the public page (`config.ts` `root.render`) and into the editor
 * canvas surface.
 *
 * Ordered widest -> narrowest so the cascade resolves: when several `max-width`
 * queries match (e.g. 380px matches 900/600/400), the last matching rule wins,
 * which is the narrowest — exactly the intended step-down.
 */
/**
 * Class a Container puts on its content slot when that slot stacks its children
 * DOWN a column (the default direction).
 */
export const PF_COLUMN_STACK_CLASS = "pf-stack-column";

/**
 * Cancels a nested Container's `flexGrow: 1` inside a column stack.
 *
 * Container declares `flex-grow: 1` so that siblings in a ROW stack share the
 * width (the split presets rely on it). Down a COLUMN the same declaration means
 * one nested section absorbs all the free height — its background bleeds over the
 * parent's whole empty area and the parent's vertical-distribution control stops
 * doing anything. Only the PARENT knows the axis, so the parent cancels it here.
 *
 * `!important` is required, not stylistic: `flex-grow` is written as an INLINE
 * style by the child, and an author `!important` declaration is the only thing
 * that outranks one (the custom-property indirection used elsewhere in this file
 * is unavailable — jsdom drops `var()` on a typed property, which would blind the
 * unit tests that pin this value).
 */
export const PF_COLUMN_STACK_CSS = `
.${PF_COLUMN_STACK_CLASS} > [data-block="container"] { flex-grow: 0 !important; }
`.trim();

/**
 * The sticky-footer frame: Navigation pinned on top, PageBody taking whatever is
 * left, Footer closing the page.
 *
 * It has to key on the PageBody's own marker because the element that actually
 * parents the three chrome blocks differs per surface and neither side can style
 * it directly: in the editor it is Puck's root drop zone, on the public page and
 * in the draft preview it is the anonymous wrapper `<Render>` puts around the
 * zone. Declaring the frame on the root wrapper instead (which IS ours) does
 * nothing — that wrapper's only child is this element, so its rows never see the
 * three blocks at all. `:has(> …)` matches exactly the one element that holds
 * them, on both surfaces, from a single rule.
 */
export const PF_PAGE_FRAME_CSS = `
:has(> [data-block="page-body"]) { display: flex; flex-direction: column; min-height: 100dvh; }
`.trim();

export const PF_RESPONSIVE_CSS = `
${PF_PAGE_FRAME_CSS}
${PF_COLUMN_STACK_CSS}
@container ${PF_CONTAINER_NAME} (max-width: ${PF_BP_TABLET_MAX}px) {
  [data-block] {
    --pf-pad: 2.5rem 1.25rem;
    --pf-grid-cols: repeat(2, minmax(0, 1fr));
    --pf-masonry-cols: 2;
  }
}
@container ${PF_CONTAINER_NAME} (max-width: ${PF_BP_COMPACT}px) {
  [data-block] {
    --pf-pad: 2rem 1rem;
    --pf-overlay-px: 1rem;
    --pf-overlay-py: 1rem;
  }
}
@container ${PF_CONTAINER_NAME} (max-width: ${PF_BP_NARROW}px) {
  [data-block] {
    --pf-pad: 1.5rem 0.875rem;
    --pf-grid-cols: 1fr;
    --pf-masonry-cols: 1;
  }
}
`.trim();
