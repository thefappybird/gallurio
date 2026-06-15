/**
 * Shared per-block style toolkit.
 *
 * `BlockStyle` is the section-level styling an owner applies to any Puck block
 * via the editor's Canva-style toolbar (the `_style` field). `resolveBlockStyle`
 * turns it into a `React.CSSProperties` object — the SINGLE source of truth used
 * by BOTH the client editor preview (editorConfig.tsx) and the production block
 * render (blocks/*Block.tsx), so the canvas and the live page can't drift.
 *
 * No "use client", no server-only imports — safe on both sides. Colors are
 * stored as palette TOKENS (not raw hex) so blocks track the workspace's
 * configurable 5-color brand palette; tokens map to the `--pf-color-*` CSS vars
 * the public-page wrapper sets. Fonts pick from the 5 curated pairs and override
 * `--pf-font-heading` / `--pf-font-body` locally so headings and body both follow.
 */

import type { Field } from "@measured/puck";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { FONT_PAIR_MAP } from "./resolveBrandKit";
import type { BrandKitFontPair, BrandKitButtonStyle } from "./types";
import { fontFamilyValue, type PortfolioFontKey } from "./fonts";
export { fontFamilyValue };

// The `_style` field key — the per-block style toolkit lives here, as the first
// field of every block so it renders as the first ("toolkit") section.
export const STYLE_FIELD_KEY = "_style" as const;

// The five palette slots an owner configures in the Theme panel.
export const STYLE_COLOR_TOKENS = [
  "primary",
  "secondary",
  "accent",
  "background",
  "foreground",
] as const;
export type StyleColorToken = (typeof STYLE_COLOR_TOKENS)[number];

export const SHADOW_SIZES = ["none", "sm", "md", "lg"] as const;
export type ShadowSize = (typeof SHADOW_SIZES)[number];

export type TextAlign = "left" | "center" | "right";

export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

// Highlight (marker band) appearance — shared by the carousel heading/description.
export const HIGHLIGHT_SHAPES = ["sharp", "subtle", "rounded"] as const;
export type HighlightShape = (typeof HIGHLIGHT_SHAPES)[number];
export const HIGHLIGHT_SIZES = ["sm", "md", "lg"] as const;
export type HighlightSize = (typeof HIGHLIGHT_SIZES)[number];

// A CSS length with a unit picker in the UI (px or %). Stored as the raw CSS
// string, e.g. "320px" or "50%". `undefined` → not set (browser default / auto).
export type CssLength = string;

export type SelfAlign = "left" | "center" | "right";

