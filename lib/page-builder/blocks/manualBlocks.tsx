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
} from "@/lib/page-builder/styleToolkit";

// Client-safe Cloudinary delivery URL (PUBLIC cloud name only — no server SDK).
function cloudinaryUrl(publicId: string, w = 1200): string | null {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud || !publicId) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_${w},q_auto,f_auto/${publicId}`;
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
  level: "h1" | "h2" | "h3";
};

export const headingDefaultProps: HeadingBlockProps = { text: "Heading", level: "h2" };

const HEADING_SIZE: Record<HeadingBlockProps["level"], string> = {
  h1: "clamp(2rem, 5vw, 3.5rem)",
  h2: "clamp(1.5rem, 3vw, 2.5rem)",
  h3: "clamp(1.25rem, 2vw, 1.75rem)",
};

export function HeadingBlock({ _style, text, level }: HeadingBlockProps) {
  const textContent = asText(text);
  const Tag = level;
  return (
    // Base color/font on the wrapper so the `_style` toolkit (textColorToken,
    // fontFamily, fontSize…) can override it; the inner tag inherits.
    <div
      style={{
        padding: "1rem 1.5rem",
        fontFamily: "var(--pf-font-body)",
        color: "var(--pf-color-fg)",
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
        {textContent}
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
        { label: "H1", value: "h1" },
        { label: "H2", value: "h2" },
        { label: "H3", value: "h3" },
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
  return (
    <div
      style={{
        padding: "1rem 1.5rem",
        fontFamily: "var(--pf-font-body)",
        fontSize: "1rem",
        color: "var(--pf-color-fg)",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      <p style={{ fontSize: "inherit", lineHeight: 1.7, color: "inherit", margin: 0, whiteSpace: "pre-line" }}>
        {textContent}
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
  const src = (imagePublicId ? cloudinaryUrl(imagePublicId) : null) || imageUrl || null;
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
    imagePublicId: { type: "text", label: "Image (Cloudinary public ID)" },
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

export type ButtonBlockProps = {
  _style?: BlockStyle;
  label: string;
  action: "open-contact" | "go-to-gallery";
  align: "left" | "center" | "right";
};

export const buttonDefaultProps: ButtonBlockProps = {
  label: "Get in Touch",
  action: "open-contact",
  align: "center",
};

export function ButtonBlock({ _style, label, action, align, puck }: ButtonBlockProps & { puck?: BlockPuck }) {
  const slug = gallerySlugFrom(puck);
  const href = action === "go-to-gallery" && slug ? `/w/${slug}/gallery` : "#";
  const dataCta = action === "open-contact" ? "contact" : undefined;

  const hasColor = _style?.buttonColorToken !== undefined;
  const buttonBg = hasColor
    ? (colorTokenToVar(_style!.buttonColorToken) ?? "transparent")
    : "transparent";
  const buttonText = colorTokenToVar(_style?.textColorToken) ?? "var(--pf-color-fg)";

  // Border resolved directly from _style so borderColor works independently of borderWidth.
  const tkBorderWidth = _style?.borderWidth !== undefined ? `${_style.borderWidth}px` : "2px";
  const tkBorderColor = colorTokenToVar(_style?.borderColorToken) ?? (hasColor ? "transparent" : "var(--pf-color-fg)");
  const tkBorderRadius = _style?.radius !== undefined ? `${_style.radius}px` : "var(--pf-radius)";

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
    minHeight: "2.75rem",
    minWidth: "9rem",
    padding: "0 1.75rem",
    letterSpacing: "0.04em",
    cursor: "pointer",
    fontFamily: "var(--pf-font-body)",
    fontSize: "0.9375rem",
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

export const columnsDefaultProps: ColumnsBlockProps = { columns: 2, content: [] };

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
  backgroundImagePublicId?: string;
  /** Dark scrim over the background image, 0–100. Only meaningful with an image. */
  overlayOpacity?: number;
  minHeight?: ContainerHeight;
  alignX?: ContainerAlignX;
  alignY?: ContainerAlignY;
  content: Slot;
};

export const containerDefaultProps: ContainerBlockProps = {
  backgroundImagePublicId: "",
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  content: [],
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
  backgroundImagePublicId,
  overlayOpacity,
  minHeight,
  alignX,
  alignY,
  content: Content,
}: {
  _style?: BlockStyle;
  backgroundImagePublicId?: string;
  overlayOpacity?: number;
  minHeight?: ContainerHeight;
  alignX?: ContainerAlignX;
  alignY?: ContainerAlignY;
  content: SlotComponent;
}) {
  const ax = alignX ?? "left";
  const ay = alignY ?? "top";
  const s = _style ?? {};
  const bgSrc = backgroundImagePublicId
    ? cloudinaryUrl(backgroundImagePublicId, 2000)
    : s.bgImagePublicId
    ? cloudinaryUrl(s.bgImagePublicId, 2000)
    : null;
  const overlayAlpha = Math.min(100, Math.max(0, overlayOpacity ?? 0)) / 100;

  // Vertical positioning of the content block within the section height.
  const effectiveJustify = s.justifyContent
    ? FLEX_JUSTIFY_MAP[s.justifyContent as keyof typeof FLEX_JUSTIFY_MAP] ?? ALIGN_Y_MAP[ay]
    : ALIGN_Y_MAP[ay];

  // Horizontal TEXT alignment inside child blocks. Children always stretch to full
  // width so that text-align, button justify, etc. have the full container width to
  // work within. _style.alignItems maps to text-align semantics (start→left, end→right).
  const effectiveTextAlign = s.alignItems
    ? (ALIGN_TO_TEXT[s.alignItems] ?? ax)
    : ax;

  const effectiveGap =
    s.gap != null ? `${Math.min(96, Math.max(0, s.gap))}px` : "1rem";

  // Remove `gap` from the resolved style: it belongs on the inner content wrapper
  // (via effectiveGap), not on the outer section whose only flex children are the
  // background image, the overlay div, and the slot — gaps between those are wrong.
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
        backgroundColor: bgSrc ? "var(--pf-color-fg)" : undefined,
        ...sectionStyle,
      }}
      {...resolveBlockAttrs(_style)}
    >
      {bgSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgSrc}
          alt=""
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {bgSrc && overlayAlpha > 0 && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${overlayAlpha})` }} />
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

export const containerFields: ComponentConfig<ContainerBlockProps>["fields"] = {
  _style: productionStyleField,
  backgroundImagePublicId: { type: "text", label: "Background image (Cloudinary public ID)" },
  overlayOpacity: { type: "number", label: "Overlay opacity (0–100)", min: 0, max: 100 } as Field<number | undefined>,
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
};

export const containerBlockConfig: ComponentConfig<ContainerBlockProps> = {
  label: "Container",
  defaultProps: containerDefaultProps,
  fields: containerFields,
  render: ContainerBlock,
};

