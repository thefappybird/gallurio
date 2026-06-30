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
 * Editor chrome is fully localized (Phase D). All block labels, category titles,
 * field labels, and option labels are translated via createEditorConfig(t).
 * Puck built-in UI strings (drag handles, empty-slot placeholder, "Insert" drawer
 * header) cannot be localized through Puck's public API — see Phase D report.
 */

import type { Config, ComponentConfig, Field, Fields } from "@measured/puck";
import { SingleImageControl, MultiImageControl } from "./galleryPicker/MediaField";
import type { MediaPickerSelection } from "./galleryPicker/MediaPicker";
import { StyleToolkitField } from "./StyleToolkitField";
import { RootStyleField } from "./RootStyleField";
import type { RootPageStyle } from "./rootStyle";
import { NumberInputRow } from "./toolbarPrimitives";
import {
  resolveBlockStyle,
  buildContactLabelStyle,
  buildContactValueStyle,
  buildContactIconColor,
  buildContactIconSize,
  contactGridTemplate,
  type BlockStyle,
} from "./styleToolkit";
import { SocialIconLink } from "./blocks/SocialIconLink";
import { PRESET_BLOCK_KEYS, MANUAL_BLOCK_KEYS } from "./blockCategories";
// Preset defaultProps
import { SECTION_PRESETS } from "./blocks/sectionPresets";
// Data blocks are SERVER modules (Mongo / node:async_hooks). Import their TYPES
// only — their value defaultProps are inlined below so this CLIENT config never
// drags the server graph into the editor bundle (that breaks the build).
// normalizeSocialUrl is a pure utility with no server-only deps — safe to import.
import { normalizeSocialUrl, type ContactDetailsProps } from "./blocks/ContactDetailsBlock";
import { GalleryGridBlock, galleryGridDefaultProps } from "./blocks/GalleryGridBlock";
import type { GalleryGridProps } from "./blocks/GalleryGridBlock";
import { GalleryMasonryBlock, galleryMasonryDefaultProps } from "./blocks/GalleryMasonryBlock";
import type { GalleryMasonryProps } from "./blocks/GalleryMasonryBlock";
import { FeaturedWorkBlock, featuredWorkDefaultProps, type FeaturedWorkProps } from "./blocks/FeaturedWorkBlock";
const contactDetailsDefaultProps: ContactDetailsProps = {};
// Isomorphic blocks — safe to import the real component + defaults into the client.
import {
  VideoBlock,
  videoDefaultProps,
  type VideoBlockProps,
} from "./blocks/VideoBlock";
import { EditorContainerAnchor } from "./blocks/EditorContainerAnchor";
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
  containerAnchorDefaultProps,
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
  type ContainerAnchorProps,
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
  ContainerAnchor: ContainerAnchorProps;
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
// Shared field helpers (pure functions — labels are passed as arguments)
// ---------------------------------------------------------------------------

