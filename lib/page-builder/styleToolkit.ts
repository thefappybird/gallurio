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
import type { BrandKitFontPair, BlockButtonStyle } from "./types";
import { fontFamilyValue, type PortfolioFontSelection } from "./fonts";
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

/** A physical border edge a block can render. */
export type BorderSide = "top" | "right" | "bottom" | "left";

/**
 * Legacy, single-choice border setting. Keep reading it so existing local drafts
 * retain their appearance; new edits write `borderSides` instead.
 */
export type BorderPreset = "all" | BorderSide;

/** Gallery-specific column counts — stored in `_style.galleryColumns` (not a top-level prop). */
export const GALLERY_COLUMN_OPTIONS = [2, 3, 4] as const;
export type GalleryColumns = (typeof GALLERY_COLUMN_OPTIONS)[number];

/** Gallery image spacing tokens — stored in `_style.galleryGap` (not a top-level prop). */
export const GALLERY_GAP_OPTIONS = ["tight", "normal", "loose"] as const;
export type GalleryGap = (typeof GALLERY_GAP_OPTIONS)[number];

/** Optional automatic tile-height rhythm for editable Masonry image slots. */
export const MASONRY_HEIGHT_PATTERNS = ["none", "alternating"] as const;
export type MasonryHeightPattern = (typeof MASONRY_HEIGHT_PATTERNS)[number];

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
  /** Selected border edges. Undefined preserves the legacy full-frame border. */
  borderSides?: BorderSide[];
  /** @deprecated Replaced by the independently-toggleable `borderSides`. */
  borderPreset?: BorderPreset;
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
  /** Image content fit inside its block box. Used by navigation logos to avoid
   * cropping wide marks; ordinary Image blocks keep the legacy cover default. */
  imageFit?: "cover" | "contain";
  // Grid placement when the block is a child of a Columns/grid container
  colSpan?: number;
  rowSpan?: number;
  // Flex container layout — for Container/Flex/preset sections
  flexDirection?: "row" | "column";
  /** Horizontal arrangement of a Container's child stack. New writes only. */
  contentHorizontalAlign?: "start" | "center" | "end" | "stretch";
  /** Vertical distribution of a Container's real children. New writes only. */
  contentVerticalDistribution?: "start" | "center" | "end" | "between" | "around";
  /** Inline-axis placement of this block inside a Columns grid cell. New writes only. */
  cellHorizontalAlign?: "stretch" | "start" | "center" | "end";
  /** Block-axis placement of this block inside a Columns grid cell. New writes only. */
  cellVerticalAlign?: "stretch" | "start" | "center" | "end";
  // Legacy overloaded layout fields. Preserve them as read fallbacks only; new
  // controls use the explicit content and cell fields above.
  alignItems?: "start" | "center" | "end" | "stretch";
  justifyContent?: "start" | "center" | "end" | "between" | "around";
  gap?: number; // px, gap between children (0–96)
  // Background
  bgColorToken?: StyleColorToken | string;
  bgImagePublicId?: string;
  // Opacity (0-100) of the background-image layer only — content/text stays full
  // opacity. Applied by the consuming block (Container/Image) via a dedicated
  // layered div, not resolveBlockStyle (see manualBlocks.tsx). Unset = 100.
  bgImageOpacity?: number;
  // Typography (applied SECTION-WIDE — to the whole block via resolveBlockStyle)
  fontPair?: BrandKitFontPair; // legacy; kept for back-compat reads
  fontFamily?: PortfolioFontSelection;
  fontSize?: number; // px
  textColorToken?: StyleColorToken | string;
  // Button fill color (Button block only) — applied by ButtonBlock to the <a>.
  buttonColorToken?: StyleColorToken | string;
  // Button fill opacity 0-100 (Button block only). Unset = effective 100. Applied via
  // buildColorWithOpacity so it composes with each style variant (see manualBlocks.tsx).
  buttonOpacity?: number;
  // Button visual style (solid/outline/soft) — overrides brand-kit default for this button.
  buttonStyle?: BlockButtonStyle;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
  // Text highlight (marker band) — Heading and Text blocks only.
  highlight?: boolean;
  highlightToken?: StyleColorToken | string;
  highlightShape?: HighlightShape;
  highlightSize?: HighlightSize;
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
  headingFontFamily?: PortfolioFontSelection;
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
  descriptionFontFamily?: PortfolioFontSelection;
  descriptionFontSize?: number; // px
  descriptionHighlight?: boolean;
  descriptionHighlightToken?: StyleColorToken | string;
  descriptionHighlightShape?: HighlightShape;
  descriptionHighlightSize?: HighlightSize;
  // Gallery layout — stored here instead of top-level props so columns/gap are
  // style-drawer overrides (Layout tab → Gallery section) rather than Puck
  // sidebar select fields. Dedicated keys avoid clashing with the numeric `gap`
  // used by flex/grid containers.
  galleryColumns?: GalleryColumns; // 2 | 3 | 4; effective default 3
  galleryGap?: GalleryGap; // "tight" | "normal" | "loose"; effective default "normal"
  masonryHeightPattern?: MasonryHeightPattern;
  /** Odd-column tile sequence. Kept on the original keys for saved-style compatibility. */
  masonryOddHeight?: number;
  masonryEvenHeight?: number;
  /** Even-column tile sequence; defaults to the inverse of the odd columns. */
  masonryEvenColumnOddHeight?: number;
  masonryEvenColumnEvenHeight?: number;
  /** @deprecated GalleryMasonry now always uses independent CSS columns. Existing values are ignored. */
  galleryStagger?: boolean;
  // CollectionCard â€” independent caption typography. The card shell still uses
  // the shared frame/background controls above; these target its two visible
  // text nodes rather than applying an opaque, section-wide typography style.
  collectionTitleBold?: boolean;
  collectionTitleItalic?: boolean;
  collectionTitleUnderline?: boolean;
  collectionTitleAlign?: TextAlign;
  collectionTitleFontFamily?: PortfolioFontSelection;
  collectionTitleFontSize?: number;
  collectionTitleColorToken?: StyleColorToken | string;
  collectionSubtitleBold?: boolean;
  collectionSubtitleItalic?: boolean;
  collectionSubtitleUnderline?: boolean;
  collectionSubtitleAlign?: TextAlign;
  collectionSubtitleFontFamily?: PortfolioFontSelection;
  collectionSubtitleFontSize?: number;
  collectionSubtitleColorToken?: StyleColorToken | string;
  // Motion
  animation?: AnimationType; // entrance (plays when scrolled into view)
  animationDuration?: number; // ms
  hover?: HoverEffect;
  // ContactDetails — per-target typography (label = the uppercase row header; value = the row value)
  labelBold?: boolean;
  labelItalic?: boolean;
  labelUnderline?: boolean;
  labelAlign?: TextAlign;
  labelFontFamily?: PortfolioFontSelection;
  labelFontSize?: number; // px
  labelColorToken?: StyleColorToken | string;
  valueBold?: boolean;
  valueItalic?: boolean;
  valueUnderline?: boolean;
  valueAlign?: TextAlign;
  valueFontFamily?: PortfolioFontSelection;
  valueFontSize?: number; // px
  valueColorToken?: StyleColorToken | string;
  // ContactDetails — social icon controls
  iconSize?: number; // px (default 20)
  iconColorToken?: StyleColorToken | string;
  /** Icon-row alignment, independent of valueAlign. Unset -> falls back to
   *  valueAlign, then center. See buildContactIconAlign. */
  contactIconAlign?: TextAlign;
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
 * Mix a CSS color with transparency at the given opacity (0–100).
 * Opacity >= 100 returns the color unchanged (no extra CSS overhead).
 * Used by ButtonBlock for buttonOpacity. PortfolioHeader has a local copy
 * that should be consolidated here when next touched.
 */
