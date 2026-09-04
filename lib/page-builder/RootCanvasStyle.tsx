"use client";

import { useEffect, useMemo } from "react";
import { usePuckStore } from "./puckHooks";
import { resolveRootStyle, type RootPageStyle } from "./rootStyle";
import { PF_CONTAINER_NAME, PF_RESPONSIVE_CSS } from "./responsive";
import { CANVAS_DEVICE_WIDTHS, useCanvasViewport } from "./canvasViewportStore";
import { collectGoogleFontFamilies } from "./fonts";
import { useEffectiveBrandFont } from "./brandColors";
import { GoogleFontLoader } from "./GoogleFontLoader";

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
// Puck's canvas column is the right scroll owner for editor overflow. Keep
// horizontal overflow scrollable so constrained screens can still reach the full
// canvas, while the growth rules below make the preview surface itself wrap tall
// content instead of clipping its page background.
const CANVAS_PUCK_LAYOUT_GROWTH_CSS =
  `:has(> [data-tour-id="canvas"]) { height: auto; min-height: 100dvh; overflow-x: auto; overflow-y: auto; }`;

// In edit mode Puck wraps the preview surface (`[data-puck-preview]`) in an
// absolutely-positioned `._PuckCanvas-root_` (top: 0; bottom: 0), which pins the
// surface to its parent's explicit height instead of letting it grow with block
// content — so a page background set on the surface stops at the viewport height
// and taller content spills outside the colored frame.
//
// We target that wrapper by its STABLE structural relationship to `[data-puck-preview]`
// via `:has()`. (An earlier fixed-depth selector `[data-tour-id="canvas"] > * > *`
// missed it: Puck nests the surface ~5 levels deep, not 2.) Two alternatives are
// listed because the spotlight tour's `preview:` Puck override (EditorShell.tsx)
// wraps the surface in a `[data-tour-id="canvas-viewport"]` marker div for anchor
// measurement, making `[data-puck-preview]` a grandchild instead of a direct child:
//   - `:has(> [data-puck-preview])` — no tour wrapper present (e.g. iframe mode).
//   - `:has(> [data-tour-id="canvas-viewport"] > [data-puck-preview])` — current case.
// Overriding to `position: relative` + `height: auto` makes the surface content-driven
// so the page background wraps the tallest content; `min-height: 100dvh` keeps the
// blank canvas filling the viewport.
const CANVAS_PUCK_CANVAS_ROOT_CSS =
  `:has(> [data-puck-preview]), :has(> [data-tour-id="canvas-viewport"] > [data-puck-preview]) { position: relative; top: auto; bottom: auto; height: auto; min-height: 100dvh; }`;

const CANVAS_ROOT_SELECTOR =
  `:has(> [data-puck-preview]), :has(> [data-tour-id="canvas-viewport"] > [data-puck-preview])`;

// The root page drop zone carries data-puck-dropzone="root:default-zone" (Puck's
// hardcoded rootAreaId "root" + rootZone "default-zone"). All nested Container /
// Columns slot zones use data-puck-dropzone="${componentId}:${zoneName}" — so the
// exact-match attribute selector below is root-exclusive and does NOT touch nested
// slots.
//
// The sticky-footer frame for this zone comes from PF_PAGE_FRAME_CSS (emitted
// below with the rest of the shared sheet), which matches the drop zone by the
// PageBody it contains — the same rule the public page and the draft preview
// use, so the three surfaces cannot drift apart. The PageBody slot supplies the
// large empty drop target instead of an artificial tail below the footer.

/**
 * Full canvas stylesheet: the page-container declaration + the responsive sheet
 * (always present, so the canvas reflows with the viewport toggle) with the
 * dynamic per-page root style layered on top.
 */

