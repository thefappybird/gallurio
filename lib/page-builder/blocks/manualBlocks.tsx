/**
 * Manual ("barebones") portfolio blocks — the building-block primitives an owner
 * can drag in to compose any layout: Heading, Text, Image, Button, Spacer,
 * Divider, plus Columns and Container drop-zones (Puck `slot` fields) that nest
 * other blocks.
 *
 * These are ISOMORPHIC: pure, client-safe components (no server-only imports)
 * so the SAME component renders in the editor canvas AND the public page. The
 * editor wires RichTextField/StyleToolkit fields in editorConfig.tsx; this file
 * holds the components + the production configs registered in config.ts.
 *
 * All branding via `--pf-*` CSS variables. No `rounded-*` Tailwind classes.
 */

import { isValidElement, type ReactNode } from "react";
import type { ComponentConfig, Field, Slot, SlotComponent } from "@measured/puck";
import type { BlockPuck } from "@/lib/page-builder/serverContext";
import { portfolioGalleryPath } from "@/lib/portfolio/publicUrl";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  asText,
  colorTokenToVar,
  buildColorWithOpacity,
  productionStyleField,
  FLEX_JUSTIFY_MAP,
  type BlockStyle,
  type HighlightShape,
  type HighlightSize,
} from "@/lib/page-builder/styleToolkit";

// Highlight (marker band) appearance — mirrors GalleryText.tsx so all blocks
// use the same visual output without a shared import cycle.
const HL_RADIUS: Record<HighlightShape, string> = {
  sharp: "0",
  subtle: "0.15em",
  rounded: "0.6em",
};

const HL_PADDING: Record<HighlightSize, string> = {
  sm: "0.05em 0.2em",
  md: "0.1em 0.3em",
  lg: "0.2em 0.45em",
};

function highlightBandStyle(
  token: BlockStyle["highlightToken"],
  shape: HighlightShape | undefined,
  size: HighlightSize | undefined
): React.CSSProperties {
  return {
    background: colorTokenToVar(token) ?? "var(--pf-color-accent)",
    color: "inherit",
    padding: HL_PADDING[size ?? "md"],
    borderRadius: HL_RADIUS[shape ?? "subtle"],
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  };
}
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { ContainerBackgroundSlideshow } from "./ContainerBackgroundSlideshow";
import type { GalleryImage } from "./GalleryGridBlock";

// Returns null when imageId is missing or env is unset, so existing `url(...) || imageUrl` fallbacks still work.
function cfImageUrl(publicId: string, w = 1200): string | null {
  return imageDeliveryUrl(publicId, { width: w, height: w * 4, fit: "scale-down" }) || null;
}

function gallerySlugFrom(puck?: BlockPuck | null): string | undefined {
  return puck?.metadata?.workspace?.slug;
}

// Puck's contentEditable transform swaps a text-prop string for an editable React
// element on the canvas. Render that element directly; otherwise coerce via asText
// (which also tolerates legacy `{ text }` objects from old drafts).
function inlineText(value: unknown): ReactNode {
  return isValidElement(value) ? value : asText(value);
}

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

export type HeadingBlockProps = {
  _style?: BlockStyle;
  text: string;
  level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
};

export const headingDefaultProps: HeadingBlockProps = { text: "Heading", level: "h2" };

/** Fluid clamp font sizes for headings. `cqi` resolves against the `pfpage` container. */
const HEADING_SIZE: Record<HeadingBlockProps["level"], string> = {
  h1: "clamp(2rem, 1.4rem + 4cqi, 3rem)",
  h2: "clamp(1.6rem, 1.2rem + 2.5cqi, 2.25rem)",
  h3: "clamp(1.3rem, 1rem + 1.8cqi, 1.75rem)",
  h4: "clamp(1.1rem, 0.95rem + 1cqi, 1.35rem)",
  h5: "clamp(1rem, 0.9rem + 0.6cqi, 1.125rem)",
  h6: "clamp(0.8rem, 0.75rem + 0.3cqi, 0.875rem)",
};

