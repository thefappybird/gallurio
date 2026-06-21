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

// Allow the canvas page to GROW with its content. Puck's layout system gives
// [data-puck-preview] a height derived from the scroll pane (typically `height:100%`
// of the viewport-height layout area). Blocks that use `min-height: Xvh` inline
// extend beyond that fixed height — the block overflows the page background frame
// rather than stretching it. Overriding with `min-height: fit-content` makes the
// surface content-driven: the page/background always wraps the tallest content.
const CANVAS_GROWTH_CSS =
  `${CANVAS_SURFACE_SELECTOR} { min-height: fit-content; }`;

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
  return `${PF_CANVAS_CONTAINER_CSS}\n${CANVAS_COLOR_ISOLATION_CSS}\n${CANVAS_GROWTH_CSS}\n${PF_RESPONSIVE_CSS}\n${rootRule}`;
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
