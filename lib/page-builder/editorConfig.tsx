/**
 * Client-safe Puck config for the EDITOR canvas.
 *
 * The gallery/featured blocks and the ContactDetails block are async server
 * components (Mongo + AsyncLocalStorage), so they cannot be imported into the
 * client <Puck> editor. For those, this config mirrors each block's `fields` +
 * `defaultProps` and renders a lightweight client PREVIEW.
 *
 * The Video block and the manual primitives (Heading/Text/Image/Button/Spacer/
 * Divider/Columns/Container) are ISOMORPHIC (client-safe), so the editor renders
 * the REAL component and only swaps in editor-friendly fields (StyleToolkit /
 * SingleImagePicker). Their defaultProps are imported directly to guarantee
 * parity.
 *
 * The 5 preset blocks (HeroPreset/AboutPreset/ServicesPreset/CtaPreset/
 * ContactPreset) are Container-based compositions. They render the REAL
 * ContainerBlock with editor-friendly container fields (style picker + image
 * picker). Their defaultProps come from SECTION_PRESETS.
 *
 * Component `type` keys + field keys MUST match `puckConfig` exactly so data
 * round-trips. A test (editorConfig.test.ts) guards parity.
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import type { Config, ComponentConfig, Field } from "@measured/puck";
import { CollectionPicker } from "./galleryPicker/CollectionPicker";
import { FeaturedItemsPicker } from "./galleryPicker/FeaturedItemsPicker";
import { SingleImagePicker } from "./galleryPicker/SingleImagePicker";
import { SingleImageControl, MultiImageControl } from "./galleryPicker/MediaField";
import type { MediaPickerSelection } from "./galleryPicker/MediaPicker";
import { usePickerData } from "./galleryPicker/usePickerData";
import { StyleToolkitField } from "./StyleToolkitField";
import { NumberInputRow } from "./toolbarPrimitives";
import { resolveBlockStyle, asText, type BlockStyle } from "./styleToolkit";
import { PRESET_BLOCK_KEYS, MANUAL_BLOCK_KEYS } from "./blockCategories";
// Preset defaultProps
import { SECTION_PRESETS } from "./blocks/sectionPresets";
// Data blocks are SERVER modules (Mongo / node:async_hooks). Import their TYPES
// only — their value defaultProps are inlined below so this CLIENT config never
// drags the server graph into the editor bundle (that breaks the build).
import type { ContactDetailsProps } from "./blocks/ContactDetailsBlock";
import type { GalleryGridProps } from "./blocks/GalleryGridBlock";
import type { GalleryMasonryProps } from "./blocks/GalleryMasonryBlock";
import type { GalleryCarouselProps } from "./blocks/GalleryCarouselBlock";
import type { FeaturedWorkProps, FeaturedWorkItemId } from "./blocks/FeaturedWorkBlock";

// Inlined copies of the data blocks' defaultProps (kept in sync; the parity
// test compares these against the real server-block defaults).
const galleryGridDefaultProps: GalleryGridProps = { collectionId: "", columns: 3, gap: "normal", maxItems: 12 };
const galleryMasonryDefaultProps: GalleryMasonryProps = { collectionId: "", columns: 3, gap: "normal", maxItems: 18 };
const galleryCarouselDefaultProps: GalleryCarouselProps = { heading: "", description: "", collectionId: "", aspect: "landscape", floatX: "center", floatY: "center", autoplay: false, maxItems: 12 };
const featuredWorkDefaultProps: FeaturedWorkProps = { itemIds: [], layout: "row" };
const contactDetailsDefaultProps: ContactDetailsProps = { showEmail: true, showPhone: true, showAddress: true, showSocials: true };
// Isomorphic blocks — safe to import the real component + defaults into the client.
import {
  VideoBlock,
  videoDefaultProps,
  type VideoBlockProps,
} from "./blocks/VideoBlock";
import {
  HeadingBlock,
  TextBlock,
  ImageBlock,
  ButtonBlock,
  SpacerBlock,
  DividerBlock,
  ColumnsBlock,
  ContainerBlock,
  headingDefaultProps,
  textDefaultProps,
  imageDefaultProps,
  buttonDefaultProps,
  spacerDefaultProps,
  dividerDefaultProps,
  columnsDefaultProps,
  containerDefaultProps,
  type HeadingBlockProps,
  type TextBlockProps,
  type ImageBlockProps,
  type ButtonBlockProps,
  type SpacerBlockProps,
  type DividerBlockProps,
  type ColumnsBlockProps,
  type ContainerBlockProps,
  type ContainerHeight,
  type ContainerAlignX,
  type ContainerAlignY,
} from "./blocks/manualBlocks";

type EditorComponents = {
  // Preset sections (Container-based compositions)
  HeroPreset: ContainerBlockProps;
  AboutPreset: ContainerBlockProps;
  ServicesPreset: ContainerBlockProps;
  CtaPreset: ContainerBlockProps;
  ContactPreset: ContainerBlockProps;
  GalleryGridPreset: ContainerBlockProps;
  GalleryMasonryPreset: ContainerBlockProps;
  FeaturedWorkPreset: ContainerBlockProps;
  // Data blocks
  GalleryGrid: GalleryGridProps;
  GalleryMasonry: GalleryMasonryProps;
  GalleryCarousel: GalleryCarouselProps;
  FeaturedWork: FeaturedWorkProps;
  Video: VideoBlockProps;
  ContactDetails: ContactDetailsProps;
  // Manual primitives
  Heading: HeadingBlockProps;
  Text: TextBlockProps;
  Image: ImageBlockProps;
  Button: ButtonBlockProps;
  Spacer: SpacerBlockProps;
  Divider: DividerBlockProps;
  Columns: ColumnsBlockProps;
  Container: ContainerBlockProps;
};

// ---------------------------------------------------------------------------
// Shared preview chrome (uses the brand-kit CSS vars applied by the editor
// wrapper, so previews echo the portfolio's colors/fonts).
// ---------------------------------------------------------------------------

function Preview({
  label,
  lines,
  blockStyle,
}: {
  label: string;
  lines: Array<string | null | undefined>;
  blockStyle?: BlockStyle;
}) {
  const shown = lines.filter((l): l is string => Boolean(l && l.trim()));
  return (
    <section
      style={{
        border: "1px solid color-mix(in srgb, var(--pf-color-fg) 15%, transparent)",
        background: "var(--pf-color-bg)",
        color: "var(--pf-color-fg)",
        fontFamily: "var(--pf-font-body)",
        padding: "1.5rem",
        margin: 0,
        ...resolveBlockStyle(blockStyle),
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontSize: "0.6875rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          opacity: 0.55,
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </span>
      {shown.map((line, i) => (
        <p
          key={i}
          style={{
            margin: "0.15rem 0",
            fontFamily: i === 0 ? "var(--pf-font-heading)" : "var(--pf-font-body)",
            fontSize: i === 0 ? "1.125rem" : "0.875rem",
            opacity: i === 0 ? 1 : 0.7,
            whiteSpace: "pre-line",
          }}
        >
          {line}
        </p>
      ))}
    </section>
  );
}

function useCollectionName(collectionId: string): string {
  const { state } = usePickerData();
  if (!collectionId || state.status !== "ok") return "";
  return state.data.collections.find((collection) => collection.id === collectionId)?.name ?? "";
}

function GalleryCollectionPreview({
  label,
  blockStyle,
  heading,
  collectionId,
  summary,
}: {
  label: string;
  blockStyle?: BlockStyle;
  heading?: string;
  collectionId: string;
  summary: string;
}) {
  const resolvedHeading = rt(heading);
  const collectionName = useCollectionName(collectionId);
  const primaryLine = resolvedHeading || collectionName || "No collection selected";

  return (
    <Preview
      label={label}
      lines={[primaryLine, summary]}
      blockStyle={blockStyle}
    />
  );
}

function truncate(value: string | undefined, max = 120): string {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Preview helper — pulls the plain text out of a stored value (tolerates legacy objects). */
function rt(value: unknown): string {
  return asText(value);
}