export type BlockStyle = {
  // Border + frame
  borderWidth?: number; // px
  borderColorToken?: StyleColorToken | string;
  radius?: number; // px
  shadow?: ShadowSize;
  // Spacing — legacy px numbers (kept for back-compat reads of old drafts)
  paddingY?: number;
  paddingX?: number;
  marginY?: number;
  // Spacing — unit-aware (px/%).
  marginTop?: CssLength;
  marginBottom?: CssLength;
  marginLeft?: CssLength;
  marginRight?: CssLength;
  paddingTop?: CssLength;
  paddingRight?: CssLength;
  paddingBottom?: CssLength;
  paddingLeft?: CssLength;
  // Position + size of the block itself
  selfAlign?: SelfAlign; // horizontal placement via margin-auto (visible when width < container)
  width?: CssLength;
  height?: CssLength;
  // Grid placement when the block is a child of a Columns/grid container
  colSpan?: number;
  rowSpan?: number;
  // Flex container layout — for Container/Flex/preset sections
  flexDirection?: "row" | "column";
  alignItems?: "start" | "center" | "end" | "stretch";
  justifyContent?: "start" | "center" | "end" | "between" | "around";
  gap?: number; // px, gap between children (0–96)
  // Background
  bgColorToken?: StyleColorToken | string;
  bgImagePublicId?: string;
  // Typography (applied SECTION-WIDE — to the whole block via resolveBlockStyle)
  fontPair?: BrandKitFontPair; // legacy; kept for back-compat reads
  fontFamily?: PortfolioFontKey;
  fontSize?: number; // px
  textColorToken?: StyleColorToken | string;
  // Button fill color (Button block only) — applied by ButtonBlock to the <a>.
  buttonColorToken?: StyleColorToken | string;
  // Button visual style (solid/outline/soft) — overrides brand-kit default for this button.
  buttonStyle?: BrandKitButtonStyle;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
  // Carousel-only: floating-overlay text padding (shared) + per-target text
  // styling. Heading and description are styled independently and threaded into
  // GalleryHeader by GalleryCarouselBlock. All optional; supersedes the earlier
  // shared carousel typography (same branch, unreleased) so no migration needed.
  textPaddingX?: CssLength;
  textPaddingY?: CssLength;
  // Carousel-only: gap (px) between the heading and the description.
  headingGap?: number;
  // Heading target
  headingBold?: boolean;
  headingItalic?: boolean;
  headingUnderline?: boolean;
  headingAlign?: TextAlign;
  headingColorToken?: StyleColorToken | string;
  headingFontFamily?: PortfolioFontKey;
  headingLevel?: HeadingLevel;
  headingHighlight?: boolean;
  headingHighlightToken?: StyleColorToken | string;
  headingHighlightShape?: HighlightShape;
  headingHighlightSize?: HighlightSize;
  // Description target
  descriptionBold?: boolean;
  descriptionItalic?: boolean;
  descriptionUnderline?: boolean;
  descriptionAlign?: TextAlign;
  descriptionColorToken?: StyleColorToken | string;
  descriptionFontFamily?: PortfolioFontKey;
  descriptionFontSize?: number; // px
  descriptionHighlight?: boolean;
  descriptionHighlightToken?: StyleColorToken | string;
  descriptionHighlightShape?: HighlightShape;
  descriptionHighlightSize?: HighlightSize;
  // Motion
  animation?: AnimationType; // entrance (plays when scrolled into view)
  animationDuration?: number; // ms
  hover?: HoverEffect;
};

export const ANIMATION_TYPES = ["none", "fade", "slide-up", "slide-down", "slide-left", "slide-right", "zoom"] as const;
export type AnimationType = (typeof ANIMATION_TYPES)[number];

export const HOVER_EFFECTS = ["none", "scale", "lift", "dim", "brighten"] as const;
export type HoverEffect = (typeof HOVER_EFFECTS)[number];

export const DEFAULT_BLOCK_STYLE: BlockStyle = {};

export const FLEX_JUSTIFY_MAP: Record<NonNullable<BlockStyle["justifyContent"]>, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};

export const FLEX_ALIGN_MAP: Record<NonNullable<BlockStyle["alignItems"]>, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

/**
 * Read the plain text out of a stored text prop. Block text props are plain
 * strings; this also tolerates a legacy `{ text, ... }` object (from the
 * short-lived per-text-styling experiment) so old drafts don't crash the render.
 */
export function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "text" in value) {
    const t = (value as { text?: unknown }).text;
    return typeof t === "string" ? t : "";
  }
  return "";
}

/**
 * Field definition for the production `puckConfig` (server). The server `<Render>`
 * never renders fields, so this is a no-op placeholder whose only job is to keep
 * the `_style` key present so it round-trips and the editor/prod parity test stays
 * green. The real editing UI is the custom field wired in editorConfig.tsx.
 */
export const productionStyleField = {
  type: "custom",
  label: "Style",
  render: () => null,
} as unknown as Field<BlockStyle | undefined>;

// Clamp bounds for numeric inputs — keeps a malformed/hostile value from
// producing an absurd layout. Mirrored by the field UI's min/max.
export const STYLE_LIMITS = {
  borderWidth: { min: 0, max: 12 },
  radius: { min: 0, max: 64 },
  paddingY: { min: 0, max: 200 },
  paddingX: { min: 0, max: 200 },
  marginY: { min: 0, max: 200 },
  fontSize: { min: 10, max: 120 },
  gap: { min: 0, max: 96 },
} as const;

// Map a palette token to its CSS custom property.
const TOKEN_VAR: Record<StyleColorToken, string> = {
  primary: "var(--pf-color-primary)",
  secondary: "var(--pf-color-secondary)",
  accent: "var(--pf-color-accent)",
  background: "var(--pf-color-bg)",
  foreground: "var(--pf-color-fg)",
};

