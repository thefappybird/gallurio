/**
 * Client-safe Puck config for the EDITOR canvas.
 *
 * The gallery blocks are now ISOMORPHIC (client-safe) — they render their own
 * `images[]` prop with no DB access. The editor uses the REAL component for
 * true WYSIWYG. All content/layout editing flows through StyleToolkitField.
 *
 * FeaturedWork is now ISOMORPHIC — the editor renders the real component for true
 * WYSIWYG. ContactDetails remains server-only; the editor renders a lightweight Preview.
 *
 * The Video block and the manual primitives (Heading/Text/Image/Button/Spacer/
 * Divider/Columns/Container) are ISOMORPHIC (client-safe), so the editor renders
 * the REAL component and only swaps in editor-friendly fields (StyleToolkit).
 * Their defaultProps are imported directly to guarantee
 * parity.
 *
 * The 8 preset blocks (HeroPreset/AboutPreset/ServicesPreset/CtaPreset/
 * ContactPreset/GalleryGridPreset/GalleryMasonryPreset/FeaturedWorkPreset) are
 * Container-based compositions. They render the REAL ContainerBlock with
 * editor-friendly container fields (style picker + background controls). Their
 * defaultProps come from SECTION_PRESETS.
 *
 * Component `type` keys + field keys MUST match `puckConfig` exactly so data
 * round-trips. A test (editorConfig.test.ts) guards parity.
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import type { Config, ComponentConfig, Field, Fields } from "@measured/puck";
import { SingleImageControl, MultiImageControl } from "./galleryPicker/MediaField";
import type { MediaPickerSelection } from "./galleryPicker/MediaPicker";
import { StyleToolkitField } from "./StyleToolkitField";
import { RootStyleField } from "./RootStyleField";
import type { RootPageStyle } from "./rootStyle";
import { NumberInputRow } from "./toolbarPrimitives";
import { resolveBlockStyle, type BlockStyle } from "./styleToolkit";
import { PRESET_BLOCK_KEYS, MANUAL_BLOCK_KEYS } from "./blockCategories";
// Preset defaultProps
import { SECTION_PRESETS } from "./blocks/sectionPresets";
// Data blocks are SERVER modules (Mongo / node:async_hooks). Import their TYPES
// only — their value defaultProps are inlined below so this CLIENT config never
// drags the server graph into the editor bundle (that breaks the build).
import type { ContactDetailsProps } from "./blocks/ContactDetailsBlock";
import { GalleryGridBlock } from "./blocks/GalleryGridBlock";
import type { GalleryGridProps } from "./blocks/GalleryGridBlock";
import { GalleryMasonryBlock } from "./blocks/GalleryMasonryBlock";
import type { GalleryMasonryProps } from "./blocks/GalleryMasonryBlock";
import { FeaturedWorkBlock, featuredWorkDefaultProps, type FeaturedWorkProps } from "./blocks/FeaturedWorkBlock";

// Inlined copies of the data blocks' defaultProps (kept in sync; the parity
// test compares these against the real server-block defaults).
const galleryGridDefaultProps: GalleryGridProps = { images: [], columns: 3, gap: "normal", backgroundImages: [], bgAnimation: "crossfade", bgSpeed: "medium" };
const galleryMasonryDefaultProps: GalleryMasonryProps = { images: [], columns: 3, gap: "normal", backgroundImages: [], bgAnimation: "crossfade", bgSpeed: "medium" };
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
  GalleryLandingPreset: ContainerBlockProps;
  // Data blocks
  GalleryGrid: GalleryGridProps;
  GalleryMasonry: GalleryMasonryProps;
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
  puck,
}: {
  label: string;
  lines: Array<string | null | undefined>;
  blockStyle?: BlockStyle;
  puck?: { dragRef?: ((element: Element | null) => void) | null };
}) {
  const shown = lines.filter((l): l is string => Boolean(l && l.trim()));
  return (
    <section
      ref={puck?.dragRef ?? undefined}
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

const rootStyleField = {
  type: "custom",
  label: "Page style",
  render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
    <RootStyleField
      value={value as RootPageStyle | undefined}
      onChange={onChange as (v: RootPageStyle) => void}
    />
  ),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as unknown as Field<any>;

// Plain text/textarea field. (Text styling is section-wide via the `_style`
// toolkit — there is no per-text toolbar.) Kept as a helper so block configs
// read uniformly; `multiline` picks textarea.
function richTextField(label: string, multiline = false): Field<string> {
  return { type: multiline ? "textarea" : "text", label } as Field<string>;
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


// ---------------------------------------------------------------------------
// Container fields for the editor — same KEYS as containerFields in manualBlocks,
// but `_style` uses the StyleToolkitField. Animation/layout fields are hidden
// here and managed by StyleToolkitField panels; resolveContainerFields strips them
// from the sidebar so only `_style` + `content` are ever shown.
// ---------------------------------------------------------------------------

const editorContainerFields = {
  _style: styleField,
  bgAnimation: {
    type: "select",
    label: "Background animation",
    visible: false,
    options: [
      { label: "Crossfade", value: "crossfade" },
      { label: "Ken Burns", value: "kenburns" },
      { label: "Slide", value: "slide" },
    ],
  } as unknown as Field<ContainerBlockProps["bgAnimation"]>,
  bgSpeed: {
    type: "select",
    label: "Animation speed",
    visible: false,
    options: [
      { label: "Slow (7s)", value: "slow" },
      { label: "Medium (5s)", value: "medium" },
      { label: "Fast (3s)", value: "fast" },
    ],
  } as unknown as Field<ContainerBlockProps["bgSpeed"]>,
  overlayOpacity: { type: "number", label: "Overlay opacity (0-100)", min: 0, max: 100, visible: false } as unknown as Field<number | undefined>,
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
} as unknown as ComponentConfig<ContainerBlockProps>["fields"];

// ---------------------------------------------------------------------------
// Preset block editor configs — real ContainerBlock render + editor fields +
// SECTION_PRESETS defaultProps for each section.
// ---------------------------------------------------------------------------

// Hides sidebar fields that are managed by the StyleToolkitField Content/Layout tabs.
// The double cast is required because Puck's resolveFields return type is a strict
// branded Fields<T> — we need to go through unknown to avoid the structural mismatch.
function resolveContainerFields(_data: unknown, { fields }: { fields: Record<string, unknown> }) {
  const { bgAnimation: _ba, bgSpeed: _bs, overlayOpacity: _o, alignX: _ax, alignY: _ay, minHeight: _mh, ...rest } = fields;
  return rest;
}
const resolveContainerFieldsTyped = resolveContainerFields as unknown as ComponentConfig<ContainerBlockProps>["resolveFields"];

const heroPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.HeroPreset.label,
  // inline so the section root (which carries colSpan/rowSpan grid placement) is
  // the grid child in the editor canvas, matching the public render. Without it
  // Puck wraps the block and the span lands on the inner section (ignored).
  inline: true,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.HeroPreset.defaultProps,
  render: ContainerBlock,
};

const aboutPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.AboutPreset.label,
  inline: true,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.AboutPreset.defaultProps,
  render: ContainerBlock,
};

const servicesPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.ServicesPreset.label,
  inline: true,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.ServicesPreset.defaultProps,
  render: ContainerBlock,
};

const ctaPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.CtaPreset.label,
  inline: true,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.CtaPreset.defaultProps,
  render: ContainerBlock,
};

const contactPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.ContactPreset.label,
  inline: true,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.ContactPreset.defaultProps,
  render: ContainerBlock,
};

const galleryGridPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.GalleryGridPreset.label,
  inline: true,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.GalleryGridPreset.defaultProps,
  render: ContainerBlock,
};

const galleryMasonryPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.GalleryMasonryPreset.label,
  inline: true,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.GalleryMasonryPreset.defaultProps,
  render: ContainerBlock,
};

const featuredWorkPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.FeaturedWorkPreset.label,
  inline: true,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.FeaturedWorkPreset.defaultProps,
  render: ContainerBlock,
};

const galleryLandingPreset: ComponentConfig<ContainerBlockProps> = {
  label: SECTION_PRESETS.GalleryLandingPreset.label,
  inline: true,
  fields: editorContainerFields,
  resolveFields: resolveContainerFieldsTyped,
  defaultProps: SECTION_PRESETS.GalleryLandingPreset.defaultProps,
  render: ContainerBlock,
  // Editor hint: uploading multiple background images activates the auto-playing
  // carousel/slideshow (ContainerBackgroundControls shows animation controls at
  // images.length >= 2). Stored in metadata so field key parity with the production
  // config is preserved — editor tooling reads this to surface help text.
  metadata: {
    backgroundImagesHint: "Upload multiple background images to turn this into an auto-playing carousel.",
  },
};

// ---------------------------------------------------------------------------
// Gallery data blocks — now ISOMORPHIC. Editor renders the REAL component for
// true WYSIWYG; all content/layout editing flows through the StyleToolkitField
// Content/Layout tabs, so resolveFields strips everything but _style.
// ---------------------------------------------------------------------------

const galleryGrid: ComponentConfig<GalleryGridProps> = {
  label: "Photo Grid",
  inline: true,
  defaultProps: galleryGridDefaultProps,
  // `images` is intentionally absent — the editor drives it via StyleToolkitField
  // (Task 7). Banner fields are hidden (visible: false) and managed by StyleToolkitField;
  // resolveFields strips them so they never appear in the standard Puck sidebar.
  fields: {
    _style: styleField,
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
    backgroundImages: { type: "array", label: "Background images", visible: false, arrayFields: { id: { type: "text", label: "ID" }, publicId: { type: "text", label: "Public ID" } } } as unknown as Field<GalleryGridProps["backgroundImages"]>,
    bgAnimation: { type: "select", label: "BG animation", visible: false, options: [{ label: "Crossfade", value: "crossfade" }, { label: "Ken Burns", value: "kenburns" }, { label: "Slide", value: "slide" }] } as unknown as Field<GalleryGridProps["bgAnimation"]>,
    bgSpeed: { type: "select", label: "BG speed", visible: false, options: [{ label: "Slow", value: "slow" }, { label: "Medium", value: "medium" }, { label: "Fast", value: "fast" }] } as unknown as Field<GalleryGridProps["bgSpeed"]>,
    overlayOpacity: { type: "number", label: "Overlay opacity", visible: false, min: 0, max: 100 } as unknown as Field<number | undefined>,
    minHeight: { type: "select", label: "Min height", visible: false, options: [{ label: "Auto", value: "auto" }, { label: "Short", value: "short" }, { label: "Medium", value: "medium" }, { label: "Tall", value: "tall" }] } as unknown as Field<ContainerHeight | undefined>,
  } as unknown as Fields<GalleryGridProps>,
  resolveFields: (_data, { fields }) => {
    const { backgroundImages: _bi, bgAnimation: _ba, bgSpeed: _bs, overlayOpacity: _o, minHeight: _mh, ...rest } = fields as Record<string, unknown>;
    return rest as typeof fields;
  },
  render: GalleryGridBlock,
};

const galleryMasonry: ComponentConfig<GalleryMasonryProps> = {
  label: "Masonry",
  inline: true,
  defaultProps: galleryMasonryDefaultProps,
  // `images` is intentionally absent — driven by StyleToolkitField (Task 7).
  // Banner fields are hidden (visible: false) and managed by StyleToolkitField.
  fields: {
    _style: styleField,
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
    backgroundImages: { type: "array", label: "Background images", visible: false, arrayFields: { id: { type: "text", label: "ID" }, publicId: { type: "text", label: "Public ID" } } } as unknown as Field<GalleryMasonryProps["backgroundImages"]>,
    bgAnimation: { type: "select", label: "BG animation", visible: false, options: [{ label: "Crossfade", value: "crossfade" }, { label: "Ken Burns", value: "kenburns" }, { label: "Slide", value: "slide" }] } as unknown as Field<GalleryMasonryProps["bgAnimation"]>,
    bgSpeed: { type: "select", label: "BG speed", visible: false, options: [{ label: "Slow", value: "slow" }, { label: "Medium", value: "medium" }, { label: "Fast", value: "fast" }] } as unknown as Field<GalleryMasonryProps["bgSpeed"]>,
    overlayOpacity: { type: "number", label: "Overlay opacity", visible: false, min: 0, max: 100 } as unknown as Field<number | undefined>,
    minHeight: { type: "select", label: "Min height", visible: false, options: [{ label: "Auto", value: "auto" }, { label: "Short", value: "short" }, { label: "Medium", value: "medium" }, { label: "Tall", value: "tall" }] } as unknown as Field<ContainerHeight | undefined>,
  } as unknown as Fields<GalleryMasonryProps>,
  resolveFields: (_data, { fields }) => {
    const { backgroundImages: _bi, bgAnimation: _ba, bgSpeed: _bs, overlayOpacity: _o, minHeight: _mh, ...rest } = fields as Record<string, unknown>;
    return rest as typeof fields;
  },
  render: GalleryMasonryBlock,
};

const featuredWork: ComponentConfig<FeaturedWorkProps> = {
  label: "Highlights",
  inline: true,
  defaultProps: featuredWorkDefaultProps,
  // `collections` is intentionally absent — driven by StyleToolkitField Content tab.
  // Banner fields are hidden (visible: false) and managed by StyleToolkitField.
  fields: {
    _style: styleField,
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "2 columns", value: 2 },
        { label: "3 columns", value: 3 },
        { label: "4 columns", value: 4 },
      ],
    } as Field<2 | 3 | 4>,
    backgroundImages: { type: "array", label: "Background images", visible: false, arrayFields: { id: { type: "text", label: "ID" }, publicId: { type: "text", label: "Public ID" } } } as unknown as Field<FeaturedWorkProps["backgroundImages"]>,
    bgAnimation: { type: "select", label: "BG animation", visible: false, options: [{ label: "Crossfade", value: "crossfade" }, { label: "Ken Burns", value: "kenburns" }, { label: "Slide", value: "slide" }] } as unknown as Field<FeaturedWorkProps["bgAnimation"]>,
    bgSpeed: { type: "select", label: "BG speed", visible: false, options: [{ label: "Slow", value: "slow" }, { label: "Medium", value: "medium" }, { label: "Fast", value: "fast" }] } as unknown as Field<FeaturedWorkProps["bgSpeed"]>,
    overlayOpacity: { type: "number", label: "Overlay opacity", visible: false, min: 0, max: 100 } as unknown as Field<number | undefined>,
    minHeight: { type: "select", label: "Min height", visible: false, options: [{ label: "Auto", value: "auto" }, { label: "Short", value: "short" }, { label: "Medium", value: "medium" }, { label: "Tall", value: "tall" }] } as unknown as Field<ContainerHeight | undefined>,
  } as unknown as Fields<FeaturedWorkProps>,
  resolveFields: (_data, { fields }) => {
    const { backgroundImages: _bi, bgAnimation: _ba, bgSpeed: _bs, overlayOpacity: _o, minHeight: _mh, ...rest } = fields as Record<string, unknown>;
    return rest as typeof fields;
  },
  render: FeaturedWorkBlock,
};

// ---------------------------------------------------------------------------
// Video — isomorphic; editor renders the real component with editor fields.
// ---------------------------------------------------------------------------

const video: ComponentConfig<VideoBlockProps> = {
  label: "Video",
  inline: true,
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
  inline: true,
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
  render: ({ _style, showEmail, showPhone, showAddress, showSocials, puck }) => (
    <Preview
      label="Contact Details"
      lines={[
        [showEmail && "Email", showPhone && "Phone", showAddress && "Address", showSocials && "Socials"]
          .filter(Boolean)
          .join(" · ") || "All fields hidden",
      ]}
      blockStyle={_style}
      puck={puck}
    />
  ),
};

// ---------------------------------------------------------------------------
// Manual primitives — isomorphic; editor renders the real component.
// ---------------------------------------------------------------------------

const heading: ComponentConfig<HeadingBlockProps> = {
  label: "Heading",
  inline: true,
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
  inline: true,
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
  inline: true,
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
  inline: true,
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
  inline: true,
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
  inline: true,
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
  inline: true,
  defaultProps: {
    ...columnsDefaultProps,
  },
  fields: {
    _style: styleField,
    columns: {
      type: "number",
      label: "Columns",
      min: 1,
      max: 6,
    } as Field<number>,
    rows: { type: "number", label: "Rows", min: 1, max: 6 } as Field<number | undefined>,
    content: { type: "slot" },
  },
  resolveFields: (_data, { fields }) => {
    const { columns: _c, rows: _r, ...rest } = fields as Record<string, unknown>;
    void _c; void _r;
    return rest as typeof fields;
  },
  render: ColumnsBlock,
};

const container: ComponentConfig<ContainerBlockProps> = {
  label: "Container",
  inline: true,
  defaultProps: {
    ...containerDefaultProps,
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
    GalleryLandingPreset: galleryLandingPreset,
    GalleryGrid: galleryGrid,
    GalleryMasonry: galleryMasonry,
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
  root: { fields: { _rootStyle: rootStyleField } },
};
