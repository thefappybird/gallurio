import type React from "react";
import { colorTokenToVar } from "./styleToolkit";
import type { CssLength, StyleColorToken } from "./styleToolkit";

export type RootPageStyle = {
  // Design
  bgColorToken?: StyleColorToken | string;
  bgOpacity?: number; // 0-100, opacity of the background color fill
  // Layout
  paddingX?: CssLength;
  paddingY?: CssLength;
  marginX?: CssLength;
  marginY?: CssLength;
};

function withOpacity(color: string, opacity?: number): string {
  if (opacity === undefined || opacity >= 100) return color;
  const pct = Math.max(0, Math.min(100, opacity));
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

export function resolveRootStyle(style?: RootPageStyle | null): React.CSSProperties {
  if (!style) return {};
  const css: Record<string, string | number> = {};

  if (style.bgColorToken) {
    const base = colorTokenToVar(style.bgColorToken) ?? "";
    if (base) css.backgroundColor = withOpacity(base, style.bgOpacity);
  }
  if (style.paddingX !== undefined) {
    css.paddingLeft = style.paddingX;
    css.paddingRight = style.paddingX;
  }
  if (style.paddingY !== undefined) {
    css.paddingTop = style.paddingY;
    css.paddingBottom = style.paddingY;
  }
  if (style.marginX !== undefined) {
    css.marginLeft = style.marginX;
    css.marginRight = style.marginX;
  }
  if (style.marginY !== undefined) {
    css.marginTop = style.marginY;
    css.marginBottom = style.marginY;
  }
  return css as React.CSSProperties;
}
