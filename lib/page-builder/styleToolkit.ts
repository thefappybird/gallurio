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
import { FONT_PAIR_MAP } from "./resolveBrandKit";
import type { BrandKitFontPair } from "./types";
import { fontFamilyValue, type PortfolioFontKey } from "./fonts";

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

export type BlockStyle = {
  // Border + frame
  borderWidth?: number; // px
  borderColorToken?: StyleColorToken;
  radius?: number; // px
  shadow?: ShadowSize;
  // Spacing
  paddingY?: number; // px
  paddingX?: number; // px
  marginY?: number; // px
  // Background
  bgColorToken?: StyleColorToken;
  bgImagePublicId?: string;
  // Typography (applied SECTION-WIDE — to the whole block via resolveBlockStyle)
  fontPair?: BrandKitFontPair; // legacy; kept for back-compat reads
  fontFamily?: PortfolioFontKey;
  fontSize?: number; // px
  textColorToken?: StyleColorToken;
  highlightColorToken?: StyleColorToken;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
};

export const DEFAULT_BLOCK_STYLE: BlockStyle = {};

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

export function colorTokenToVar(token: StyleColorToken | undefined): string | undefined {
  return token ? TOKEN_VAR[token] : undefined;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

// Build a Cloudinary delivery URL from a public id using the PUBLIC cloud name,
// so this stays client-safe (no server Cloudinary SDK import). Returns null when
// the cloud name isn't configured (e.g. in tests).
function bgImageUrl(publicId: string): string | null {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_1600,q_auto,f_auto/${publicId}`;
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

  // Background — solid color and/or image (image layers on top).
  if (style.bgColorToken) {
    css.backgroundColor = TOKEN_VAR[style.bgColorToken];
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
    css.color = TOKEN_VAR[style.textColorToken];
  }
  // Highlight fills the block surface with the chosen token — applied after the
  // background so an explicit highlight wins when both are set.
  if (style.highlightColorToken) {
    css.backgroundColor = TOKEN_VAR[style.highlightColorToken];
  }
  if (style.bold) css.fontWeight = 700;
  if (style.italic) css.fontStyle = "italic";
  if (style.underline) css.textDecoration = "underline";
  if (style.align) css.textAlign = style.align;

  return css as React.CSSProperties;
}