export function HeadingBlock({ _style, text, level, puck }: HeadingBlockProps & { puck?: BlockPuck }) {
  const textContent = inlineText(text);
  const Tag = level;
  const hl = _style?.highlight;
  return (
    <div
      ref={puck?.dragRef ?? undefined}
      style={{
        fontFamily: "var(--pf-font-body)",
        color:
          colorTokenToVar(_style?.textColorToken) ??
          "var(--pf-block-text-color, var(--pf-color-fg))",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      <Tag
        style={{
          fontFamily: "var(--pf-font-heading)",
          fontSize: HEADING_SIZE[level],
          fontWeight: 700,
          lineHeight: 1.2,
          color: "inherit",
          margin: 0,
        }}
      >
        {hl ? (
          <mark style={highlightBandStyle(_style?.highlightToken, _style?.highlightShape, _style?.highlightSize)}>
            {textContent}
          </mark>
        ) : (
          textContent
        )}
      </Tag>
    </div>
  );
}

export const headingBlockConfig: ComponentConfig<HeadingBlockProps> = {
  label: "Heading",
  inline: true,
  defaultProps: headingDefaultProps,
  fields: {
    _style: productionStyleField,
    text: { type: "text", label: "Heading text" },
    level: {
      type: "select",
      label: "Level",
      options: [
        { label: "Display", value: "h1" },
        { label: "Title", value: "h2" },
        { label: "Heading", value: "h3" },
        { label: "Subheading", value: "h4" },
        { label: "Caption", value: "h5" },
        { label: "Label", value: "h6" },
      ],
    },
  },
  render: HeadingBlock,
};

// ---------------------------------------------------------------------------
// Text / paragraph
// ---------------------------------------------------------------------------

export type TextBlockProps = { _style?: BlockStyle; text: string };

export const textDefaultProps: TextBlockProps = {
  text: "Write anything here. Line breaks are preserved.",
};

export function TextBlock({ _style, text, puck }: TextBlockProps & { puck?: BlockPuck }) {
  const textContent = inlineText(text);
  const hl = _style?.highlight;
  return (
    <div
      ref={puck?.dragRef ?? undefined}
      style={{
        fontFamily: "var(--pf-font-body)",
        color:
          colorTokenToVar(_style?.textColorToken) ??
          "var(--pf-block-text-color, var(--pf-color-fg))",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      <p style={{ fontSize: "inherit", lineHeight: 1.7, color: "inherit", margin: 0, whiteSpace: "pre-line" }}>
        {hl ? (
          <mark style={highlightBandStyle(_style?.highlightToken, _style?.highlightShape, _style?.highlightSize)}>
            {textContent}
          </mark>
        ) : (
          textContent
        )}
      </p>
    </div>
  );
}

export const textBlockConfig: ComponentConfig<TextBlockProps> = {
  label: "Text",
  inline: true,
  defaultProps: textDefaultProps,
  fields: {
    _style: productionStyleField,
    text: { type: "textarea", label: "Text" },
  },
  render: TextBlock,
};

// ---------------------------------------------------------------------------
// Image — a resizable container with a BACKGROUND image (not an <img>
// element). Modeled on Container: the picked image lives in `_style.bgImagePublicId`
// and is resolved to CSS via resolveBlockStyle (same mechanism Container/Gallery
// blocks use), explicit width/height + colSpan/rowSpan come from the Layout tab,
// and bgImageOpacity (F4) fades only the image layer, never the placeholder.
// ---------------------------------------------------------------------------

export type ImageBlockProps = {
  _style?: BlockStyle;
  alt: string;
};

// Back-compat only: the pre-redesign Image block (before commit ee5084d)
// stored the picture as these top-level props instead of `_style.bgImagePublicId`.
// Not part of the current schema/fields — read defensively in render so
// already-saved data (DB `publicPage.data`, a `PortfolioDraft`, or a stale
// browser localStorage draft) keeps showing its image after the redesign.
type LegacyImageBlockProps = {
  imagePublicId?: string;
  imageUrl?: string;
};

export const imageDefaultProps: ImageBlockProps = { alt: "" };

export function ImageBlock({
  _style,
  alt,
  puck,
  imagePublicId,
  imageUrl,
}: ImageBlockProps & LegacyImageBlockProps & { puck?: BlockPuck }) {
  // Migrate a legacy Cloudflare asset id into the shape resolveBlockStyle
  // understands, so it resolves through the exact same bgImageUrl() path a
  // freshly-migrated `_style.bgImagePublicId` would. Only applies when the
  // new field wasn't already set (never overwrite a real pick).
  const legacyAssetId = !_style?.bgImagePublicId && imagePublicId ? imagePublicId : undefined;
  const effectiveStyle = legacyAssetId ? { ..._style, bgImagePublicId: legacyAssetId } : _style;

  const opacity = Math.min(100, Math.max(0, effectiveStyle?.bgImageOpacity ?? 100)) / 100;
  const resolved = resolveBlockStyle(effectiveStyle) as Record<string, string | number | undefined>;
  // Legacy raw-URL fallback (no Cloudflare asset id) — resolveBlockStyle's
  // bgImagePublicId always resolves through the CF delivery URL builder, so a
  // bare external URL can't go through it. Apply it directly, same as the
  // pre-redesign `<img src>` fallback (`imagePublicId ? cfImageUrl(...) : imageUrl`).
  if (!resolved.backgroundImage && !legacyAssetId && imageUrl) {
    resolved.backgroundImage = `url(${imageUrl})`;
    resolved.backgroundSize = "cover";
    resolved.backgroundPosition = "center";
  }
  // backgroundImage/backgroundSize/backgroundPosition come from resolveBlockStyle's
  // existing bgImagePublicId handling (styleToolkit.ts) but land on a dedicated
  // layer div (below), not the root, so bgImageOpacity can fade just the image —
  // never the placeholder or the block's frame (border/shadow/radius).
  const { backgroundImage, backgroundSize, backgroundPosition, ...rootStyle } = resolved;
  // Depend on whether resolveBlockStyle actually resolved a URL (not just whether
  // bgImagePublicId is set) — a publicId that fails to resolve (e.g. no cloud name
  // configured) must fall through to the placeholder, same as Container's banner.
  const hasImage = Boolean(backgroundImage);
  const a11yProps = hasImage
    ? alt
      ? { role: "img" as const, "aria-label": alt }
      : { "aria-hidden": "true" as const }
    : {};

  return (
    <div
      ref={puck?.dragRef ?? undefined}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        aspectRatio: effectiveStyle?.height ? undefined : "3 / 2",
        ...rootStyle,
      }}
      {...a11yProps}
      {...resolveBlockAttrs(effectiveStyle)}
    >
      {hasImage ? (
        <div
          data-bg-opacity-layer
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: backgroundImage as string | undefined,
            backgroundSize: backgroundSize as string | undefined,
            backgroundPosition: backgroundPosition as string | undefined,
            opacity,
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid color-mix(in srgb, var(--pf-color-fg) 15%, transparent)",
            color: "var(--pf-color-fg)",
            opacity: 0.45,
            fontFamily: "var(--pf-font-body)",
            fontSize: "0.875rem",
          }}
        >
          Pick an image
        </div>
      )}
    </div>
  );
}

