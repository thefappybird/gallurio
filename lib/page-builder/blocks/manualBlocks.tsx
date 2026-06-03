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
  renderRichText,
  productionStyleField,
  productionRichTextField,
  type BlockStyle,
  type RichTextProp,
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
  text: RichTextProp;
  level: "h1" | "h2" | "h3";
};

export const headingDefaultProps: HeadingBlockProps = { text: { text: "Heading" }, level: "h2" };

const HEADING_SIZE: Record<HeadingBlockProps["level"], string> = {
  h1: "clamp(2rem, 5vw, 3.5rem)",
  h2: "clamp(1.5rem, 3vw, 2.5rem)",
  h3: "clamp(1.25rem, 2vw, 1.75rem)",
};

export function HeadingBlock({ _style, text, level }: HeadingBlockProps) {
  const t = renderRichText(text);
  const Tag = level;
  return (
    <div style={{ padding: "1rem 1.5rem", fontFamily: "var(--pf-font-body)", ...resolveBlockStyle(_style) }}>
      <Tag
        style={{
          fontFamily: "var(--pf-font-heading)",
          fontSize: HEADING_SIZE[level],
          fontWeight: 700,
          lineHeight: 1.2,
          color: "var(--pf-color-fg)",
          margin: 0,
          ...t.css,
        }}
      >
        {t.text}
      </Tag>
    </div>
  );
}

export const headingBlockConfig: ComponentConfig<HeadingBlockProps> = {
  label: "Heading",
  defaultProps: headingDefaultProps,
  fields: {
    _style: productionStyleField,
    text: productionRichTextField as Field<RichTextProp>,
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

export type TextBlockProps = { _style?: BlockStyle; text: RichTextProp };

export const textDefaultProps: TextBlockProps = {
  text: { text: "Write anything here. Line breaks are preserved." },
};

export function TextBlock({ _style, text }: TextBlockProps) {
  const t = renderRichText(text);
  return (
    <div style={{ padding: "1rem 1.5rem", fontFamily: "var(--pf-font-body)", ...resolveBlockStyle(_style) }}>
      <p
        style={{
          fontSize: "1rem",
          lineHeight: 1.7,
          color: "var(--pf-color-fg)",
          margin: 0,
          whiteSpace: "pre-line",
          ...t.css,
        }}
      >
        {t.text}
      </p>
    </div>
  );
}

export const textBlockConfig: ComponentConfig<TextBlockProps> = {
  label: "Text",
  defaultProps: textDefaultProps,
  fields: {
    _style: productionStyleField,
    text: productionRichTextField as Field<RichTextProp>,
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
    <div style={{ padding: "1rem 1.5rem", ...resolveBlockStyle(_style) }}>
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
  const justify = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";

  return (
    <div style={{ padding: "1rem 1.5rem", display: "flex", justifyContent: justify, ...resolveBlockStyle(_style) }}>
      <a
        href={href}
        role="button"
        data-cta={dataCta}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "2.75rem",
          minWidth: "9rem",
          padding: "0 1.75rem",
          fontFamily: "var(--pf-font-body)",
          fontSize: "0.9375rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textDecoration: "none",
          cursor: "pointer",
          borderRadius: "var(--pf-radius)",
          backgroundColor: "var(--pf-color-accent)",
          color: "#ffffff",
          border: "2px solid transparent",
        }}
      >
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
    <div style={{ padding: "1rem 1.5rem", ...resolveBlockStyle(_style) }}>
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
    <div style={{ padding: "1rem 1.5rem", ...resolveBlockStyle(_style) }}>
      {Content({
        style: {
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: "1rem",
          maxWidth: "80rem",
          margin: "0 auto",
        },
      })}
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
// Container (single styleable drop-zone)
// ---------------------------------------------------------------------------

export type ContainerBlockProps = { _style?: BlockStyle; content: Slot };

export const containerDefaultProps: ContainerBlockProps = { content: [] };

export function ContainerBlock({
  _style,
  content: Content,
}: {
  _style?: BlockStyle;
  content: SlotComponent;
}) {
  return (
    <div style={{ padding: "1.5rem", ...resolveBlockStyle(_style) }}>
      {Content({ style: { maxWidth: "80rem", margin: "0 auto" } })}
    </div>
  );
}

export const containerBlockConfig: ComponentConfig<ContainerBlockProps> = {
  label: "Container",
  defaultProps: containerDefaultProps,
  fields: {
    _style: productionStyleField,
    content: { type: "slot" },
  },
  render: ContainerBlock,
};