const SHADOW_VALUE: Record<ShadowSize, string | undefined> = {
  none: undefined,
  sm: "0 1px 2px rgba(0,0,0,0.10)",
  md: "0 4px 14px rgba(0,0,0,0.14)",
  lg: "0 14px 38px rgba(0,0,0,0.20)",
};

export function colorTokenToVar(token: StyleColorToken | string | undefined): string | undefined {
  if (!token) return undefined;
  if ((STYLE_COLOR_TOKENS as readonly string[]).includes(token)) {
    return TOKEN_VAR[token as StyleColorToken];
  }
  return token; // raw hex or other CSS color value
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function bgImageUrl(assetId: string): string | null {
  const url = imageDeliveryUrl(assetId, { width: 1600, fit: "cover" });
  return url || null;
}

/**
 * Resolve a BlockStyle into inline CSS. Merge the result over a block's own base
 * styles (toolkit wins). Custom properties (`--pf-font-*`) are included so font
 * choice cascades to both headings and body inside the block.
 */
export function resolveBlockStyle(style?: BlockStyle | null): React.CSSProperties {
  if (!style) return {};
  // Use a loose record so we can set CSS custom properties, then cast once.
  const css: Record<string, string | number> = {};

  // Border
  if (style.borderWidth && style.borderWidth > 0) {
    const w = clamp(style.borderWidth, STYLE_LIMITS.borderWidth.min, STYLE_LIMITS.borderWidth.max);
    css.borderStyle = "solid";
    css.borderWidth = `${w}px`;
    css.borderColor = colorTokenToVar(style.borderColorToken) ?? "var(--pf-color-fg)";
  }
  if (style.radius !== undefined) {
    css.borderRadius = `${clamp(style.radius, STYLE_LIMITS.radius.min, STYLE_LIMITS.radius.max)}px`;
  }
  if (style.shadow && style.shadow !== "none") {
    const sh = SHADOW_VALUE[style.shadow];
    if (sh) css.boxShadow = sh;
  }

  // Spacing
  const py = style.paddingY;
  const px = style.paddingX;
  if (py !== undefined || px !== undefined) {
    const vy = py !== undefined ? clamp(py, STYLE_LIMITS.paddingY.min, STYLE_LIMITS.paddingY.max) : null;
    const vx = px !== undefined ? clamp(px, STYLE_LIMITS.paddingX.min, STYLE_LIMITS.paddingX.max) : null;
    if (vy !== null) {
      css.paddingTop = `${vy}px`;
      css.paddingBottom = `${vy}px`;
    }
    if (vx !== null) {
      css.paddingLeft = `${vx}px`;
      css.paddingRight = `${vx}px`;
    }
  }
  if (style.marginY !== undefined) {
    const m = clamp(style.marginY, STYLE_LIMITS.marginY.min, STYLE_LIMITS.marginY.max);
    css.marginTop = `${m}px`;
    css.marginBottom = `${m}px`;
  }

  // Unit-aware (px/%) per-side spacing + size — these win over the legacy values.
  if (style.paddingTop) css.paddingTop = style.paddingTop;
  if (style.paddingRight) css.paddingRight = style.paddingRight;
  if (style.paddingBottom) css.paddingBottom = style.paddingBottom;
  if (style.paddingLeft) css.paddingLeft = style.paddingLeft;
  if (style.marginTop) css.marginTop = style.marginTop;
  if (style.marginBottom) css.marginBottom = style.marginBottom;
  if (style.marginLeft) css.marginLeft = style.marginLeft;
  if (style.marginRight) css.marginRight = style.marginRight;
  if (style.width) css.width = style.width;
  if (style.height) css.height = style.height;

  // Horizontal self-placement via margin-auto. Works everywhere (editor canvas,
  // production page) without needing a flex parent. Only has visual effect
  // when the block's width is less than the container (e.g. explicit width set,
  // or Button whose wrapper is always fit-content).
  if (style.selfAlign === "center") {
    css.marginLeft = "auto";
    css.marginRight = "auto";
  } else if (style.selfAlign === "right") {
    css.marginLeft = "auto";
    css.marginRight = "0";
  } else if (style.selfAlign === "left") {
    css.marginLeft = "0";
    css.marginRight = "auto";
  }

  // Grid placement when this block is a child of a Columns/grid container.
  if (style.colSpan && style.colSpan > 1) css.gridColumn = `span ${Math.min(12, Math.floor(style.colSpan))}`;
  if (style.rowSpan && style.rowSpan > 1) css.gridRow = `span ${Math.min(12, Math.floor(style.rowSpan))}`;

  // Content alignment for leaf blocks. `alignItems` maps to text-align so any
  // block (Heading, Text, etc.) responds to the Layout-tab Align control. Flex
  // container blocks (Container, Flex) also apply align-items:stretch on their
  // inner wrapper so children fill width — both mechanisms are consistent.
  if (style.alignItems) {
    const ta: Record<string, string | undefined> = {
      start: "left", center: "center", end: "right", stretch: undefined,
    };
    const v = ta[style.alignItems];
    if (v) css.textAlign = v;
  }

  // Gap between children — emitted here so it applies on any flex/grid container.
  // justifyContent is intentionally excluded: flex container blocks apply it to
  // their inner content wrappers; it has no useful meaning on a leaf block root.
  if (style.gap != null) {
    css.gap = `${clamp(style.gap, STYLE_LIMITS.gap.min, STYLE_LIMITS.gap.max)}px`;
  }

  // Entrance-animation duration is exposed as a CSS var consumed by the global
  // motion stylesheet (the data-attrs from resolveBlockAttrs drive the rest).
  if (style.animation && style.animation !== "none" && style.animationDuration) {
    css["--pf-anim-duration"] = `${Math.min(5000, Math.max(50, style.animationDuration))}ms`;
  }

  // Background — solid color and/or image (image layers on top).
  if (style.bgColorToken) {
    css.backgroundColor = colorTokenToVar(style.bgColorToken) ?? "";
  }
  if (style.bgImagePublicId) {
    const url = bgImageUrl(style.bgImagePublicId);
    if (url) {
      css.backgroundImage = `url(${url})`;
      css.backgroundSize = "cover";
      css.backgroundPosition = "center";
    }
  }

  // Typography — applied section-wide; cascades to all text inside the block.
  // Prefer the single-family `fontFamily`; fall back to the legacy `fontPair`.
  const family = fontFamilyValue(style.fontFamily);
  if (family) {
    css["--pf-font-heading"] = family;
    css["--pf-font-body"] = family;
    css.fontFamily = family;
  } else if (style.fontPair) {
    const fonts = FONT_PAIR_MAP[style.fontPair];
    if (fonts) {
      css["--pf-font-heading"] = fonts.heading;
      css["--pf-font-body"] = fonts.body;
      css.fontFamily = fonts.body;
    }
  }
  if (style.fontSize !== undefined) {
    css.fontSize = `${clamp(style.fontSize, STYLE_LIMITS.fontSize.min, STYLE_LIMITS.fontSize.max)}px`;
  }
  if (style.textColorToken) {
    css.color = colorTokenToVar(style.textColorToken) ?? "";
  }
  if (style.bold) css.fontWeight = 700;
  if (style.italic) css.fontStyle = "italic";
  if (style.underline) css.textDecoration = "underline";
  if (style.align) css.textAlign = style.align;

  return css as React.CSSProperties;
}

/**
 * Data attributes driving the entrance + hover animations. Spread onto a block's
 * root element alongside `resolveBlockStyle`. The actual keyframes/transitions
 * live in the global motion stylesheet; an IntersectionObserver adds the
 * `pf-in-view` class to `[data-anim]` elements when they scroll into view.
 */
export function resolveBlockAttrs(style?: BlockStyle | null): { "data-anim"?: AnimationType; "data-hover"?: HoverEffect } {
  if (!style) return {};
  const attrs: { "data-anim"?: AnimationType; "data-hover"?: HoverEffect } = {};
  if (style.animation && style.animation !== "none") attrs["data-anim"] = style.animation;
  if (style.hover && style.hover !== "none") attrs["data-hover"] = style.hover;
  return attrs;
}