export const imageBlockConfig: ComponentConfig<ImageBlockProps> = {
  label: "Image",
  inline: true,
  defaultProps: imageDefaultProps,
  fields: {
    _style: productionStyleField,
    alt: { type: "text", label: "Alt text" },
  },
  render: ImageBlock,
};

// Maps the legacy `align` prop to margin-auto values for ButtonBlock wrapper.
const BUTTON_ALIGN_TO_MARGIN: Record<string, { marginLeft: string; marginRight: string }> = {
  left:   { marginLeft: "0",    marginRight: "auto" },
  center: { marginLeft: "auto", marginRight: "auto" },
  right:  { marginLeft: "auto", marginRight: "0"    },
};

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

export const BUTTON_SIZE_FONT_PX: Record<"sm" | "md" | "lg", number> = {
  sm: 13,
  md: 15,
  lg: 18,
};

const BUTTON_SIZE_STYLES = {
  sm: { padding: "0 1rem", minHeight: "2rem", minWidth: "6rem", fontSize: `${BUTTON_SIZE_FONT_PX.sm / 16}rem` },
  md: { padding: "0 1.75rem", minHeight: "2.75rem", minWidth: "9rem", fontSize: `${BUTTON_SIZE_FONT_PX.md / 16}rem` },
  lg: { padding: "0 2.5rem", minHeight: "3.5rem", minWidth: "12rem", fontSize: `${BUTTON_SIZE_FONT_PX.lg / 16}rem` },
} as const;

export type ButtonBlockProps = {
  _style?: BlockStyle;
  label: string;
  action: "open-contact" | "go-to-gallery";
  align: "left" | "center" | "right";
  size?: "sm" | "md" | "lg";
};

export const buttonDefaultProps: ButtonBlockProps = {
  label: "Get in Touch",
  action: "open-contact",
  align: "center",
  size: "md",
};

export function ButtonBlock({ _style, label, action, align, size, puck }: ButtonBlockProps & { puck?: BlockPuck }) {
  const slug = gallerySlugFrom(puck);
  const href = action === "go-to-gallery" && slug ? portfolioGalleryPath(slug) : "#";
  const dataCta = action === "open-contact" ? "contact" : undefined;

  const tkBorderRadius = _style?.radius !== undefined ? `${_style.radius}px` : "var(--pf-radius)";
  const customTextColor = colorTokenToVar(_style?.textColorToken);
  const colorVar = colorTokenToVar(_style?.buttonColorToken) ?? "var(--pf-color-primary)";

  let buttonBg: string;
  let buttonText: string;
  let tkBorderWidth: string;
  let tkBorderColor: string;

  if (_style?.buttonStyle === "outline") {
    // Outline: transparent fill, always 2px border in the button color.
    // borderWidth/borderColorToken from _style are ignored (deprecated in Pass 2).
    buttonBg = "transparent";
    buttonText = customTextColor ?? colorVar;
    tkBorderWidth = "2px";
    tkBorderColor = colorVar;
  } else if (_style?.buttonStyle === "soft") {
    // Soft: tinted fill at 15%, no border. borderWidth/borderColorToken ignored (deprecated in Pass 2).
    buttonBg = `color-mix(in srgb, ${colorVar} 15%, transparent)`;
    buttonText = customTextColor ?? colorVar;
    tkBorderWidth = "0px";
    tkBorderColor = "transparent";
  } else if (_style?.buttonStyle === "solid") {
    // Opacity applies to the fill; 100 is a no-op (no color-mix overhead).
    // borderWidth/borderColorToken are ignored for named button styles (deprecated in Pass 2).
    buttonBg = buildColorWithOpacity(colorVar, _style?.buttonOpacity ?? 100);
    buttonText = customTextColor ?? "var(--pf-color-bg)";
    tkBorderWidth = "0px";
    tkBorderColor = "transparent";
  } else {
    // No explicit buttonStyle — legacy per-field behaviour.
    const hasColor = _style?.buttonColorToken !== undefined;
    buttonBg = hasColor ? (colorTokenToVar(_style!.buttonColorToken) ?? "transparent") : "transparent";
    buttonText = customTextColor ?? "var(--pf-color-fg)";
    tkBorderWidth = _style?.borderWidth !== undefined ? `${_style.borderWidth}px` : "2px";
    tkBorderColor = colorTokenToVar(_style?.borderColorToken) ?? (hasColor ? "transparent" : "var(--pf-color-fg)");
  }

  const legacyMargin = BUTTON_ALIGN_TO_MARGIN[align] ?? BUTTON_ALIGN_TO_MARGIN.left;

  // Resolve toolkit styles for margins and font family/size overrides.
  // Shadow and border-frame are intentionally NOT applied to buttons — they are
  // deprecated fields for the button variant (old data is simply ignored).
  const resolved = resolveBlockStyle(_style) as Record<string, string | number | undefined>;

  const wrapperStyle: React.CSSProperties = {
    width: "fit-content",
    ...legacyMargin,
  };
  if (resolved.marginLeft !== undefined) wrapperStyle.marginLeft = resolved.marginLeft as string;
  if (resolved.marginRight !== undefined) wrapperStyle.marginRight = resolved.marginRight as string;
  if (resolved.marginTop !== undefined) wrapperStyle.marginTop = resolved.marginTop as string;
  if (resolved.marginBottom !== undefined) wrapperStyle.marginBottom = resolved.marginBottom as string;

  const aStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...BUTTON_SIZE_STYLES[size ?? "md"],
    letterSpacing: "0.04em",
    cursor: "pointer",
    fontFamily: "var(--pf-font-body)",
    fontWeight: _style?.bold ? 700 : 600,
    fontStyle: _style?.italic ? "italic" : "normal",
    textDecoration: _style?.underline ? "underline" : "none",
    borderStyle: "solid",
    borderWidth: tkBorderWidth,
    borderColor: tkBorderColor,
    borderRadius: tkBorderRadius,
    backgroundColor: buttonBg,
    color: buttonText,
    // Shadow suppressed: button no longer reads _style.shadow (deprecated for buttons).
    ...(resolved.fontFamily && { fontFamily: resolved.fontFamily as string }),
    ...(resolved.fontSize && { fontSize: resolved.fontSize as string }),
  };

  return (
    <div ref={puck?.dragRef ?? undefined} style={wrapperStyle} {...resolveBlockAttrs(_style)}>
      <a href={href} role="button" data-cta={dataCta} style={aStyle}>
        {label}
      </a>
    </div>
  );
}

