import type React from "react";
import { colorTokenToVar } from "./styleToolkit";
import type { CssLength, StyleColorToken } from "./styleToolkit";

export type RootPageStyle = {
  // Design
  bgColorToken?: StyleColorToken | string;
  bgOpacity?: number; // 0-100, opacity of the background color fill
  // Layout — combined (legacy / back-compat)
  paddingX?: CssLength;
  paddingY?: CssLength;
  marginX?: CssLength;
  marginY?: CssLength;
  // Layout — per-side (override combined when present)
  paddingTop?: CssLength;
  paddingRight?: CssLength;
  paddingBottom?: CssLength;
  paddingLeft?: CssLength;
  marginTop?: CssLength;
  marginRight?: CssLength;
  marginBottom?: CssLength;
  marginLeft?: CssLength;
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
  // Apply combined X/Y first (legacy / back-compat)
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
  // Per-side values override combined (applied last)
  if (style.paddingTop !== undefined) css.paddingTop = style.paddingTop;
  if (style.paddingRight !== undefined) css.paddingRight = style.paddingRight;
  if (style.paddingBottom !== undefined) css.paddingBottom = style.paddingBottom;
  if (style.paddingLeft !== undefined) css.paddingLeft = style.paddingLeft;
  if (style.marginTop !== undefined) css.marginTop = style.marginTop;
  if (style.marginRight !== undefined) css.marginRight = style.marginRight;
  if (style.marginBottom !== undefined) css.marginBottom = style.marginBottom;
  if (style.marginLeft !== undefined) css.marginLeft = style.marginLeft;
  return css as React.CSSProperties;
}
