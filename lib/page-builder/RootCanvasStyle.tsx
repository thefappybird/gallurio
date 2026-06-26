"use client";

import { useEffect } from "react";
import { usePuckStore } from "./puckHooks";
import { resolveRootStyle, type RootPageStyle } from "./rootStyle";
import { PF_CONTAINER_NAME, PF_RESPONSIVE_CSS } from "./responsive";

const CANVAS_STYLE_ID = "pf-root-canvas-style";

// Puck's width-clamped preview surface (set by the viewport toggle). Making it the
// `pfpage` container means blocks respond LIVE to the selected device width in the
// canvas — the same container-query rules that drive the public page. Verified
// in-browser: `[data-puck-preview]` is the single clamped surface (the e2e spec
// asserts exactly one `pfpage` container lands here), so we scope to it precisely
// rather than a broad list that could nest containers.
const CANVAS_SURFACE_SELECTOR = "[data-puck-preview]";
const PF_CANVAS_CONTAINER_CSS =
  `${CANVAS_SURFACE_SELECTOR} { container-type: inline-size; container-name: ${PF_CONTAINER_NAME}; }`;

/** Serialize the resolved root style into CSS declarations (kebab-case). */
export function rootCanvasCssText(style?: RootPageStyle | null): string {
  const css = resolveRootStyle(style);
  return Object.entries(css)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v}`)
    .join("; ");
}

// Isolate canvas text from the brand theme: blocks that use `color: inherit` would
// otherwise pick up `--pf-color-fg` (set by the active brand kit). This rule
// anchors the default to the stable app-shell foreground token instead, which is
// always legible against the canvas background regardless of the chosen brand theme.
// Specificity is intentionally low (one attribute selector) so an inline `style`
// attribute written by a block color picker always wins — explicit overrides are
// unaffected. This rule is emitted only by the editor-side RootCanvasStyle
// component and is never present on the public `/w/[orgSlug]` route.
const CANVAS_COLOR_ISOLATION_CSS =
  `${CANVAS_SURFACE_SELECTOR} { color: var(--foreground); }`;

// Allow the canvas page to GROW with its content. Puck's CSS module pins
// `[data-puck-preview]` to `height: 100%` of the (viewport-height) scroll pane, so
// taller content — including blocks with `min-height: Xvh` — overflows the page
// background frame instead of stretching it. `min-height: fit-content` does NOT
// fix this: in the block axis `fit-content` resolves against the *available*
// height (~viewport), not the content size, so the surface stays viewport-tall.
// `height: auto` lets the surface take its natural content height (normal flow),
// and `min-height: 100dvh` keeps a blank canvas filling the viewport — together
// the page background always wraps the tallest content.
const CANVAS_GROWTH_CSS =
  `${CANVAS_SURFACE_SELECTOR} { height: auto; min-height: 100dvh; }`;

// Puck's _PuckPreview_ component (the direct child of our canvas wrapper) has
// `height: 100%` in its CSS module, which pins it to the fixed grid-row height
// inherited from `._PuckLayout-inner_` (height: 100dvh). When iframe mode is
// disabled, this clips or freezes scroll position for content taller than the
// viewport. Targeting it via the stable `[data-tour-id="canvas"] > *` selector
// overrides `height: 100%` → `height: auto` so it can grow with content.
const CANVAS_PUCK_PREVIEW_HEIGHT_CSS =
  `[data-tour-id="canvas"] > * { height: auto; min-height: 100%; }`;

// Puck's `._PuckLayout-inner_` grid has `height: 100dvh`, which caps the entire
// editor shell at viewport height. Our canvas wrapper lives in the "editor" grid
// area (grid-template-rows: min-content auto). Converting the grid height to
// `min-height: 100dvh` + `height: auto` lets the grid grow when the preview
// surface (and its content) is taller than the viewport. The `:has()` selector
// targets the grid by its stable structural relationship to our canvas wrapper —
// avoiding the hashed CSS-module class name (_PuckLayout-inner_HASH_) entirely.
//
// `overflow: clip` is added to remove the scroll-container behavior of
// `._PuckCanvas_` (grid-area: editor, overflow: auto by default). Unlike
// `overflow: hidden`, `overflow: clip` does NOT establish a BFC scroll container,
// so the grid row can grow vertically as content gets taller in edit mode.
// Width clipping is preserved so horizontal overflow is still hidden.
const CANVAS_PUCK_LAYOUT_GROWTH_CSS =
  `:has(> [data-tour-id="canvas"]) { height: auto; min-height: 100dvh; overflow: clip; }`;

// In edit mode Puck wraps the preview surface (`[data-puck-preview]`) in an
// absolutely-positioned `._PuckCanvas-root_` (top: 0; bottom: 0), which pins the
// surface to its parent's explicit height instead of letting it grow with block
// content — so a page background set on the surface stops at the viewport height
// and taller content spills outside the colored frame.
//
// We target that wrapper by its STABLE structural relationship — it is the direct
// parent of `[data-puck-preview]` — via `:has(> [data-puck-preview])`. (An earlier
// fixed-depth selector `[data-tour-id="canvas"] > * > *` missed it: Puck nests the
// surface ~5 levels deep, not 2.) Overriding to `position: relative` + `height: auto`
// makes the surface content-driven so the page background wraps the tallest content;
// `min-height: 100dvh` keeps the blank canvas filling the viewport.
const CANVAS_PUCK_CANVAS_ROOT_CSS =
  `:has(> [data-puck-preview]) { position: relative; top: auto; bottom: auto; height: auto; min-height: 100dvh; }`;

// The root page drop zone carries data-puck-dropzone="root:default-zone" (Puck's
// hardcoded rootAreaId "root" + rootZone "default-zone"). All nested Container /
// Columns slot zones use data-puck-dropzone="${componentId}:${zoneName}" — so the
// exact-match attribute selector below is root-exclusive and does NOT touch nested
// slots.
//
// Two rules on this droppable element:
//   min-height: 100dvh — droppable region never shrinks below the viewport height.
//   padding-bottom: 10rem — always adds a droppable tail below the last block so
//     users can drop into the empty space without hunting for a thin target.
//
// Together the effective droppable height is max(100dvh, contentHeight) + 10rem.
// Padding is part of the droppable element's box, so the 10rem tail is a real
// drop target (dnd-kit / Puck pick up pointer events within the padding box).
const CANVAS_ROOT_DROPZONE_CSS =
  `[data-puck-dropzone="root:default-zone"] { min-height: 100dvh; padding-bottom: 10rem; }`;

/**
 * Full canvas stylesheet: the page-container declaration + the responsive sheet
 * (always present, so the canvas reflows with the viewport toggle) with the
 * dynamic per-page root style layered on top.
 */
export function buildCanvasCss(style?: RootPageStyle | null): string {
  const decls = rootCanvasCssText(style);
  const rootRule = decls
    ? `[data-puck-preview], .Puck-root, .PuckLayout-content { ${decls} }`
    : "";
  return `${PF_CANVAS_CONTAINER_CSS}\n${CANVAS_COLOR_ISOLATION_CSS}\n${CANVAS_GROWTH_CSS}\n${CANVAS_PUCK_PREVIEW_HEIGHT_CSS}\n${CANVAS_PUCK_LAYOUT_GROWTH_CSS}\n${CANVAS_PUCK_CANVAS_ROOT_CSS}\n${CANVAS_ROOT_DROPZONE_CSS}\n${PF_RESPONSIVE_CSS}\n${rootRule}`;
}

/**
 * Editor-only: reflects the page root style onto the Puck canvas surface by
 * injecting a scoped <style> tag — NOT by wrapping the DOM (which breaks DnD).
 * The selector targets Puck's drop-zone surface; the controller verifies/adjusts
 * the selector in-browser after this lands.
 */
export function RootCanvasStyle() {
  const rootStyle = usePuckStore(
    (s) =>
      (s.appState?.data?.root?.props as { _rootStyle?: RootPageStyle } | undefined)?._rootStyle,
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    let tag = document.getElementById(CANVAS_STYLE_ID) as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = CANVAS_STYLE_ID;
      document.head.appendChild(tag);
    }
    tag.textContent = buildCanvasCss(rootStyle);
    return () => {
      if (tag) tag.textContent = "";
    };
  }, [rootStyle]);

  return null;
}
