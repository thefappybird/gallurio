"use client";

import { useEffect } from "react";
import { usePuck } from "@measured/puck";
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
  return `${PF_CANVAS_CONTAINER_CSS}\n${PF_RESPONSIVE_CSS}\n${rootRule}`;
}

/**
 * Editor-only: reflects the page root style onto the Puck canvas surface by
 * injecting a scoped <style> tag — NOT by wrapping the DOM (which breaks DnD).
 * The selector targets Puck's drop-zone surface; the controller verifies/adjusts
 * the selector in-browser after this lands.
 */
export function RootCanvasStyle() {
  const { appState } = usePuck();
  const rootStyle = (appState?.data?.root?.props as { _rootStyle?: RootPageStyle } | undefined)
    ?._rootStyle;

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