export function buildColorWithOpacity(color: string, opacity: number): string {
  if (opacity >= 100) return color;
  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`;
}

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
  masonryPatternHeight: { min: 80, max: 1200 },
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

export function bgImageUrl(assetId: string): string | null {
  const url = imageDeliveryUrl(assetId, { width: 1600, fit: "cover" });
  return url || null;
}

/**
 * Resolve a BlockStyle into inline CSS. Merge the result over a block's own base
 * styles (toolkit wins). Custom properties (`--pf-font-*`) are included so font
 * choice cascades to both headings and body inside the block.
 */
export function resolveBlockStyle(style?: BlockStyle | null): React.CSSProperties {
  // Use a loose record so we can set CSS custom properties, then cast once.
  // Framed blocks advertise the brand radius as their effective unset value, so
  // ground that value here instead of inheriting the browser's 0px default.
  const css: Record<string, string | number> = {
    borderRadius: "var(--pf-radius)",
  };
  if (!style) return css as React.CSSProperties;

  // Border
  if (style.borderWidth && style.borderWidth > 0) {
    const w = clamp(style.borderWidth, STYLE_LIMITS.borderWidth.min, STYLE_LIMITS.borderWidth.max);
    css.borderStyle = "solid";
    css.borderColor = colorTokenToVar(style.borderColorToken) ?? "var(--pf-color-fg)";
    const sides: BorderSide[] = style.borderSides ?? (
      style.borderPreset && style.borderPreset !== "all"
        ? [style.borderPreset]
        : ["top", "right", "bottom", "left"]
    );
    if (sides.length === 4) {
      css.borderWidth = `${w}px`;
    } else {
      // Set every edge to zero first so changing from a full border has an
      // immediate, visible result on precisely the selected sides.
      css.borderWidth = "0px";
      const sideWidth: Record<BorderSide, string> = {
        top: "borderTopWidth",
        right: "borderRightWidth",
        bottom: "borderBottomWidth",
        left: "borderLeftWidth",
      };
      for (const side of sides) css[sideWidth[side]] = `${w}px`;
    }
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
  // Additionally, alignSelf is emitted so the block positions itself within its
  // grid cell when nested inside a Columns block (harmless in normal flow).
  if (style.alignItems) {
    const ta: Record<string, string | undefined> = {
      start: "left", center: "center", end: "right", stretch: undefined,
    };
    const v = ta[style.alignItems];
    if (v) css.textAlign = v;
    css.alignSelf = style.alignItems;
  }

  // justifyContent -> justifySelf for grid cell inline-axis placement. Flex-only
  // values (between/around) have no CSS grid equivalent, so they are skipped.
  if (style.justifyContent) {
    const jsSelf: Record<string, string | undefined> = {
      start: "start", center: "center", end: "end",
      between: undefined, around: undefined,
    };
    const js = jsSelf[style.justifyContent];
    if (js) css.justifySelf = js;
  }

  // Explicit grid-cell placement. These deliberately layer after the legacy
  // overloaded fields above so new data wins while old drafts retain their
  // established rendering until a user changes the new controls.
  if (style.cellVerticalAlign) css.alignSelf = style.cellVerticalAlign;
  if (style.cellHorizontalAlign) css.justifySelf = style.cellHorizontalAlign;

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
    const color = colorTokenToVar(style.textColorToken) ?? "";
    css.color = color;
    // A section-level text choice must reach nested Heading/Text blocks. Those
    // blocks read this inherited token while retaining theme foreground as the
    // fallback when no parent override exists.
    css["--pf-block-text-color"] = color;
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

/** Styles the two text nodes rendered inside a CollectionCard's clickable tile.
 * They intentionally use dedicated fields: the normal block typography applies
 * to the card shell, while title and photo-count need independent overrides. */
export function buildCollectionCardCaptionStyle(
  style: BlockStyle | null | undefined,
  target: "title" | "subtitle",
): React.CSSProperties {
  const title = target === "title";
  const base: React.CSSProperties = title
    ? {
        margin: 0,
        fontSize: "1rem",
        fontWeight: 600,
        lineHeight: 1.3,
        color: "var(--pf-color-fg)",
      }
    : {
        margin: "0.25rem 0 0",
        fontSize: "0.875rem",
        lineHeight: 1.4,
        color: "color-mix(in srgb, var(--pf-color-fg) 70%, transparent)",
        opacity: 0.75,
      };
  if (!style) return base;

  const fontFamily = title ? style.collectionTitleFontFamily : style.collectionSubtitleFontFamily;
  const fontSize = title ? style.collectionTitleFontSize : style.collectionSubtitleFontSize;
  const colorToken = title ? style.collectionTitleColorToken : style.collectionSubtitleColorToken;
  const bold = title ? style.collectionTitleBold : style.collectionSubtitleBold;
  const italic = title ? style.collectionTitleItalic : style.collectionSubtitleItalic;
  const underline = title ? style.collectionTitleUnderline : style.collectionSubtitleUnderline;
  const align = title ? style.collectionTitleAlign : style.collectionSubtitleAlign;
  const overrides: React.CSSProperties = {};

  const resolvedFamily = fontFamilyValue(fontFamily);
  if (resolvedFamily) overrides.fontFamily = resolvedFamily;
  if (fontSize !== undefined) {
    overrides.fontSize = `${clamp(fontSize, STYLE_LIMITS.fontSize.min, STYLE_LIMITS.fontSize.max)}px`;
  }
  if (colorToken) overrides.color = colorTokenToVar(colorToken) ?? undefined;
  if (bold) overrides.fontWeight = 700;
  if (italic) overrides.fontStyle = "italic";
  if (underline) overrides.textDecoration = "underline";
  if (align) overrides.textAlign = align;

  return { ...base, ...overrides };
}

/**
 * Build the CSSProperties for a ContactDetails label (`<dt>`).
 * Applies sensible defaults (uppercase, muted) then layers the label* BlockStyle props on top.
 */
export function buildContactLabelStyle(style?: BlockStyle | null): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: "0.6875rem",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--pf-color-fg)",
    opacity: 0.45,
  };
  if (!style) return base;
  const overrides: React.CSSProperties = {};
  if (style.labelFontFamily) {
    const f = fontFamilyValue(style.labelFontFamily);
    if (f) overrides.fontFamily = f;
  }
  if (style.labelFontSize !== undefined) {
    overrides.fontSize = `${clamp(style.labelFontSize, STYLE_LIMITS.fontSize.min, STYLE_LIMITS.fontSize.max)}px`;
  }
  if (style.labelColorToken) {
    const c = colorTokenToVar(style.labelColorToken);
    if (c) { overrides.color = c; overrides.opacity = 1; }
  }
  if (style.labelBold) overrides.fontWeight = 700;
  if (style.labelItalic) overrides.fontStyle = "italic";
  if (style.labelUnderline) overrides.textDecoration = "underline";
  if (style.labelAlign) overrides.textAlign = style.labelAlign;
  return { ...base, ...overrides };
}

/**
 * Build the CSSProperties for a ContactDetails value (`<dd>`).
 * Default color is foreground so contact copy stays readable on every theme surface.
 * The value* BlockStyle props layer on top to override.
 */
export function buildContactValueStyle(style?: BlockStyle | null): React.CSSProperties {
  const base: React.CSSProperties = {
    margin: 0,
    fontSize: "0.9375rem",
    color: "var(--pf-color-fg)",
  };
  if (!style) return base;
  const overrides: React.CSSProperties = {};
  if (style.valueFontFamily) {
    const f = fontFamilyValue(style.valueFontFamily);
    if (f) overrides.fontFamily = f;
  }
  if (style.valueFontSize !== undefined) {
    overrides.fontSize = `${clamp(style.valueFontSize, STYLE_LIMITS.fontSize.min, STYLE_LIMITS.fontSize.max)}px`;
  }
  if (style.valueColorToken) {
    const c = colorTokenToVar(style.valueColorToken);
    if (c) overrides.color = c;
  }
  if (style.valueBold) overrides.fontWeight = 700;
  if (style.valueItalic) overrides.fontStyle = "italic";
  if (style.valueUnderline) overrides.textDecoration = "underline";
  if (style.valueAlign) overrides.textAlign = style.valueAlign;
  return { ...base, ...overrides };
}

/**
 * Resolve the CSS color for social icons in a ContactDetails block.
 * Default: foreground. Overridden by `_style.iconColorToken`.
 */
export function buildContactIconColor(style?: BlockStyle | null): string {
  if (style?.iconColorToken) {
    return colorTokenToVar(style.iconColorToken) ?? "var(--pf-color-fg)";
  }
  return "var(--pf-color-fg)";
}

/**
 * Resolve the flex `justify-content` for a ContactDetails social-icon row.
 * Prefers the explicit `contactIconAlign`; falls back to `valueAlign` (the
 * icon row used to follow the value/text alignment, so unset stays put on
 * saved pages) and defaults to center when both are unset.
 */
export function buildContactIconAlign(style?: BlockStyle | null): "flex-start" | "center" | "flex-end" {
  const align = style?.contactIconAlign ?? style?.valueAlign;
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

/** Resolve the pixel size for ContactDetails social icons. Default 20px. */
export function buildContactIconSize(style?: BlockStyle | null): number {
  if (style?.iconSize && Number.isFinite(style.iconSize)) {
    return Math.min(64, Math.max(12, Math.floor(style.iconSize)));
  }
  return 20;
}

/** Build the CSS `grid-template-columns` string for a ContactDetails grid. */
export function contactGridTemplate(columns: number | undefined): string {
  const n = columns && Number.isFinite(columns) && columns >= 1 ? Math.min(2, Math.floor(columns)) : 1;
  return `repeat(${n}, minmax(0, 1fr))`;
}

/** The text-color token a Button actually renders when textColorToken is unset.
 *  Every variant uses the universal foreground so labels remain readable over
 *  every built-in surface. Display-only. */
export function effectiveButtonTextToken(
  _style: BlockStyle | undefined,
): StyleColorToken | string {
  void _style;
  return "foreground";
}
