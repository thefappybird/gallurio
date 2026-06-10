"use client";

import { useEffect } from "react";
import { usePuck } from "@measured/puck";
import { resolveRootStyle, type RootPageStyle } from "./rootStyle";

const CANVAS_STYLE_ID = "pf-root-canvas-style";

/** Serialize the resolved root style into CSS declarations (kebab-case). */
export function rootCanvasCssText(style?: RootPageStyle | null): string {
  const css = resolveRootStyle(style);
  return Object.entries(css)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v}`)
    .join("; ");
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
    const decls = rootCanvasCssText(rootStyle);
    tag.textContent = decls
      ? `[data-puck-preview], .Puck-root, .PuckLayout-content { ${decls} }`
      : "";
    return () => {
      if (tag) tag.textContent = "";
    };
  }, [rootStyle]);

  return null;
}
