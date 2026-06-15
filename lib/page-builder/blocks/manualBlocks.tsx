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

import type { ComponentConfig, Field, Slot, SlotComponent } from "@measured/puck";
import type { BlockPuck } from "@/lib/page-builder/serverContext";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  asText,
  colorTokenToVar,
  productionStyleField,
  FLEX_JUSTIFY_MAP,
  FLEX_ALIGN_MAP,
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

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

export type HeadingBlockProps = {
  _style?: BlockStyle;
  text: string;
  level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
};

export const headingDefaultProps: HeadingBlockProps = { text: "Heading", level: "h2" };

const HEADING_SIZE: Record<HeadingBlockProps["level"], string> = {
  h1: "3rem",
  h2: "2.25rem",
  h3: "1.75rem",
  h4: "1.375rem",
  h5: "1.125rem",
  h6: "0.875rem",
};

export function HeadingBlock({ _style, text, level }: HeadingBlockProps) {
  const textContent = asText(text);
  const Tag = level;
  const hl = _style?.highlight;
  return (
    <div
      style={{
        fontFamily: "var(--pf-font-body)",
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

export function TextBlock({ _style, text }: TextBlockProps) {
  const textContent = asText(text);
  const hl = _style?.highlight;
  return (
    <div
      style={{
        fontFamily: "var(--pf-font-body)",
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
  defaultProps: textDefaultProps,
  fields: {
    _style: productionStyleField,
    text: { type: "textarea", label: "Text" },
  },
  render: TextBlock,
};

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

export type ImageBlockProps = {
  _style?: BlockStyle;
  imagePublicId?: string;
  imageUrl?: string;
  alt: string;
  fit: "cover" | "contain";
};

export const imageDefaultProps: ImageBlockProps = { imagePublicId: "", imageUrl: "", alt: "", fit: "cover" };

export function ImageBlock({ _style, imagePublicId, imageUrl, alt, fit }: ImageBlockProps) {
  const src = (imagePublicId ? cfImageUrl(imagePublicId) : null) || imageUrl || null;
  return (
    <div style={{ padding: "1rem 1.5rem", ...resolveBlockStyle(_style) }} {...resolveBlockAttrs(_style)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{ width: "100%", height: "auto", display: "block", objectFit: fit }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            aspectRatio: "3 / 2",
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
  defaultProps: imageDefaultProps,
  fields: {
    _style: productionStyleField,
    imagePublicId: { type: "text", label: "Image (asset ID)" },
    imageUrl: { type: "text", label: "Image URL (fallback)" },
    alt: { type: "text", label: "Alt text" },
    fit: {
      type: "select",
      label: "Fit",
      options: [
        { label: "Cover", value: "cover" },
        { label: "Contain", value: "contain" },
      ],
    },
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

const BUTTON_SIZE_STYLES = {
  sm: { padding: "0 1rem", minHeight: "2rem", minWidth: "6rem", fontSize: "0.8125rem" },
  md: { padding: "0 1.75rem", minHeight: "2.75rem", minWidth: "9rem", fontSize: "0.9375rem" },
  lg: { padding: "0 2.5rem", minHeight: "3.5rem", minWidth: "12rem", fontSize: "1.125rem" },
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
  const href = action === "go-to-gallery" && slug ? `/w/${slug}/gallery` : "#";
  const dataCta = action === "open-contact" ? "contact" : undefined;

  const tkBorderRadius = "var(--pf-radius)";
  const customTextColor = colorTokenToVar(_style?.textColorToken);
  const colorVar = colorTokenToVar(_style?.buttonColorToken) ?? "var(--pf-color-primary)";

  let buttonBg: string;
  let buttonText: string;
  let tkBorderWidth: string;
  let tkBorderColor: string;

  if (_style?.buttonStyle === "outline") {
    buttonBg = "transparent";
    buttonText = customTextColor ?? colorVar;
    tkBorderWidth = _style?.borderWidth !== undefined ? `${_style.borderWidth}px` : "2px";
    tkBorderColor = colorTokenToVar(_style?.borderColorToken) ?? colorVar;
  } else if (_style?.buttonStyle === "soft") {
    buttonBg = `color-mix(in srgb, ${colorVar} 15%, transparent)`;
    buttonText = customTextColor ?? colorVar;
    tkBorderWidth = _style?.borderWidth !== undefined ? `${_style.borderWidth}px` : "0px";
    tkBorderColor = "transparent";
  } else if (_style?.buttonStyle === "solid") {
    buttonBg = colorVar;
    buttonText = customTextColor ?? "var(--pf-color-bg)";
    tkBorderWidth = _style?.borderWidth !== undefined ? `${_style.borderWidth}px` : "0px";
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

  // Resolve toolkit styles for margins, shadow, font family/size overrides.
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
    ...(resolved.boxShadow && { boxShadow: resolved.boxShadow as string }),
    ...(resolved.fontFamily && { fontFamily: resolved.fontFamily as string }),
    ...(resolved.fontSize && { fontSize: resolved.fontSize as string }),
  };

  return (
    <div style={wrapperStyle} {...resolveBlockAttrs(_style)}>
      <a href={href} role="button" data-cta={dataCta} style={aStyle}>
        {label}
      </a>
    </div>
  );
}

export const buttonBlockConfig: ComponentConfig<ButtonBlockProps> = {
  label: "Button",
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

export function SpacerBlock({ height }: SpacerBlockProps) {
  const h = Math.min(400, Math.max(4, Number.isFinite(height) ? height : 48));
  return <div aria-hidden="true" style={{ height: `${h}px` }} />;
}

export const spacerBlockConfig: ComponentConfig<SpacerBlockProps> = {
  label: "Spacer",
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

export function DividerBlock({ _style, thickness }: DividerBlockProps) {
  const t = Math.min(12, Math.max(1, Number.isFinite(thickness) ? thickness : 1));
  return (
    <div style={{ padding: "1rem 1.5rem", ...resolveBlockStyle(_style) }} {...resolveBlockAttrs(_style)}>
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
  _style?: BlockStyle;
  columns: 2 | 3;
  content: Slot;
};

export const columnsDefaultProps: ColumnsBlockProps = {
  columns: 2,
  content: [],
  _style: {
    paddingTop: "1rem",
    paddingRight: "1.5rem",
    paddingBottom: "1rem",
    paddingLeft: "1.5rem",
  },
};

export function ColumnsBlock({
  _style,
  columns,
  content: Content,
}: {
  _style?: BlockStyle;
  columns: 2 | 3;
  content: SlotComponent;
}) {
  const cols = columns === 3 ? 3 : 2;
  return (
    <div style={{ padding: "1rem 1.5rem", ...resolveBlockStyle(_style) }} {...resolveBlockAttrs(_style)}>
      {/* Responsive: 1 column on phones, 2 on tablets, the chosen count on
          desktop. Inline styles can't hold media queries, so scoped classes +
          a <style> drive the breakpoints. */}
      <style>{`
        .pf-cols{display:grid;gap:1rem;max-width:80rem;margin:0 auto;grid-template-columns:1fr;}
        @media (min-width:640px){.pf-cols-2,.pf-cols-3{grid-template-columns:repeat(2,minmax(0,1fr));}}
        @media (min-width:1024px){.pf-cols-3{grid-template-columns:repeat(3,minmax(0,1fr));}}
      `}</style>
      {Content({ className: `pf-cols pf-cols-${cols}`, style: {} })}
    </div>
  );
}

export const columnsBlockConfig: ComponentConfig<ColumnsBlockProps> = {
  label: "Columns",
  defaultProps: columnsDefaultProps,
  fields: {
    _style: productionStyleField,
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "2 columns", value: 2 },
        { label: "3 columns", value: 3 },
      ],
    } as Field<2 | 3>,
    content: { type: "slot" },
  },
  render: ColumnsBlock,
};

// ---------------------------------------------------------------------------
// Container — a styleable SECTION drop-zone. Doubles as the wrapper for composed
// "preset" sections (Hero/About/CTA/…): full-bleed background image + overlay,
// min-height, and content alignment, with a slot that nests any other blocks.
// ---------------------------------------------------------------------------

export type ContainerHeight = "auto" | "short" | "medium" | "tall";
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
  alignX?: ContainerAlignX;
  alignY?: ContainerAlignY;
  content: Slot;
};

export const containerDefaultProps: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  content: [],
  _style: {
    paddingTop: "1.5rem",
    paddingRight: "1.5rem",
    paddingBottom: "1.5rem",
    paddingLeft: "1.5rem",
  },
};

const CONTAINER_MIN_HEIGHT: Record<ContainerHeight, string | undefined> = {
  auto: undefined,
  short: "40vh",
  medium: "60vh",
  tall: "80vh",
};
const ALIGN_Y_MAP: Record<ContainerAlignY, string> = { top: "flex-start", center: "center", bottom: "flex-end" };
const ALIGN_X_ITEMS: Record<ContainerAlignX, string> = { left: "flex-start", center: "center", right: "flex-end" };
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
  alignX,
  alignY,
  content: Content,
}: {
  _style?: BlockStyle;
  backgroundImages?: GalleryImage[];
  bgAnimation?: "crossfade" | "kenburns" | "slide";
  bgSpeed?: "slow" | "medium" | "fast";
  overlayOpacity?: number;
  minHeight?: ContainerHeight;
  alignX?: ContainerAlignX;
  alignY?: ContainerAlignY;
  content: SlotComponent;
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
      data-block="container"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: effectiveJustify,
        minHeight: CONTAINER_MIN_HEIGHT[minHeight ?? "auto"],
        padding: "1.5rem",
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
  defaultProps: containerDefaultProps,
  fields: containerFields,
  render: ContainerBlock,
};