export const buttonBlockConfig: ComponentConfig<ButtonBlockProps> = {
  label: "Button",
  inline: true,
  defaultProps: buttonDefaultProps,
  fields: {
    _style: productionStyleField,
    label: { type: "text", label: "Button label" },
    action: {
      type: "select",
      label: "Action",
      options: [
        { label: "Open contact form", value: "open-contact" },
        { label: "Go to Gallery page", value: "go-to-gallery" },
      ],
    },
    align: {
      type: "select",
      label: "Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    size: {
      type: "select",
      label: "Size",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    } as Field<"sm" | "md" | "lg" | undefined>,
  },
  render: ButtonBlock,
};

// ---------------------------------------------------------------------------
// Spacer
// ---------------------------------------------------------------------------

export type SpacerBlockProps = { height: number };

export const spacerDefaultProps: SpacerBlockProps = { height: 48 };

export function SpacerBlock({ height, puck }: SpacerBlockProps & { puck?: BlockPuck }) {
  const h = Math.min(400, Math.max(4, Number.isFinite(height) ? height : 48));
  return <div ref={puck?.dragRef ?? undefined} aria-hidden="true" style={{ height: `${h}px` }} />;
}

export const spacerBlockConfig: ComponentConfig<SpacerBlockProps> = {
  label: "Spacer",
  inline: true,
  defaultProps: spacerDefaultProps,
  fields: {
    height: { type: "number", label: "Height (px)", min: 4, max: 400 } as Field<number>,
  },
  render: SpacerBlock,
};

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

export type DividerBlockProps = { _style?: BlockStyle; thickness: number };

export const dividerDefaultProps: DividerBlockProps = { thickness: 1 };

export function DividerBlock({ _style, thickness, puck }: DividerBlockProps & { puck?: BlockPuck }) {
  const t = Math.min(12, Math.max(1, Number.isFinite(thickness) ? thickness : 1));
  return (
    <div ref={puck?.dragRef ?? undefined} style={{ padding: "1rem 1.5rem", ...resolveBlockStyle(_style) }} {...resolveBlockAttrs(_style)}>
      <hr
        style={{
          border: 0,
          borderTopWidth: `${t}px`,
          borderTopStyle: "solid",
          borderTopColor: "color-mix(in srgb, var(--pf-color-fg) 20%, transparent)",
          margin: 0,
        }}
      />
    </div>
  );
}

export const dividerBlockConfig: ComponentConfig<DividerBlockProps> = {
  label: "Divider",
  inline: true,
  defaultProps: dividerDefaultProps,
  fields: {
    _style: productionStyleField,
    thickness: { type: "number", label: "Thickness (px)", min: 1, max: 12 } as Field<number>,
  },
  render: DividerBlock,
};

// ---------------------------------------------------------------------------
// Columns (slot container, laid out in a CSS grid)
// ---------------------------------------------------------------------------