// ---------------------------------------------------------------------------
// Shared editor fields
// ---------------------------------------------------------------------------

const styleField = {
  type: "custom",
  label: "Style",
  render: ({ value, onChange, id }: { value: unknown; onChange: (v: unknown) => void; id: string }) => (
    <StyleToolkitField
      value={value as BlockStyle | undefined}
      onChange={onChange as (v: BlockStyle) => void}
      fieldId={id}
    />
  ),
} as unknown as Field<BlockStyle | undefined>;

// Plain text/textarea field. (Text styling is section-wide via the `_style`
// toolkit — there is no per-text toolbar.) Kept as a helper so block configs
// read uniformly; `multiline` picks textarea.
function richTextField(label: string, multiline = false): Field<string> {
  return { type: multiline ? "textarea" : "text", label } as Field<string>;
}

function imagePickerField(label: string): Field<string | undefined> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
      <SingleImagePicker value={(value as string) ?? ""} onChange={onChange} />
    ),
  } as unknown as Field<string | undefined>;
}

/** Single-image Puck custom field backed by the unified MediaPicker. */
function imageField(label: string): Field<string | undefined> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
      <SingleImageControl value={(value as string) ?? ""} onChange={onChange as (v: string) => void} />
    ),
  } as unknown as Field<string | undefined>;
}