// Plain text/textarea field. (Text styling is section-wide via the `_style`
// toolkit — there is no per-text toolbar.) Kept as a helper so block configs
// read uniformly; `multiline` picks textarea. `contentEditable` enables Puck's
// on-canvas inline editing alongside the Content-tab input (the field stays
// hidden from the sidebar via `visible:false`/resolveFields — inline editing is
// independent of sidebar visibility).
function richTextField(label: string, multiline = false): Field<string> {
  return { type: multiline ? "textarea" : "text", label, contentEditable: true } as Field<string>;
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
// Pure field-visibility resolver — hides sidebar fields managed by
// StyleToolkitField panels so only `_style` + `content` ever appear.
// ---------------------------------------------------------------------------

// Hides sidebar fields that are managed by the StyleToolkitField Content/Layout tabs.
// The double cast is required because Puck's resolveFields return type is a strict
// branded Fields<T> — we need to go through unknown to avoid the structural mismatch.
function resolveContainerFields(_data: unknown, { fields }: { fields: Record<string, unknown> }) {
  const { bgAnimation: _ba, bgSpeed: _bs, overlayOpacity: _o, alignX: _ax, alignY: _ay, minHeight: _mh, ...rest } = fields;
  return rest;
}
const resolveContainerFieldsTyped = resolveContainerFields as unknown as ComponentConfig<ContainerBlockProps>["resolveFields"];

// ---------------------------------------------------------------------------
// Anchor presence: resolveData ensures exactly one ContainerAnchor exists as
// the FIRST slot child. Height is no longer maintained here — EditorContainerAnchor
// computes its own height reactively from the parent's live children via
// usePuckStore, avoiding the missing "move" trigger in Puck 0.20.2's
// ResolveDataTrigger (only "insert"|"replace"|"load"|"force" are available).
// IDEMPOTENCY: returns the same `data` reference if an anchor already leads the
// slot so we never produce a spurious resolve → change → resolve loop.
// ---------------------------------------------------------------------------

type _SlotItem = { type: string; props: Record<string, unknown> };

function resolveContainerData(data: unknown) {
  const d = data as {
    props: { id: string; content: _SlotItem[] };
  };
  const content: _SlotItem[] = d.props.content ?? [];

  const isAnchor = (item: _SlotItem) => item.type === "ContainerAnchor";
  const realChildren = content.filter((item) => !isAnchor(item));

  // Idempotency: if a correctly-formed anchor already leads the slot, nothing to do.
  // The id check is required: drafts saved before the --anchor convention was
  // introduced may carry an anchor whose id matches the container id (no suffix).
  // Passing those through unchanged causes a selection-bounce useEffect loop
  // (parentId === id → selectedItem never escapes the guard → infinite setState).
  const first = content[0];
  if (
    first !== undefined &&
    isAnchor(first) &&
    content.length === realChildren.length + 1 &&
    (first.props as { id?: string }).id === `${d.props.id}--anchor`
  ) {
    return data;
  }

  // Height is intentionally 0 — EditorContainerAnchor computes it reactively.
  const anchor: _SlotItem = {
    type: "ContainerAnchor",
    props: {
      id: `${d.props.id}--anchor`,
      height: 0,
    },
  };

  return {
    ...d,
    props: { ...d.props, content: [anchor, ...realChildren] },
  };
}
const resolveContainerDataTyped =
  resolveContainerData as unknown as ComponentConfig<ContainerBlockProps>["resolveData"];

// ---------------------------------------------------------------------------
// Translation type. The factory accepts the same `t` function returned by
// next-intl's useTranslations("app.pageBuilder.editor"). The English fallback
// is a static map — it keeps editorPuckConfig (used in tests) unchanged.
// ---------------------------------------------------------------------------

export type PuckTranslate = (key: string) => string;

/** English fallback — keyed under app.pageBuilder.editor.puckConfig.* */
const ENGLISH_PUCK_T: Record<string, string> = {
  "puckConfig.categories.presets": "Preset blocks",
  "puckConfig.categories.manual": "Manual blocks",
  "puckConfig.blocks.heroPreset": "Hero",
  "puckConfig.blocks.aboutPreset": "About",
  "puckConfig.blocks.servicesPreset": "Services",
  "puckConfig.blocks.ctaPreset": "Call to action",
  "puckConfig.blocks.contactPreset": "Contact",
  "puckConfig.blocks.galleryGridPreset": "Gallery Grid",
  "puckConfig.blocks.galleryMasonryPreset": "Gallery Masonry",
  "puckConfig.blocks.featuredWorkPreset": "Featured Work",
  "puckConfig.blocks.galleryLandingPreset": "Gallery landing",
  "puckConfig.blocks.galleryGrid": "Photo Grid",
  "puckConfig.blocks.galleryMasonry": "Masonry",
  "puckConfig.blocks.featuredWork": "Highlights",
  "puckConfig.blocks.video": "Video",
  "puckConfig.blocks.contactDetails": "Contact Details",
  "puckConfig.blocks.heading": "Heading",
  "puckConfig.blocks.text": "Text",
  "puckConfig.blocks.image": "Image",
  "puckConfig.blocks.button": "Button",
  "puckConfig.blocks.spacer": "Spacer",
  "puckConfig.blocks.divider": "Divider",
  "puckConfig.blocks.columns": "Columns",
  "puckConfig.blocks.container": "Container",
  "puckConfig.fields.style": "Style",
  "puckConfig.fields.pageStyle": "Page style",
  "puckConfig.fields.bgAnimation": "Background animation",
  "puckConfig.fields.bgAnimationShort": "BG animation",
  "puckConfig.fields.bgSpeed": "Animation speed",
  "puckConfig.fields.bgSpeedShort": "BG speed",
  "puckConfig.fields.overlayOpacity": "Overlay opacity (0-100)",
  "puckConfig.fields.minHeight": "Min height",
  "puckConfig.fields.alignX": "Horizontal align",
  "puckConfig.fields.alignY": "Vertical align",
  "puckConfig.fields.backgroundImages": "Background images",
  "puckConfig.fields.headingText": "Heading text",
  "puckConfig.fields.headingLevel": "Level",
  "puckConfig.fields.textContent": "Text",
  "puckConfig.fields.videoUrl": "YouTube or Vimeo URL",
  "puckConfig.fields.videoDescription": "Description (optional)",
  "puckConfig.fields.videoFooter": "Footer (optional)",
  "puckConfig.fields.imageField": "Image",
  "puckConfig.fields.imageUrl": "Image URL (fallback)",
  "puckConfig.fields.imageAlt": "Alt text",
  "puckConfig.fields.imageFit": "Fit",
  "puckConfig.fields.buttonLabel": "Button label",
  "puckConfig.fields.buttonSize": "Size",
  "puckConfig.fields.buttonAction": "Action",
  "puckConfig.fields.buttonAlign": "Alignment",
  "puckConfig.fields.spacerHeight": "Height",
  "puckConfig.fields.dividerThickness": "Thickness (px)",
  "puckConfig.fields.columnsCount": "Columns",
  "puckConfig.fields.rowsCount": "Rows",
  "puckConfig.options.bgAnimation.crossfade": "Crossfade",
  "puckConfig.options.bgAnimation.kenburns": "Ken Burns",
  "puckConfig.options.bgAnimation.slide": "Slide",
  "puckConfig.options.bgSpeed.slow": "Slow (7s)",
  "puckConfig.options.bgSpeed.medium": "Medium (5s)",
  "puckConfig.options.bgSpeed.fast": "Fast (3s)",
  "puckConfig.options.bgSpeedShort.slow": "Slow",
  "puckConfig.options.bgSpeedShort.medium": "Medium",
  "puckConfig.options.bgSpeedShort.fast": "Fast",
  "puckConfig.options.minHeight.auto": "Auto",
  "puckConfig.options.minHeight.short": "Short (40vh)",
  "puckConfig.options.minHeight.medium": "Medium (60vh)",
  "puckConfig.options.minHeight.tall": "Tall (80vh)",
  "puckConfig.options.minHeightShort.auto": "Auto",
  "puckConfig.options.minHeightShort.short": "Short",
  "puckConfig.options.minHeightShort.medium": "Medium",
  "puckConfig.options.minHeightShort.tall": "Tall",
  "puckConfig.options.alignX.left": "Left",
  "puckConfig.options.alignX.center": "Center",
  "puckConfig.options.alignX.right": "Right",
  "puckConfig.options.alignY.top": "Top",
  "puckConfig.options.alignY.center": "Center",
  "puckConfig.options.alignY.bottom": "Bottom",
  "puckConfig.options.headingLevel.h1": "Display",
  "puckConfig.options.headingLevel.h2": "Title",
  "puckConfig.options.headingLevel.h3": "Heading",
  "puckConfig.options.headingLevel.h4": "Subheading",
  "puckConfig.options.headingLevel.h5": "Caption",
  "puckConfig.options.headingLevel.h6": "Label",
  "puckConfig.options.imageFit.cover": "Cover",
  "puckConfig.options.imageFit.contain": "Contain",
  "puckConfig.options.buttonSize.sm": "Small",
  "puckConfig.options.buttonSize.md": "Medium",
  "puckConfig.options.buttonSize.lg": "Large",
  "puckConfig.options.buttonAction.openContact": "Open contact form",
  "puckConfig.options.buttonAction.goToGallery": "Go to Gallery page",
  "puckConfig.options.buttonAlign.left": "Left",
  "puckConfig.options.buttonAlign.center": "Center",
  "puckConfig.options.buttonAlign.right": "Right",
};

function englishPuckT(key: string): string {
  return ENGLISH_PUCK_T[key] ?? key;
}

// ---------------------------------------------------------------------------
// Factory — builds the editor Puck config with translated labels.
// Called inside EditorShell via useMemo(() => createEditorConfig(t), [t])
// where t = useTranslations("app.pageBuilder.editor").
// ---------------------------------------------------------------------------

export function createEditorConfig(t: PuckTranslate): Config<EditorComponents> {
  // ---- Shared fields -------------------------------------------------------

  const styleField = {
    type: "custom",
    label: t("puckConfig.fields.style"),
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
    label: t("puckConfig.fields.pageStyle"),
    render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
      <RootStyleField
        value={value as RootPageStyle | undefined}
        onChange={onChange as (v: RootPageStyle) => void}
      />
    ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as Field<any>;

  // ---- Container fields (used by Container + all preset blocks) -----------

  const editorContainerFields = {
    _style: styleField,
    bgAnimation: {
      type: "select",
      label: t("puckConfig.fields.bgAnimation"),
      visible: false,
      options: [
        { label: t("puckConfig.options.bgAnimation.crossfade"), value: "crossfade" },
        { label: t("puckConfig.options.bgAnimation.kenburns"), value: "kenburns" },
        { label: t("puckConfig.options.bgAnimation.slide"), value: "slide" },
      ],
    } as unknown as Field<ContainerBlockProps["bgAnimation"]>,
    bgSpeed: {
      type: "select",
      label: t("puckConfig.fields.bgSpeed"),
      visible: false,
      options: [
        { label: t("puckConfig.options.bgSpeed.slow"), value: "slow" },
        { label: t("puckConfig.options.bgSpeed.medium"), value: "medium" },
        { label: t("puckConfig.options.bgSpeed.fast"), value: "fast" },
      ],
    } as unknown as Field<ContainerBlockProps["bgSpeed"]>,
    overlayOpacity: { type: "number", label: t("puckConfig.fields.overlayOpacity"), min: 0, max: 100, visible: false } as unknown as Field<number | undefined>,
    minHeight: {
      type: "select",
      label: t("puckConfig.fields.minHeight"),
      options: [
        { label: t("puckConfig.options.minHeight.auto"), value: "auto" },
        { label: t("puckConfig.options.minHeight.short"), value: "short" },
        { label: t("puckConfig.options.minHeight.medium"), value: "medium" },
        { label: t("puckConfig.options.minHeight.tall"), value: "tall" },
      ],
    } as unknown as Field<ContainerHeight | undefined>,
    alignX: {
      type: "select",
      label: t("puckConfig.fields.alignX"),
      visible: false,
      options: [
        { label: t("puckConfig.options.alignX.left"), value: "left" },
        { label: t("puckConfig.options.alignX.center"), value: "center" },
        { label: t("puckConfig.options.alignX.right"), value: "right" },
      ],
    } as unknown as Field<ContainerAlignX | undefined>,
    alignY: {
      type: "select",
      label: t("puckConfig.fields.alignY"),
      visible: false,
      options: [
        { label: t("puckConfig.options.alignY.top"), value: "top" },
        { label: t("puckConfig.options.alignY.center"), value: "center" },
        { label: t("puckConfig.options.alignY.bottom"), value: "bottom" },
      ],
    } as unknown as Field<ContainerAlignY | undefined>,
    content: { type: "slot" },
  } as unknown as ComponentConfig<ContainerBlockProps>["fields"];

  // ---- Preset block editor configs ----------------------------------------

  const heroPreset: ComponentConfig<ContainerBlockProps> = {
    label: t("puckConfig.blocks.heroPreset"),
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
    label: t("puckConfig.blocks.aboutPreset"),
    inline: true,
    fields: editorContainerFields,
    resolveFields: resolveContainerFieldsTyped,
    defaultProps: SECTION_PRESETS.AboutPreset.defaultProps,
    render: ContainerBlock,
  };

  const servicesPreset: ComponentConfig<ContainerBlockProps> = {
    label: t("puckConfig.blocks.servicesPreset"),
    inline: true,
    fields: editorContainerFields,
    resolveFields: resolveContainerFieldsTyped,
    defaultProps: SECTION_PRESETS.ServicesPreset.defaultProps,
    render: ContainerBlock,
  };

  const ctaPreset: ComponentConfig<ContainerBlockProps> = {
    label: t("puckConfig.blocks.ctaPreset"),
    inline: true,
    fields: editorContainerFields,
    resolveFields: resolveContainerFieldsTyped,
    defaultProps: SECTION_PRESETS.CtaPreset.defaultProps,
    render: ContainerBlock,
  };

  const contactPreset: ComponentConfig<ContainerBlockProps> = {
    label: t("puckConfig.blocks.contactPreset"),
    inline: true,
    fields: editorContainerFields,
    resolveFields: resolveContainerFieldsTyped,
    defaultProps: SECTION_PRESETS.ContactPreset.defaultProps,
    render: ContainerBlock,
  };

  const galleryGridPreset: ComponentConfig<ContainerBlockProps> = {
    label: t("puckConfig.blocks.galleryGridPreset"),
    inline: true,
    fields: editorContainerFields,
    resolveFields: resolveContainerFieldsTyped,
    defaultProps: SECTION_PRESETS.GalleryGridPreset.defaultProps,
    render: ContainerBlock,
  };

  const galleryMasonryPreset: ComponentConfig<ContainerBlockProps> = {
    label: t("puckConfig.blocks.galleryMasonryPreset"),
    inline: true,
    fields: editorContainerFields,
    resolveFields: resolveContainerFieldsTyped,
    defaultProps: SECTION_PRESETS.GalleryMasonryPreset.defaultProps,
    render: ContainerBlock,
  };

  const featuredWorkPreset: ComponentConfig<ContainerBlockProps> = {
    label: t("puckConfig.blocks.featuredWorkPreset"),
    inline: true,
    fields: editorContainerFields,
    resolveFields: resolveContainerFieldsTyped,
    defaultProps: SECTION_PRESETS.FeaturedWorkPreset.defaultProps,
    render: ContainerBlock,
  };

  const galleryLandingPreset: ComponentConfig<ContainerBlockProps> = {
    label: t("puckConfig.blocks.galleryLandingPreset"),
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

  // ---- Gallery data blocks -------------------------------------------------

  const galleryGrid: ComponentConfig<GalleryGridProps> = {
    label: t("puckConfig.blocks.galleryGrid"),
    inline: true,
    defaultProps: galleryGridDefaultProps,
    // `images` is intentionally absent — the editor drives it via StyleToolkitField.
    // columns/gap moved to _style.galleryColumns/_style.galleryGap (Layout tab Gallery section).
    // Banner fields are hidden (visible: false) and managed by StyleToolkitField;
    // resolveFields strips them so they never appear in the standard Puck sidebar.
    fields: {
      _style: styleField,
      backgroundImages: { type: "array", label: t("puckConfig.fields.backgroundImages"), visible: false, arrayFields: { id: { type: "text", label: "ID" }, publicId: { type: "text", label: "Public ID" } } } as unknown as Field<GalleryGridProps["backgroundImages"]>,
      bgAnimation: { type: "select", label: t("puckConfig.fields.bgAnimationShort"), visible: false, options: [{ label: t("puckConfig.options.bgAnimation.crossfade"), value: "crossfade" }, { label: t("puckConfig.options.bgAnimation.kenburns"), value: "kenburns" }, { label: t("puckConfig.options.bgAnimation.slide"), value: "slide" }] } as unknown as Field<GalleryGridProps["bgAnimation"]>,
      bgSpeed: { type: "select", label: t("puckConfig.fields.bgSpeedShort"), visible: false, options: [{ label: t("puckConfig.options.bgSpeedShort.slow"), value: "slow" }, { label: t("puckConfig.options.bgSpeedShort.medium"), value: "medium" }, { label: t("puckConfig.options.bgSpeedShort.fast"), value: "fast" }] } as unknown as Field<GalleryGridProps["bgSpeed"]>,
      overlayOpacity: { type: "number", label: t("puckConfig.fields.overlayOpacity"), visible: false, min: 0, max: 100 } as unknown as Field<number | undefined>,
      minHeight: { type: "select", label: t("puckConfig.fields.minHeight"), visible: false, options: [{ label: t("puckConfig.options.minHeightShort.auto"), value: "auto" }, { label: t("puckConfig.options.minHeightShort.short"), value: "short" }, { label: t("puckConfig.options.minHeightShort.medium"), value: "medium" }, { label: t("puckConfig.options.minHeightShort.tall"), value: "tall" }] } as unknown as Field<ContainerHeight | undefined>,
    } as unknown as Fields<GalleryGridProps>,
    resolveFields: (_data, { fields }) => {
      const { backgroundImages: _bi, bgAnimation: _ba, bgSpeed: _bs, overlayOpacity: _o, minHeight: _mh, ...rest } = fields as Record<string, unknown>;
      return rest as typeof fields;
    },
    render: GalleryGridBlock,
  };

  const galleryMasonry: ComponentConfig<GalleryMasonryProps> = {
    label: t("puckConfig.blocks.galleryMasonry"),
    inline: true,
    defaultProps: galleryMasonryDefaultProps,
    // `images` is intentionally absent — driven by StyleToolkitField.
    // columns/gap moved to _style.galleryColumns/_style.galleryGap (Layout tab Gallery section).
    // Banner fields are hidden (visible: false) and managed by StyleToolkitField.
    fields: {
      _style: styleField,
      backgroundImages: { type: "array", label: t("puckConfig.fields.backgroundImages"), visible: false, arrayFields: { id: { type: "text", label: "ID" }, publicId: { type: "text", label: "Public ID" } } } as unknown as Field<GalleryMasonryProps["backgroundImages"]>,
      bgAnimation: { type: "select", label: t("puckConfig.fields.bgAnimationShort"), visible: false, options: [{ label: t("puckConfig.options.bgAnimation.crossfade"), value: "crossfade" }, { label: t("puckConfig.options.bgAnimation.kenburns"), value: "kenburns" }, { label: t("puckConfig.options.bgAnimation.slide"), value: "slide" }] } as unknown as Field<GalleryMasonryProps["bgAnimation"]>,
      bgSpeed: { type: "select", label: t("puckConfig.fields.bgSpeedShort"), visible: false, options: [{ label: t("puckConfig.options.bgSpeedShort.slow"), value: "slow" }, { label: t("puckConfig.options.bgSpeedShort.medium"), value: "medium" }, { label: t("puckConfig.options.bgSpeedShort.fast"), value: "fast" }] } as unknown as Field<GalleryMasonryProps["bgSpeed"]>,
      overlayOpacity: { type: "number", label: t("puckConfig.fields.overlayOpacity"), visible: false, min: 0, max: 100 } as unknown as Field<number | undefined>,
      minHeight: { type: "select", label: t("puckConfig.fields.minHeight"), visible: false, options: [{ label: t("puckConfig.options.minHeightShort.auto"), value: "auto" }, { label: t("puckConfig.options.minHeightShort.short"), value: "short" }, { label: t("puckConfig.options.minHeightShort.medium"), value: "medium" }, { label: t("puckConfig.options.minHeightShort.tall"), value: "tall" }] } as unknown as Field<ContainerHeight | undefined>,
    } as unknown as Fields<GalleryMasonryProps>,
    resolveFields: (_data, { fields }) => {
      const { backgroundImages: _bi, bgAnimation: _ba, bgSpeed: _bs, overlayOpacity: _o, minHeight: _mh, ...rest } = fields as Record<string, unknown>;
      return rest as typeof fields;
    },
    render: GalleryMasonryBlock,
  };

  const featuredWork: ComponentConfig<FeaturedWorkProps> = {
    label: t("puckConfig.blocks.featuredWork"),
    inline: true,
    defaultProps: featuredWorkDefaultProps,
    // `collections` is intentionally absent — driven by StyleToolkitField Content tab.
    // columns moved to _style.galleryColumns (Layout tab Gallery section).
    // Banner fields are hidden (visible: false) and managed by StyleToolkitField.
    fields: {
      _style: styleField,
      backgroundImages: { type: "array", label: t("puckConfig.fields.backgroundImages"), visible: false, arrayFields: { id: { type: "text", label: "ID" }, publicId: { type: "text", label: "Public ID" } } } as unknown as Field<FeaturedWorkProps["backgroundImages"]>,
      bgAnimation: { type: "select", label: t("puckConfig.fields.bgAnimationShort"), visible: false, options: [{ label: t("puckConfig.options.bgAnimation.crossfade"), value: "crossfade" }, { label: t("puckConfig.options.bgAnimation.kenburns"), value: "kenburns" }, { label: t("puckConfig.options.bgAnimation.slide"), value: "slide" }] } as unknown as Field<FeaturedWorkProps["bgAnimation"]>,
      bgSpeed: { type: "select", label: t("puckConfig.fields.bgSpeedShort"), visible: false, options: [{ label: t("puckConfig.options.bgSpeedShort.slow"), value: "slow" }, { label: t("puckConfig.options.bgSpeedShort.medium"), value: "medium" }, { label: t("puckConfig.options.bgSpeedShort.fast"), value: "fast" }] } as unknown as Field<FeaturedWorkProps["bgSpeed"]>,
      overlayOpacity: { type: "number", label: t("puckConfig.fields.overlayOpacity"), visible: false, min: 0, max: 100 } as unknown as Field<number | undefined>,
      minHeight: { type: "select", label: t("puckConfig.fields.minHeight"), visible: false, options: [{ label: t("puckConfig.options.minHeightShort.auto"), value: "auto" }, { label: t("puckConfig.options.minHeightShort.short"), value: "short" }, { label: t("puckConfig.options.minHeightShort.medium"), value: "medium" }, { label: t("puckConfig.options.minHeightShort.tall"), value: "tall" }] } as unknown as Field<ContainerHeight | undefined>,
    } as unknown as Fields<FeaturedWorkProps>,
    resolveFields: (_data, { fields }) => {
      const { backgroundImages: _bi, bgAnimation: _ba, bgSpeed: _bs, overlayOpacity: _o, minHeight: _mh, ...rest } = fields as Record<string, unknown>;
      return rest as typeof fields;
    },
    render: FeaturedWorkBlock,
  };

  // ---- Video ---------------------------------------------------------------

  const video: ComponentConfig<VideoBlockProps> = {
    label: t("puckConfig.blocks.video"),
    inline: true,
    defaultProps: videoDefaultProps,
    fields: {
      _style: styleField,
      description: { ...richTextField(t("puckConfig.fields.videoDescription"), true), visible: false } as unknown as Field<string>,
      videoUrl: { type: "text", label: t("puckConfig.fields.videoUrl"), visible: false } as unknown as Field<string>,
      footer: { ...richTextField(t("puckConfig.fields.videoFooter"), true), visible: false } as unknown as Field<string>,
    },
    resolveFields: (_data, { fields }) => {
      // videoUrl, description, and footer are managed by the Content tab in StyleToolkitField
      const { videoUrl: _v, description: _d, footer: _f, ...rest } = fields as Record<string, unknown>;
      return rest as typeof fields;
    },
    render: VideoBlock,
  };

  // ---- ContactDetails (server-only; editor renders a Preview) -------------

  const contactDetails: ComponentConfig<ContactDetailsProps> = {
    label: t("puckConfig.blocks.contactDetails"),
    inline: true,
    defaultProps: contactDetailsDefaultProps,
    fields: {
      _style: styleField,
    },
    resolveFields: (_data, { fields }) => {
      return { _style: (fields as Record<string, unknown>)._style } as typeof fields;
    },
    render: ({ _style, columns, email, phone, address, instagram, facebook, tiktok, website, puck }) => {
      // WYSIWYG canvas: render the actual contact rows using prop values so the canvas
      // reflects what the user typed in the Content tab. When all fields are blank
      // the workspace contact data fills in at runtime; show a placeholder here.
      // No confirmMessage passed → SocialIconLink clicks are no-ops in the editor.

      // Pre-normalize social hrefs so we match production SocialsRow exactly
      // (skips invalid URLs, avoids double-prefixing full https:// values).
      const igHref = instagram ? normalizeSocialUrl("instagram", instagram) : null;
      const fbHref = facebook ? normalizeSocialUrl("facebook", facebook) : null;
      const ttHref = tiktok ? normalizeSocialUrl("tiktok", tiktok) : null;
      const wsHref = website ? normalizeSocialUrl("website", website) : null;
      const hasSocials = !!(igHref || fbHref || ttHref || wsHref);
      const hasAny = email || phone || address || hasSocials;
      const rowStyle = { display: "flex", flexDirection: "column" as const, gap: "0.125rem" };
      const labelStyle = buildContactLabelStyle(_style);
      const valueStyle = buildContactValueStyle(_style);
      const iconColor = buildContactIconColor(_style);
      const iconSize = buildContactIconSize(_style);
      // Mirror SocialsRow: default to center when valueAlign is unset.
      const iconJustify =
        _style?.valueAlign === "left" ? "flex-start" :
        _style?.valueAlign === "right" ? "flex-end" :
        "center";
      return (
        <dl
          ref={puck?.dragRef ?? undefined}
          data-block="contact-details"
          style={{
            display: "grid",
            gridTemplateColumns: contactGridTemplate(columns),
            gap: "0.875rem",
            margin: 0,
            padding: "0.5rem 0",
            fontFamily: "var(--pf-font-body)",
            color: "var(--pf-color-fg)",
            ...resolveBlockStyle(_style),
          }}
        >
          {email && (
            <div style={rowStyle}>
              <dt style={labelStyle}>Email</dt>
              <dd style={{ ...valueStyle, textDecoration: "none" }}>{email}</dd>
            </div>
          )}
          {phone && (
            <div style={rowStyle}>
              <dt style={labelStyle}>Phone</dt>
              <dd style={{ ...valueStyle, textDecoration: "none" }}>{phone}</dd>
            </div>
          )}
          {address && (
            <div style={rowStyle}>
              <dt style={labelStyle}>Address</dt>
              <dd style={valueStyle}>{address}</dd>
            </div>
          )}
          {hasSocials && (
            <div style={rowStyle}>
              <dt style={labelStyle}>Follow</dt>
              <dd style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "0.875rem", color: iconColor, justifyContent: iconJustify }}>
                {igHref && <SocialIconLink href={igHref} platform="instagram" size={iconSize} label="Instagram" />}
                {fbHref && <SocialIconLink href={fbHref} platform="facebook" size={iconSize} label="Facebook" />}
                {ttHref && <SocialIconLink href={ttHref} platform="tiktok" size={iconSize} label="TikTok" />}
                {wsHref && <SocialIconLink href={wsHref} platform="website" size={iconSize} label="Website" />}
              </dd>
            </div>
          )}
          {!hasAny && (
            <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.5, fontFamily: "var(--pf-font-body)" }}>
              Workspace contact details
            </p>
          )}
        </dl>
      );
    },
  };

  // ---- Manual primitives ---------------------------------------------------

  const heading: ComponentConfig<HeadingBlockProps> = {
    label: t("puckConfig.blocks.heading"),
    inline: true,
    defaultProps: headingDefaultProps,
    fields: {
      _style: styleField,
      text: { ...richTextField(t("puckConfig.fields.headingText")), visible: false } as unknown as Field<string>,
      level: {
        type: "select",
        label: t("puckConfig.fields.headingLevel"),
        options: [
          { label: t("puckConfig.options.headingLevel.h1"), value: "h1" },
          { label: t("puckConfig.options.headingLevel.h2"), value: "h2" },
          { label: t("puckConfig.options.headingLevel.h3"), value: "h3" },
          { label: t("puckConfig.options.headingLevel.h4"), value: "h4" },
          { label: t("puckConfig.options.headingLevel.h5"), value: "h5" },
          { label: t("puckConfig.options.headingLevel.h6"), value: "h6" },
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
    label: t("puckConfig.blocks.text"),
    inline: true,
    defaultProps: textDefaultProps,
    fields: {
      _style: styleField,
      text: { ...richTextField(t("puckConfig.fields.textContent"), true), visible: false } as unknown as Field<string>,
    },
    resolveFields: (_data, { fields }) => {
      // text is managed by the Content tab in StyleToolkitField
      const { text: _t, ...rest } = fields as Record<string, unknown>;
      return rest as typeof fields;
    },
    render: TextBlock,
  };

  const image: ComponentConfig<ImageBlockProps> = {
    label: t("puckConfig.blocks.image"),
    inline: true,
    defaultProps: imageDefaultProps,
    fields: {
      _style: styleField,
      imagePublicId: imageField(t("puckConfig.fields.imageField")),
      imageUrl: { type: "text", label: t("puckConfig.fields.imageUrl") },
      alt: { type: "text", label: t("puckConfig.fields.imageAlt") },
      fit: {
        type: "select",
        label: t("puckConfig.fields.imageFit"),
        options: [
          { label: t("puckConfig.options.imageFit.cover"), value: "cover" },
          { label: t("puckConfig.options.imageFit.contain"), value: "contain" },
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
    label: t("puckConfig.blocks.button"),
    inline: true,
    defaultProps: { ...buttonDefaultProps, size: "md" },
    fields: {
      _style: styleField,
      label: { type: "text", label: t("puckConfig.fields.buttonLabel"), contentEditable: true },
      size: {
        type: "select",
        label: t("puckConfig.fields.buttonSize"),
        options: [
          { label: t("puckConfig.options.buttonSize.sm"), value: "sm" },
          { label: t("puckConfig.options.buttonSize.md"), value: "md" },
          { label: t("puckConfig.options.buttonSize.lg"), value: "lg" },
        ],
      },
      action: {
        type: "select",
        label: t("puckConfig.fields.buttonAction"),
        options: [
          { label: t("puckConfig.options.buttonAction.openContact"), value: "open-contact" },
          { label: t("puckConfig.options.buttonAction.goToGallery"), value: "go-to-gallery" },
        ],
      },
      align: {
        type: "select",
        label: t("puckConfig.fields.buttonAlign"),
        options: [
          { label: t("puckConfig.options.buttonAlign.left"), value: "left" },
          { label: t("puckConfig.options.buttonAlign.center"), value: "center" },
          { label: t("puckConfig.options.buttonAlign.right"), value: "right" },
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
    label: t("puckConfig.blocks.spacer"),
    inline: true,
    defaultProps: spacerDefaultProps,
    fields: {
      height: {
        type: "custom",
        label: t("puckConfig.fields.spacerHeight"),
        render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
          <NumberInputRow
            label={t("puckConfig.fields.spacerHeight")}
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
    label: t("puckConfig.blocks.divider"),
    inline: true,
    defaultProps: dividerDefaultProps,
    fields: {
      _style: styleField,
      thickness: { type: "number", label: t("puckConfig.fields.dividerThickness"), min: 1, max: 12, visible: false } as unknown as Field<number>,
    },
    resolveFields: (_data, { fields }) => {
      // thickness is managed by the DividerPanel in StyleToolkitField
      return { _style: (fields as Record<string, unknown>)._style } as typeof fields;
    },
    render: DividerBlock,
  };

  const columns: ComponentConfig<ColumnsBlockProps> = {
    label: t("puckConfig.blocks.columns"),
    inline: true,
    defaultProps: {
      ...columnsDefaultProps,
    },
    fields: {
      _style: styleField,
      columns: {
        type: "number",
        label: t("puckConfig.fields.columnsCount"),
        min: 1,
        max: 6,
      } as Field<number>,
      rows: { type: "number", label: t("puckConfig.fields.rowsCount"), min: 1, max: 6 } as Field<number | undefined>,
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
    label: t("puckConfig.blocks.container"),
    inline: true,
    defaultProps: {
      ...containerDefaultProps,
    },
    fields: editorContainerFields,
    resolveFields: resolveContainerFieldsTyped,
    resolveData: resolveContainerDataTyped,
    render: ContainerBlock,
  };

  // ---- Final config --------------------------------------------------------

  return {
    categories: {
      presets: { title: t("puckConfig.categories.presets"), components: [...PRESET_BLOCK_KEYS], defaultExpanded: true },
      manual: { title: t("puckConfig.categories.manual"), components: [...MANUAL_BLOCK_KEYS], defaultExpanded: false },
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
      ContainerAnchor: {
        label: "ContainerAnchor",
        defaultProps: containerAnchorDefaultProps,
        fields: {
          height: { type: "number", label: t("puckConfig.fields.spacerHeight") } as unknown as Field<number>,
        },
        permissions: {
          drag: false,
          delete: false,
          duplicate: false,
          insert: false,
          edit: false,
        },
        // Thin wrapper: delegates to EditorContainerAnchor which self-sizes via
        // usePuckStore and bounces selection to the parent container. Returns null
        // on the public page (puck.isEditing is false/absent in <Render>).
        render: (({ id, puck }: { id?: string; puck?: { isEditing?: boolean }; [k: string]: unknown }) =>
          puck?.isEditing && id ? <EditorContainerAnchor id={id} /> : null
        ) as unknown as ComponentConfig<ContainerAnchorProps>["render"],
      } as ComponentConfig<ContainerAnchorProps>,
    },
    // No root.render in the editor: Puck wraps blocks in a DropZone div, so
    // blocks are not direct children of any wrapper here — adding root.render
    // breaks DnD position tracking without giving us align-self preview either.
    // The flex-col root lives only in config.ts (production <Render>), where
    // blocks ARE direct children and align-self works correctly.
    root: { fields: { _rootStyle: rootStyleField } },
  };
}

/** English-label config for backward compat (tests) and as the initial seed
 *  before EditorShell's useMemo produces the locale-aware version. */
export const editorPuckConfig: Config<EditorComponents> = createEditorConfig(englishPuckT);