export type ColumnsBlockProps = {
  /** Puck-injected unique block id — scopes per-instance CSS so multiple
   *  Columns blocks never share @container rules (prevents cross-contamination). */
  id?: string;
  _style?: BlockStyle;
  /** Column count 1–6. Accepts legacy 2|3 values — back-compat guaranteed. */
  columns: number;
  /** Explicit row count 1–6. When set to 2 or more, the grid defines that many
   *  rows so child `rowSpan` values are meaningful. Unset (or 1) keeps the
   *  current auto-row behaviour so existing layouts are unaffected. */
  rows?: number;
  /** CSS length minimum height for the grid outer wrapper, e.g. "200px" or "30%".
   *  Unset = no min-height constraint (content-sized). */
  minHeight?: string;
  /** Layout: "page-fit" (default) keeps max-width:80rem;margin:0 auto.
   *  "full" breaks out of any max-width parent via width:100vw + negative margin. */
  overallWidth?: "page-fit" | "full";
  content: Slot;
};

/** Effective padding constants for Columns — render fallback + control effectiveValue. */
export const COLUMNS_EFFECTIVE_PAD = {
  top: "1rem",
  right: "1.5rem",
  bottom: "1rem",
  left: "1.5rem",
} as const;

export const columnsDefaultProps: ColumnsBlockProps = {
  columns: 2,
  rows: undefined,
  overallWidth: "page-fit",
  content: [],
  _style: {
    gap: 16,
  },
};

export function ColumnsBlock({
  id,
  _style,
  columns,
  rows,
  minHeight,
  overallWidth,
  content: Content,
  puck,
}: {
  id?: string;
  _style?: BlockStyle;
  columns: number;
  rows?: number;
  minHeight?: string;
  overallWidth?: "page-fit" | "full";
  content: SlotComponent;
  puck?: BlockPuck;
}) {
  // Clamp columns to 1–6; accept legacy 2|3 values as-is.
  const cols = Math.min(6, Math.max(1, Math.floor(columns ?? 2)));
  // Tablet breakpoint shows min(2, cols) columns; desktop shows the full count.
  const tabletCols = Math.min(2, cols);
  const rowCount =
    rows !== undefined && Number.isFinite(rows)
      ? Math.min(6, Math.max(1, Math.floor(rows)))
      : undefined;
  const hasRows = rowCount !== undefined && rowCount > 1;
  // Whether we are inside the Puck editor canvas. Puck injects `isEditing: true`
  // into the puck prop during editing; it is false (or absent) during public render.
  const isEditing = puck?.isEditing === true;

  // Per-instance CSS scoping (A1 — items 3/4/6): each Columns block gets its own
  // containerName and CSS class so multiple instances on the same page are fully
  // isolated. The old shared containerName "pf-cols" caused ALL @container rules
  // to fire for ALL Columns elements simultaneously: a colSpan resize in one block
  // could retrigger every other block's container query, creating an oscillation
  // that culminated in a crash (4-col + col3 GalleryLanding spanning 2 tracks).
  // Unique names per-instance eliminate this cross-contamination entirely.
  //
  // Puck injects a unique `id` (e.g. "Columns-1a2b") into every block's top-level
  // props. We sanitize it to a valid CSS ident fragment (letters/digits/hyphens only)
  // and use it to namespace:
  //   - outer element's containerName  → pfcols-${instanceId}
  //   - inner grid's CSS class          → .pf-cols-${instanceId}
  //   - optional rows class             → .pf-cols-rows-${instanceId}
  // Falls back to "inst" when rendered outside Puck (unit tests).
  const instanceId = (id ? id.replace(/[^a-zA-Z0-9_-]/g, "") : "") || "inst";
  const instanceClass = `pf-cols-${instanceId}`;
  const instanceContainer = `pfcols-${instanceId}`;
  const instanceRowsClass = `pf-cols-rows-${instanceId}`;

  // Build per-instance scoped CSS rules for this column/row count.
  // Container queries (keyed off the block's own width via `container-type:inline-size`
  // on the outer div) are used instead of viewport min-width media queries. This is
  // critical for colSpan/rowSpan: a child can only span N tracks if the parent grid
  // actually defines N tracks.
  //
  // PUBLIC BREAKPOINTS (mobile-first design):
  //   480px → tablet (min(2,cols) tracks) — keeps 375px phones at 1 column (~327px container)
  //   720px → desktop (full cols tracks)
  //
  // The editor canvas is only ~428px wide (both panels open at 1280px viewport), so the
  // 480px breakpoint never fires there — which would make the editor always look 1-column.
  // Instead, when isEditing is true we inject direct inline gridTemplate* overrides so
  // the editor always shows the actual configured column and row counts without relying
  // on container-query breakpoints that could oscillate.
  const colsRule = cols === 1
    ? "" // 1-col: stays 1fr at all sizes (no extra rule needed)
    : `@container ${instanceContainer} (min-width:480px){.${instanceClass}{grid-template-columns:repeat(${tabletCols},minmax(0,1fr));}}` +
      (cols > 2
        ? `@container ${instanceContainer} (min-width:720px){.${instanceClass}{grid-template-columns:repeat(${cols},minmax(0,1fr));}}`
        : "");
  const rowsRule = hasRows
    ? `@container ${instanceContainer} (min-width:480px){.${instanceRowsClass}{grid-template-rows:repeat(${rowCount},minmax(0,auto));}}`
    : "";
  // Editor-only (A1/A3): inline override outranks @container class rules so the
  // canvas grid is driven purely by these values, not by breakpoint oscillation.
  const editorGridCols = isEditing && cols > 1
    ? `repeat(${cols},minmax(0,1fr))`
    : undefined;
  // Editor-only (A2): show the configured row count WYSIWYG in the narrow canvas.
  const editorGridRows = isEditing && hasRows
    ? `repeat(${rowCount},minmax(0,auto))`
    : undefined;
  // Gap is configurable via the Layout tab (_style.gap, px). Falls back to 1rem.
  const gapValue =
    _style?.gap != null ? `${Math.min(96, Math.max(0, Math.floor(_style.gap)))}px` : "1rem";
  // Don't let the resolved `gap` (meant for flex/grid children) leak onto the
  // outer wrapper — it's applied to the grid below.
  const outerStyle = resolveBlockStyle(_style);
  delete (outerStyle as Record<string, unknown>).gap;
  return (
    <div
      ref={puck?.dragRef ?? undefined}
      style={{
        paddingTop: _style?.paddingTop ?? COLUMNS_EFFECTIVE_PAD.top,
        paddingRight: _style?.paddingRight ?? COLUMNS_EFFECTIVE_PAD.right,
        paddingBottom: _style?.paddingBottom ?? COLUMNS_EFFECTIVE_PAD.bottom,
        paddingLeft: _style?.paddingLeft ?? COLUMNS_EFFECTIVE_PAD.left,
        minHeight: minHeight ?? undefined,
        ...outerStyle,
        // A7: full-bleed breaks out of any max-width parent container.
        // Placed after outerStyle so full-bleed width/marginLeft always wins.
        // Bug #9: cap to canvas width in editor so 100vw (= full viewport with
        // both Puck panels) does not overflow the narrow canvas (~428px). On the
        // public page the true 100vw full-bleed is kept intact.
        ...(overallWidth === "full"
          ? isEditing
            ? { width: "100%", marginLeft: 0 }
            : { width: "100vw", marginLeft: "calc(50% - 50vw)" }
          : {}),
        containerType: "inline-size",
        containerName: instanceContainer,
      }}
      {...resolveBlockAttrs(_style)}
    >
      {/* Per-instance scoped @container rules: each Columns block gets its own
          unique containerName and CSS class so multiple blocks on the same page
          are fully isolated. Container queries (not viewport media queries) are
          used so colSpan/rowSpan work correctly in the narrow editor canvas. */}
      <style>{`
        .${instanceClass}{display:grid;align-items:stretch;gap:${gapValue};${overallWidth === "full" ? "" : "max-width:80rem;margin:0 auto;"}grid-template-columns:1fr;}
        ${colsRule}
        ${rowsRule}
      `}</style>
      {Content({
        className: `${instanceClass}${hasRows ? ` ${instanceRowsClass}` : ""}`,
        // Editor: inline styles bypass container-query breakpoints so columns and
        // rows are WYSIWYG in the narrow (~428px) canvas. Inline > @container in
        // CSS specificity so these always take priority. Public: empty objects —
        // @container rules drive the responsive layout.
        style: {
          ...(editorGridCols ? { gridTemplateColumns: editorGridCols } : {}),
          ...(editorGridRows ? { gridTemplateRows: editorGridRows } : {}),
        },
      })}
    </div>
  );
}