/** Multi-image Puck custom field backed by the unified MediaPicker. Wired to the
 *  gallery blocks in sub-project #2; defined here with tests as its deliverable. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function imagesField(label: string, opts: { max?: number } = {}): Field<MediaPickerSelection[]> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
      <MultiImageControl
        value={(value as MediaPickerSelection[]) ?? []}
        onChange={onChange as (v: MediaPickerSelection[]) => void}
        max={opts.max}
      />
    ),
  } as unknown as Field<MediaPickerSelection[]>;
}

function collectionField(): Field<string> {
  return {
    type: "custom",
    label: "Collection",
    render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
      <CollectionPicker value={value as string} onChange={onChange as (v: string) => void} />
    ),
  } as unknown as Field<string>;
}

// ---------------------------------------------------------------------------
// Container fields for the editor — same KEYS as containerFields in manualBlocks,
// but `_style` uses the StyleToolkitField and `backgroundImagePublicId` uses the
// SingleImagePicker so authors get visual pickers instead of raw text inputs.
// ---------------------------------------------------------------------------

const editorContainerFields: ComponentConfig<ContainerBlockProps>["fields"] = {
  _style: styleField,
  backgroundImagePublicId: { ...imagePickerField("Background image"), visible: false } as unknown as Field<string | undefined>,
  overlayOpacity: { type: "number", label: "Overlay opacity (0–100)", min: 0, max: 100, visible: false } as unknown as Field<number | undefined>,
  minHeight: {
    type: "select",
    label: "Min height",
    options: [
      { label: "Auto", value: "auto" },
      { label: "Short (40vh)", value: "short" },
      { label: "Medium (60vh)", value: "medium" },
      { label: "Tall (80vh)", value: "tall" },
    ],
  } as unknown as Field<ContainerHeight | undefined>,
  alignX: {
    type: "select",
    label: "Horizontal align",
    visible: false,
    options: [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" },
    ],
  } as unknown as Field<ContainerAlignX | undefined>,
  alignY: {
    type: "select",
    label: "Vertical align",
    visible: false,
    options: [
      { label: "Top", value: "top" },
      { label: "Center", value: "center" },
      { label: "Bottom", value: "bottom" },
    ],
  } as unknown as Field<ContainerAlignY | undefined>,
  content: { type: "slot" },
};

// ---------------------------------------------------------------------------
// Preset block editor configs — real ContainerBlock render + editor fields +
// SECTION_PRESETS defaultProps for each section.
// ---------------------------------------------------------------------------

// Hides sidebar fields that are managed by the StyleToolkitField Content/Layout tabs.
// The double cast is required because Puck's resolveFields return type is a strict
// branded Fields<T> — we need to go through unknown to avoid the structural mismatch.
function resolveContainerFields(_data: unknown, { fields }: { fields: Record<string, unknown> }) {
  const { backgroundImagePublicId: _b, overlayOpacity: _o, alignX: _ax, alignY: _ay, minHeight: _mh, ...rest } = fields;
  return rest;
}
const resolveContainerFieldsTyped = resolveContainerFields as unknown as ComponentConfig<ContainerBlockProps>["resolveFields"];

const heroPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.HeroPreset.label,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.HeroPreset.defaultProps,
  render: ContainerBlock,
};

const aboutPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.AboutPreset.label,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.AboutPreset.defaultProps,
  render: ContainerBlock,
};

const servicesPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.ServicesPreset.label,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.ServicesPreset.defaultProps,
  render: ContainerBlock,
};

const ctaPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.CtaPreset.label,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.CtaPreset.defaultProps,
  render: ContainerBlock,
};

const contactPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.ContactPreset.label,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.ContactPreset.defaultProps,
  render: ContainerBlock,
};

const galleryGridPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.GalleryGridPreset.label,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.GalleryGridPreset.defaultProps,
  render: ContainerBlock,
};

const galleryMasonryPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.GalleryMasonryPreset.label,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.GalleryMasonryPreset.defaultProps,
  render: ContainerBlock,
};

const featuredWorkPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.FeaturedWorkPreset.label,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.FeaturedWorkPreset.defaultProps,
  render: ContainerBlock,
};

// ---------------------------------------------------------------------------
// Gallery data blocks — server-only; editor renders a lightweight Preview.
// ---------------------------------------------------------------------------

const galleryGrid: ComponentConfig<GalleryGridProps> = {
  label: "Gallery Grid",
  defaultProps: galleryGridDefaultProps,
  fields: {
    _style: styleField,
    collectionId: collectionField(),
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "2 columns", value: 2 },
        { label: "3 columns", value: 3 },
        { label: "4 columns", value: 4 },
      ],
    } as Field<2 | 3 | 4>,
    gap: {
      type: "select",
      label: "Gap between images",
      options: [
        { label: "Tight (4px)", value: "tight" },
        { label: "Normal (8px)", value: "normal" },
        { label: "Loose (16px)", value: "loose" },
      ],
    },
    maxItems: { type: "number", label: "Max items (1–100)", min: 1, max: 100 } as Field<number>,
  },
  resolveFields: (_data, { fields }) => {
    // All non-_style fields are managed by the StyleToolkitField Content/Layout tabs
    return { _style: (fields as Record<string, unknown>)._style } as typeof fields;
  },
  render: ({ _style, collectionId, columns, maxItems }) => (
    <GalleryCollectionPreview
      label="Gallery Grid"
      collectionId={collectionId}
      summary={`${columns} columns · up to ${maxItems}`}
      blockStyle={_style}
    />
  ),
};

const galleryMasonry: ComponentConfig<GalleryMasonryProps> = {
  label: "Gallery Masonry",
  defaultProps: galleryMasonryDefaultProps,
  fields: {
    _style: styleField,
    collectionId: collectionField(),
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "2 columns", value: 2 },
        { label: "3 columns", value: 3 },
        { label: "4 columns", value: 4 },
      ],
    } as Field<2 | 3 | 4>,
    gap: {
      type: "select",
      label: "Gap between images",
      options: [
        { label: "Tight", value: "tight" },
        { label: "Normal", value: "normal" },
        { label: "Loose", value: "loose" },
      ],
    },
    maxItems: { type: "number", label: "Max items (1–100)", min: 1, max: 100 } as Field<number>,
  },
  resolveFields: (_data, { fields }) => {
    // All non-_style fields are managed by the StyleToolkitField Content/Layout tabs
    return { _style: (fields as Record<string, unknown>)._style } as typeof fields;
  },
  render: ({ _style, collectionId, columns, maxItems }) => (
    <GalleryCollectionPreview
      label="Gallery Masonry"
      collectionId={collectionId}
      summary={`${columns} columns · up to ${maxItems}`}
      blockStyle={_style}
    />
  ),
};

const galleryCarousel: ComponentConfig<GalleryCarouselProps> = {
  label: "Gallery Carousel",
  defaultProps: galleryCarouselDefaultProps,
  fields: {
    _style: styleField,
    heading: richTextField("Heading (optional)"),
    description: richTextField("Description (optional)", true),
    collectionId: collectionField(),
    aspect: {
      type: "select",
      label: "Image shape",
      options: [
        { label: "Square", value: "square" },
        { label: "Landscape", value: "landscape" },
        { label: "Portrait", value: "portrait" },
      ],
    },
    floatX: {
      type: "select",
      label: "Floating header — horizontal",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    } as Field<"left" | "center" | "right">,
    floatY: {
      type: "select",
      label: "Floating header — vertical",
      options: [
        { label: "Top", value: "top" },
        { label: "Middle", value: "center" },
        { label: "Bottom", value: "bottom" },
      ],
    } as Field<"top" | "center" | "bottom">,
    autoplay: {
      type: "select",
      label: "Autoplay",
      options: [
        { label: "Off", value: false },
        { label: "On", value: true },
      ],
    } as Field<boolean>,
    maxItems: { type: "number", label: "Max items (1–100)", min: 1, max: 100 } as Field<number>,
  },
  resolveFields: (_data, { fields }) => {
    // All non-_style fields are managed by the StyleToolkitField Content/Layout tabs
    return { _style: (fields as Record<string, unknown>)._style } as typeof fields;
  },
  render: ({ _style, heading, collectionId, aspect, maxItems }) => (
    <GalleryCollectionPreview
      label="Gallery Carousel"
      heading={heading}
      collectionId={collectionId}
      summary={`${aspect} · up to ${maxItems}`}
      blockStyle={_style}
    />
  ),
};

const featuredWork: ComponentConfig<FeaturedWorkProps> = {
  label: "Featured Work",
  defaultProps: featuredWorkDefaultProps,
  fields: {
    _style: styleField,
    itemIds: {
      type: "custom",
      label: "Featured photos (max 3)",
      render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
        <FeaturedItemsPicker
          value={value as FeaturedWorkItemId[]}
          onChange={onChange as (v: Array<{ id: string }>) => void}
        />
      ),
    } as unknown as Field<FeaturedWorkItemId[]>,
    layout: {
      type: "select",
      label: "Layout",
      options: [
        { label: "Row", value: "row" },
        { label: "Stagger", value: "stagger" },
      ],
    },
  },
  resolveFields: (_data, { fields }) => {
    // All non-_style fields are managed by the StyleToolkitField Content/Layout tabs
    return { _style: (fields as Record<string, unknown>)._style } as typeof fields;
  },
  render: ({ _style, itemIds, layout }) => (
    <Preview
      label="Featured Work"
      lines={[`${itemIds?.length ?? 0} items · ${layout}`]}
      blockStyle={_style}
    />
  ),
};

// ---------------------------------------------------------------------------
// Video — isomorphic; editor renders the real component with editor fields.
// ---------------------------------------------------------------------------

const video: ComponentConfig<VideoBlockProps> = {
  label: "Video",
  defaultProps: videoDefaultProps,
  fields: {
    _style: styleField,
    description: { ...richTextField("Description (optional)", true), visible: false } as unknown as Field<string>,
    videoUrl: { type: "text", label: "YouTube or Vimeo URL", visible: false } as unknown as Field<string>,
    footer: { ...richTextField("Footer (optional)", true), visible: false } as unknown as Field<string>,
  },
  resolveFields: (_data, { fields }) => {
    // videoUrl, description, and footer are managed by the Content tab in StyleToolkitField
    const { videoUrl: _v, description: _d, footer: _f, ...rest } = fields as Record<string, unknown>;
    return rest as typeof fields;
  },
  render: VideoBlock,
};

// ---------------------------------------------------------------------------
// ContactDetails — server-only data block; editor renders a Preview.
// ---------------------------------------------------------------------------

const contactDetails: ComponentConfig<ContactDetailsProps> = {
  label: "Contact Details",
  defaultProps: contactDetailsDefaultProps,
  fields: {
    _style: styleField,
    showEmail: {
      type: "select",
      label: "Show email",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    } as Field<boolean>,
    showPhone: {
      type: "select",
      label: "Show phone",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    } as Field<boolean>,
    showAddress: {
      type: "select",
      label: "Show address",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    } as Field<boolean>,
    showSocials: {
      type: "select",
      label: "Show social links",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    } as Field<boolean>,
  },
  resolveFields: (_data, { fields }) => {
    // All show* toggles are managed by the ContactDetailsPanel in StyleToolkitField
    return { _style: (fields as Record<string, unknown>)._style } as typeof fields;
  },
  render: ({ _style, showEmail, showPhone, showAddress, showSocials }) => (
    <Preview
      label="Contact Details"
      lines={[
        [showEmail && "Email", showPhone && "Phone", showAddress && "Address", showSocials && "Socials"]
          .filter(Boolean)
          .join(" · ") || "All fields hidden",
      ]}
      blockStyle={_style}
    />
  ),
};

// ---------------------------------------------------------------------------
// Manual primitives — isomorphic; editor renders the real component.
// ---------------------------------------------------------------------------

const heading: ComponentConfig<HeadingBlockProps> = {
  label: "Heading",
  defaultProps: headingDefaultProps,
  fields: {
    _style: styleField,
    text: { ...richTextField("Heading text"), visible: false } as unknown as Field<string>,
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
  resolveFields: (_data, { fields }) => {
    // text and level are managed by the Content tab in StyleToolkitField
    const { text: _t, level: _l, ...rest } = fields as Record<string, unknown>;
    return rest as typeof fields;
  },
  render: HeadingBlock,
};

const text: ComponentConfig<TextBlockProps> = {
  label: "Text",
  defaultProps: textDefaultProps,
  fields: {
    _style: styleField,
    text: { ...richTextField("Text", true), visible: false } as unknown as Field<string>,
  },
  resolveFields: (_data, { fields }) => {
    // text is managed by the Content tab in StyleToolkitField
    const { text: _t, ...rest } = fields as Record<string, unknown>;
    return rest as typeof fields;
  },
  render: TextBlock,
};

const image: ComponentConfig<ImageBlockProps> = {
  label: "Image",
  defaultProps: imageDefaultProps,
  fields: {
    _style: styleField,
    imagePublicId: imageField("Image"),
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
  resolveFields: (_data, { fields }) => {
    // imagePublicId, imageUrl, alt, and fit are all managed by the ImagePanel in StyleToolkitField
    return { _style: (fields as Record<string, unknown>)._style } as typeof fields;
  },
  render: ImageBlock,
};

const button: ComponentConfig<ButtonBlockProps> = {
  label: "Button",
  defaultProps: { ...buttonDefaultProps, size: "md" },
  fields: {
    _style: styleField,
    label: { type: "text", label: "Button label" },
    size: {
      type: "select",
      label: "Size",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
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
  resolveFields: (_data, { fields }) => {
    // label, action, align, and size are managed by StyleToolkitField's Content/Layout tabs
    const { label: _l, action: _a, align: _al, size: _s, ...rest } = fields as Record<string, unknown>;
    return rest as typeof fields;
  },
  render: ButtonBlock,
};

const spacer: ComponentConfig<SpacerBlockProps> = {
  label: "Spacer",
  defaultProps: spacerDefaultProps,
  fields: {
    height: {
      type: "custom",
      label: "Height",
      render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
        <NumberInputRow
          label="Height"
          value={value as number | undefined}
          min={4}
          max={400}
          suffix="px"
          onChange={onChange as (v: number | undefined) => void}
        />
      ),
    } as unknown as Field<number>,
  },
  render: SpacerBlock,
};

const divider: ComponentConfig<DividerBlockProps> = {
  label: "Divider",
  defaultProps: dividerDefaultProps,
  fields: {
    _style: styleField,
    thickness: { type: "number", label: "Thickness (px)", min: 1, max: 12, visible: false } as unknown as Field<number>,
  },
  resolveFields: (_data, { fields }) => {
    // thickness is managed by the DividerPanel in StyleToolkitField
    return { _style: (fields as Record<string, unknown>)._style } as typeof fields;
  },
  render: DividerBlock,
};

const columns: ComponentConfig<ColumnsBlockProps> = {
  label: "Columns",
  defaultProps: {
    ...columnsDefaultProps,
    _style: {
      paddingTop: "1rem",
      paddingRight: "1.5rem",
      paddingBottom: "1rem",
      paddingLeft: "1.5rem",
    },
  },
  fields: {
    _style: styleField,
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
  resolveFields: (_data, { fields }) => {
    const { columns: _c, ...rest } = fields as Record<string, unknown>;
    void _c;
    return rest as typeof fields;
  },
  render: ColumnsBlock,
};

const container: ComponentConfig<ContainerBlockProps> = {
  label: "Container",
  defaultProps: {
    ...containerDefaultProps,
    _style: {
      paddingTop: "1.5rem",
      paddingRight: "1.5rem",
      paddingBottom: "1.5rem",
      paddingLeft: "1.5rem",
    },
  },
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  render: ContainerBlock,
};

export const editorPuckConfig: Config<EditorComponents> = {
  categories: {
    presets: { title: "Preset blocks", components: [...PRESET_BLOCK_KEYS], defaultExpanded: true },
    manual: { title: "Manual blocks", components: [...MANUAL_BLOCK_KEYS], defaultExpanded: false },
  },
  components: {
    HeroPreset: heroPreset,
    AboutPreset: aboutPreset,
    ServicesPreset: servicesPreset,
    CtaPreset: ctaPreset,
    ContactPreset: contactPreset,
    GalleryGridPreset: galleryGridPreset,
    GalleryMasonryPreset: galleryMasonryPreset,
    FeaturedWorkPreset: featuredWorkPreset,
    GalleryGrid: galleryGrid,
    GalleryMasonry: galleryMasonry,
    GalleryCarousel: galleryCarousel,
    FeaturedWork: featuredWork,
    Video: video,
    ContactDetails: contactDetails,
    Heading: heading,
    Text: text,
    Image: image,
    Button: button,
    Spacer: spacer,
    Divider: divider,
    Columns: columns,
    Container: container,
  },
  // No root.render in the editor: Puck wraps blocks in a DropZone div, so
  // blocks are not direct children of any wrapper here — adding root.render
  // breaks DnD position tracking without giving us align-self preview either.
  // The flex-col root lives only in config.ts (production <Render>), where
  // blocks ARE direct children and align-self works correctly.
  root: { fields: {} },
};