// Device-width clamp + zoom for the edit canvas. Since `[data-puck-preview]` is
// the `pfpage` container, clamping its width makes the same container-query rules
// that drive the public page reflow blocks LIVE at the selected breakpoint. Zoom
// is a CSS scale on the same surface (transform-origin top-center keeps it
// centered as it shrinks). The clamp is only emitted for non-desktop widths
// (deviceWidth !== null) so desktop stays full-width.
export function buildCanvasViewportCss(deviceWidth: number | null, zoom: number): string {
  const surfaceRules: string[] = [];
  const rootRules: string[] = [];
  if (deviceWidth !== null) {
    surfaceRules.push(`width: ${deviceWidth}px; margin-inline: auto;`);
    rootRules.push(`width: ${deviceWidth * zoom}px !important;`);
  } else if (zoom !== 1) {
    rootRules.push(`width: calc(100% * ${zoom}) !important;`);
    surfaceRules.push(`width: calc(100% / ${zoom}); margin-inline: auto;`);
  }
  if (zoom !== 1) surfaceRules.push(`transform: scale(${zoom}); transform-origin: top center;`);

  const rules: string[] = [];
  if (rootRules.length) rules.push(`${CANVAS_ROOT_SELECTOR} { ${rootRules.join(" ")} }`);
  if (surfaceRules.length) rules.push(`${CANVAS_SURFACE_SELECTOR} { ${surfaceRules.join(" ")} }`);
  return rules.join("\n");
}

export function buildCanvasCss(
  style?: RootPageStyle | null,
  viewport?: { deviceWidth: number | null; zoom: number },
): string {
  const decls = rootCanvasCssText(style);
  // Also paint CANVAS_ROOT_SELECTOR (Puck's `_PuckCanvas-root_` wrapper around
  // [data-puck-preview] — the same element CANVAS_PUCK_CANVAS_ROOT_CSS above
  // retargets for position/height). Puck's own CSS module hardcodes
  // `background: white` on that wrapper; when the preview surface's own box
  // doesn't fully cover it, the hardcoded white shows through below the first
  // block instead of the page's explicit background color.
  const rootRule = decls
    ? `[data-puck-preview], .Puck-root, .PuckLayout-content, ${CANVAS_ROOT_SELECTOR} { ${decls} }`
    : "";
  // Emitted last so it layers over the base width rules in the cascade.
  const viewportRule = viewport ? buildCanvasViewportCss(viewport.deviceWidth, viewport.zoom) : "";
  return `${PF_CANVAS_CONTAINER_CSS}\n${CANVAS_COLOR_ISOLATION_CSS}\n${CANVAS_GROWTH_CSS}\n${CANVAS_PUCK_PREVIEW_HEIGHT_CSS}\n${CANVAS_PUCK_LAYOUT_GROWTH_CSS}\n${CANVAS_PUCK_CANVAS_ROOT_CSS}\n${PF_RESPONSIVE_CSS}\n${rootRule}\n${viewportRule}`;
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
  // Whole Puck data tree — walked below for any per-block Google Font
  // selections so the canvas loads exactly the fonts the page actually uses,
  // matching the public page (see GoogleFontLoader.tsx / fonts.ts).
  const puckData = usePuckStore((s) => s.appState?.data);
  const headingFont = useEffectiveBrandFont("heading");
  const bodyFont = useEffectiveBrandFont("body");
  const { device, zoom } = useCanvasViewport();
  const deviceWidth = CANVAS_DEVICE_WIDTHS[device];

  const googleFamilies = useMemo(
    () => collectGoogleFontFamilies({ puckData, headingFont, bodyFont }),
    [puckData, headingFont, bodyFont]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    let tag = document.getElementById(CANVAS_STYLE_ID) as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = CANVAS_STYLE_ID;
      document.head.appendChild(tag);
    }
    tag.textContent = buildCanvasCss(rootStyle, { deviceWidth, zoom });
    return () => {
      if (tag) tag.textContent = "";
    };
  }, [rootStyle, deviceWidth, zoom]);

  return <GoogleFontLoader families={googleFamilies} />;
}