export const columnsBlockConfig: ComponentConfig<ColumnsBlockProps> = {
  label: "Columns",
  inline: true,
  defaultProps: columnsDefaultProps,
  fields: {
    _style: productionStyleField,
    columns: {
      type: "number",
      label: "Columns",
      min: 1,
      max: 6,
    } as Field<number>,
    rows: { type: "number", label: "Rows", min: 1, max: 6 } as Field<number | undefined>,
    content: { type: "slot" },
  },
  render: ColumnsBlock,
};

// ---------------------------------------------------------------------------
// Container — a styleable SECTION drop-zone. Doubles as the wrapper for composed
// "preset" sections (Hero/About/CTA/…): full-bleed background image + overlay,
// min-height, and content alignment, with a slot that nests any other blocks.
// ---------------------------------------------------------------------------

export type ContainerHeight = "auto" | "short" | "medium" | "tall" | "custom";
export type ContainerAlignX = "left" | "center" | "right";
export type ContainerAlignY = "top" | "center" | "bottom";

export type ContainerBlockProps = {
  _style?: BlockStyle;
  /** Baked background images (reconciled like gallery blocks). 0 -> none, 1 -> static, 2+ -> slideshow. */
  backgroundImages?: GalleryImage[];
  bgAnimation?: "crossfade" | "kenburns" | "slide";
  bgSpeed?: "slow" | "medium" | "fast";
  /** Dark scrim over the background, 0-100. Only meaningful with >=1 image. */
  overlayOpacity?: number;
  minHeight?: ContainerHeight;
  /** CSS length value when minHeight === "custom", e.g. "200px" or "30%". */
  minHeightValue?: string;
  alignX?: ContainerAlignX;
  alignY?: ContainerAlignY;
  content: Slot;
};

/** Effective padding constants for Container — render fallback + control effectiveValue. */
export const CONTAINER_EFFECTIVE_PAD = {
  top: "1.5rem",
  right: "1.5rem",
  bottom: "1.5rem",
  left: "1.5rem",
} as const;

export const containerDefaultProps: ContainerBlockProps = {
  backgroundImages: [],
  bgAnimation: "crossfade",
  bgSpeed: "medium",
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  content: [],
};

const CONTAINER_MIN_HEIGHT: Record<Exclude<ContainerHeight, "custom">, string | undefined> = {
  auto: undefined,
  short: "40vh",
  medium: "60vh",
  tall: "80vh",
};
// Editor-only px heights per container size. The public page uses the vh values
// above; the editor uses fixed px so they can be fed to Puck's native
// `minEmptyHeight` (a px number). Driving the empty drop zone through Puck's own
// primitive — rather than a custom flexGrow — keeps Puck's internal empty-zone
// MODEL the same size as the VISIBLE area, so its selection / action-bar overlay
// (positioned off that model) reliably tracks an empty container the same way it
// does any other block. Never used on the public page (gated on puck.isEditing).
// "custom" falls back to 128 (auto) since the px value is unknown at schema time.
export const CONTAINER_EDITOR_HEIGHT_PX: Record<ContainerHeight, number> = {
  auto: 128,
  short: 320,
  medium: 480,
  tall: 640,
  custom: 128,
};
const ALIGN_Y_MAP: Record<ContainerAlignY, string> = { top: "flex-start", center: "center", bottom: "flex-end" };
// Maps _style.alignItems to CSS text-align for ContainerBlock inner content wrapper.
// "stretch" has no text-align equivalent; falls back to the legacy alignX (ax) value.
const ALIGN_TO_TEXT: Record<string, string | undefined> = {
  start: "left", center: "center", end: "right", stretch: undefined,
};

export function ContainerBlock({
  _style,
  backgroundImages,
  bgAnimation,
  bgSpeed,
  overlayOpacity,
  minHeight,
  minHeightValue,
  alignX,
  alignY,
  content: Content,
  puck,
}: {
  _style?: BlockStyle;
  backgroundImages?: GalleryImage[];
  bgAnimation?: "crossfade" | "kenburns" | "slide";
  bgSpeed?: "slow" | "medium" | "fast";
  overlayOpacity?: number;
  minHeight?: ContainerHeight;
  minHeightValue?: string;
  alignX?: ContainerAlignX;
  alignY?: ContainerAlignY;
  content: SlotComponent;
  puck?: BlockPuck;
}) {
  const ax = alignX ?? "left";
  const ay = alignY ?? "top";
  const s = _style ?? {};

  // Resolve baked background images -> cover-layer URLs (same transform as the
  // legacy single background). Drop any that don't resolve (blank publicId / no
  // cloud name) so a 3-image set with one bad id still animates the good two.
  const layers = (Array.isArray(backgroundImages) ? backgroundImages : [])
    .map((img) => ({ id: img.id, src: cfImageUrl(img.publicId, 2000) }))
    .filter((l): l is { id: string; src: string } => Boolean(l.src));
  const hasBg = layers.length > 0;
  const overlayAlpha = Math.min(100, Math.max(0, overlayOpacity ?? 0)) / 100;
  // F4: bgImageOpacity fades only the image layer (the wrapper div below), never
  // the dark scrim or the content slot — both render outside this wrapper.
  const bgImageAlpha = Math.min(100, Math.max(0, s.bgImageOpacity ?? 100)) / 100;

  // Vertical positioning of the content block within the section height.
  const effectiveJustify = s.justifyContent
    ? FLEX_JUSTIFY_MAP[s.justifyContent as keyof typeof FLEX_JUSTIFY_MAP] ?? ALIGN_Y_MAP[ay]
    : ALIGN_Y_MAP[ay];

  // Horizontal TEXT alignment inside child blocks. Children always stretch to full
  // width so that text-align, button justify, etc. have the full container width to
  // work within. _style.align (typography toolbar) takes highest priority, then
  // _style.alignItems maps to text-align semantics (start->left, end->right).
  const effectiveTextAlign = s.align
    ? s.align
    : s.alignItems
    ? (ALIGN_TO_TEXT[s.alignItems] ?? ax)
    : ax;

  const effectiveGap =
    s.gap != null ? `${Math.min(96, Math.max(0, s.gap))}px` : "1rem";

  // Remove `gap` from the resolved style: it belongs on the inner content wrapper
  // (via effectiveGap), not on the outer section whose only flex children are the
  // background layer, the overlay div, and the slot.
  const sectionStyle = resolveBlockStyle(_style);
  delete (sectionStyle as Record<string, unknown>).gap;

  return (
    <section
      ref={puck?.dragRef ?? undefined}
      data-block="container"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: effectiveJustify,
        minHeight: puck?.isEditing
          ? minHeight === "custom"
            ? (minHeightValue ?? "128px")
            : `${CONTAINER_EDITOR_HEIGHT_PX[minHeight ?? "auto"]}px`
          : minHeight === "custom"
            ? minHeightValue
            : CONTAINER_MIN_HEIGHT[minHeight ?? "auto"],
        paddingTop: _style?.paddingTop ?? CONTAINER_EFFECTIVE_PAD.top,
        paddingRight: _style?.paddingRight ?? CONTAINER_EFFECTIVE_PAD.right,
        paddingBottom: _style?.paddingBottom ?? CONTAINER_EFFECTIVE_PAD.bottom,
        paddingLeft: _style?.paddingLeft ?? CONTAINER_EFFECTIVE_PAD.left,
        overflow: "hidden",
        backgroundColor: hasBg ? "var(--pf-color-fg)" : undefined,
        ...sectionStyle,
      }}
      {...resolveBlockAttrs(_style)}
    >
      {/* Scrim renders FIRST but uses zIndex:1 so it paints ABOVE the background
          layers (img/slideshow island, zIndex 0) while staying BELOW the content
          slot (also zIndex:1, later in DOM order). Order is load-bearing — the
          slideshow island root is itself a `section > div[aria-hidden]`, so the
          scrim must precede it. Do not reorder. */}
      {hasBg && overlayAlpha > 0 && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 1, backgroundColor: `rgba(0,0,0,${overlayAlpha})` }} />
      )}
      {hasBg && (
        <div data-bg-opacity-layer aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: bgImageAlpha }}>
          {layers.length === 1 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={layers[0].src}
              alt=""
              aria-hidden="true"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          {layers.length >= 2 && (
            <ContainerBackgroundSlideshow
              images={layers}
              animation={bgAnimation ?? "crossfade"}
              speed={bgSpeed ?? "medium"}
            />
          )}
        </div>
      )}
      {Content({
        style: {
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "80rem",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          textAlign: effectiveTextAlign as React.CSSProperties["textAlign"],
          gap: effectiveGap,
        },
        // Editor only: give the empty drop zone a real, Puck-managed footprint via
        // Puck's native minEmptyHeight so the whole container is droppable AND
        // Puck's selection/action-bar overlay tracks the visible area (see
        // CONTAINER_EDITOR_HEIGHT_PX). On the public page the slot stays
        // content-sized (the section's min-height drives layout, unchanged).
        ...(puck?.isEditing
          ? { minEmptyHeight: CONTAINER_EDITOR_HEIGHT_PX[minHeight ?? "auto"] }
          : {}),
      })}
    </section>
  );
}

export const containerFields = {
  _style: productionStyleField,
  bgAnimation: {
    type: "select",
    label: "Background animation",
    options: [
      { label: "Crossfade", value: "crossfade" },
      { label: "Ken Burns", value: "kenburns" },
      { label: "Slide", value: "slide" },
    ],
  } as Field<ContainerBlockProps["bgAnimation"]>,
  bgSpeed: {
    type: "select",
    label: "Animation speed",
    options: [
      { label: "Slow (7s)", value: "slow" },
      { label: "Medium (5s)", value: "medium" },
      { label: "Fast (3s)", value: "fast" },
    ],
  } as Field<ContainerBlockProps["bgSpeed"]>,
  overlayOpacity: { type: "number", label: "Overlay opacity (0-100)", min: 0, max: 100 } as Field<number | undefined>,
  minHeight: {
    type: "select",
    label: "Min height",
    options: [
      { label: "Auto", value: "auto" },
      { label: "Short (40vh)", value: "short" },
      { label: "Medium (60vh)", value: "medium" },
      { label: "Tall (80vh)", value: "tall" },
    ],
  } as Field<ContainerHeight | undefined>,
  alignX: {
    type: "select",
    label: "Horizontal align",
    options: [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" },
    ],
  } as Field<ContainerAlignX | undefined>,
  alignY: {
    type: "select",
    label: "Vertical align",
    options: [
      { label: "Top", value: "top" },
      { label: "Center", value: "center" },
      { label: "Bottom", value: "bottom" },
    ],
  } as Field<ContainerAlignY | undefined>,
  content: { type: "slot" },
} as unknown as ComponentConfig<ContainerBlockProps>["fields"];

export const containerBlockConfig: ComponentConfig<ContainerBlockProps> = {
  label: "Container",
  inline: true,
  defaultProps: containerDefaultProps,
  fields: containerFields,
  render: ContainerBlock,
};

// ---------------------------------------------------------------------------
// ContainerAnchor — editor-only invisible "first child". See editorConfig.tsx
// for the resolveData logic that maintains it.
// ---------------------------------------------------------------------------

export type ContainerAnchorProps = {
  height: number;
};

export const containerAnchorDefaultProps: ContainerAnchorProps = { height: 128 };

export function ContainerAnchorBlock({
  height,
  puck,
}: ContainerAnchorProps & { puck?: BlockPuck }) {
  // Public page: render nothing — anchor is editor infrastructure only.
  if (!puck?.isEditing) return <></>;
  return (
    <div
      aria-hidden
      style={{ height: `${height}px`, width: "100%", pointerEvents: "none" }}
    />
  );
}

export const containerAnchorBlockConfig: ComponentConfig<ContainerAnchorProps> = {
  label: "ContainerAnchor",
  defaultProps: containerAnchorDefaultProps,
  fields: {
    height: { type: "number", label: "Height" } as Field<number>,
  },
  permissions: {
    drag: false,
    delete: false,
    duplicate: false,
    insert: false,
    edit: false,
  },
  // TODO: suppress Puck selection outline / keyboard nav (spike deferred)
  render: ContainerAnchorBlock as ComponentConfig<ContainerAnchorProps>["render"],
};

