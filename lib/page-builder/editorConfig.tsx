/**
 * Client-safe Puck config for the EDITOR canvas.
 *
 * The production blocks (lib/page-builder/blocks/*) for the 9 composed presets
 * are async server components (Mongo + AsyncLocalStorage), so they cannot be
 * imported into the client `<Puck>` editor. For those, this config mirrors each
 * block's `fields` + `defaultProps` and renders a lightweight client PREVIEW.
 *
 * The Video block and the manual primitives are ISOMORPHIC (client-safe), so the
 * editor renders the REAL component and only swaps in editor-friendly fields
 * (RichTextField / StyleToolkit / pickers). Their defaultProps are imported
 * directly to guarantee parity.
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
import { StyleToolkitField } from "./StyleToolkitField";
import { RichTextField } from "./RichTextField";
import { resolveBlockStyle, coerceRichText, type BlockStyle, type RichText, type RichTextProp } from "./styleToolkit";
import { PRESET_BLOCK_KEYS, MANUAL_BLOCK_KEYS } from "./blockCategories";
import type { HeroBlockProps } from "./blocks/HeroBlock";
import type { AboutBlockProps, CredentialItem } from "./blocks/AboutBlock";
import type { GalleryGridProps } from "./blocks/GalleryGridBlock";
import type { GalleryMasonryProps } from "./blocks/GalleryMasonryBlock";
import type { GalleryCarouselProps } from "./blocks/GalleryCarouselBlock";
import type { FeaturedWorkProps, FeaturedWorkItemId } from "./blocks/FeaturedWorkBlock";
import type { ServicesListProps, ServiceItem } from "./blocks/ServicesListBlock";
import type { CTABannerProps } from "./blocks/CTABannerBlock";
import type { ContactCardProps } from "./blocks/ContactCardBlock";
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
} from "./blocks/manualBlocks";

type EditorComponents = {
  Hero: HeroBlockProps;
  About: AboutBlockProps;
  GalleryGrid: GalleryGridProps;
  GalleryMasonry: GalleryMasonryProps;
  GalleryCarousel: GalleryCarouselProps;
  FeaturedWork: FeaturedWorkProps;
  ServicesList: ServicesListProps;
  CTABanner: CTABannerProps;
  ContactCard: ContactCardProps;
  Video: VideoBlockProps;
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

function truncate(value: string | undefined, max = 120): string {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** RichText preview helper — pulls the plain text out of a stored RichText/string. */
function rt(value: unknown): string {
  return coerceRichText(value).text;
}

// ---------------------------------------------------------------------------
// Shared editor fields
// ---------------------------------------------------------------------------

const styleField = {
  type: "custom",
  label: "Style",
  render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
    <StyleToolkitField value={value as BlockStyle | undefined} onChange={onChange as (v: BlockStyle) => void} />
  ),
} as unknown as Field<BlockStyle | undefined>;

function richTextField(label: string, multiline = false): Field<RichTextProp> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
      <RichTextField value={value} onChange={onChange as (v: RichText) => void} multiline={multiline} />
    ),
  } as unknown as Field<RichTextProp>;
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
// Preset block editor configs (mirror the production blocks; preview render)
// ---------------------------------------------------------------------------

const hero: ComponentConfig<HeroBlockProps> = {
  label: "Hero",
  defaultProps: {
    headline: { text: "Capturing moments that last forever" },
    subhead: { text: "Fine art photography for weddings, portraits, and events." },
    backgroundImagePublicId: "",
    backgroundImageUrl: "",
    backgroundOverlayOpacity: 50,
    primaryCtaLabel: "Get in Touch",
    primaryCtaAction: "open-contact",
    alignment: "center",
    height: "tall",
  },
  fields: {
    _style: styleField,
    headline: richTextField("Headline"),
    subhead: richTextField("Sub-headline"),
    backgroundImagePublicId: imagePickerField("Background image"),
    backgroundImageUrl: { type: "text", label: "Background image URL (fallback)" },
    backgroundOverlayOpacity: { type: "number", label: "Overlay opacity (0–100)", min: 0, max: 100 } as Field<number>,
    primaryCtaLabel: { type: "text", label: "Primary CTA label" },
    primaryCtaAction: {
      type: "select",
      label: "Primary CTA action",
      options: [
        { label: "Open contact form", value: "open-contact" },
        { label: "Go to Gallery page", value: "go-to-gallery" },
      ],
    },
    alignment: {
      type: "select",
      label: "Content alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
      ],
    },
    height: {
      type: "select",
      label: "Section height",
      options: [
        { label: "Tall (80vh)", value: "tall" },
        { label: "Medium (60vh)", value: "medium" },
        { label: "Short (40vh)", value: "short" },
      ],
    },
  },
  resolveFields: (data, { fields }) => {
    const f: Record<string, unknown> = { ...fields };
    delete f.backgroundImageUrl;
    if (!data.props.backgroundImagePublicId) delete f.backgroundOverlayOpacity;
    return f as unknown as typeof fields;
  },
  render: ({ _style, headline, subhead, primaryCtaLabel, height }) => (
    <Preview label="Hero" lines={[rt(headline), rt(subhead), `${primaryCtaLabel} · ${height}`]} blockStyle={_style} />
  ),
};

const about: ComponentConfig<AboutBlockProps> = {
  label: "About",
  defaultProps: {
    heading: { text: "About Me" },
    body: {
      text: "I'm a passionate photographer based in Manila, capturing life's most meaningful moments.\n\nWith over a decade of experience, I bring artistry and technical expertise to every session.",
    },
    imagePublicId: "",
    imageUrl: "",
    imagePosition: "right",
    credentials: [
      { label: "Experience", value: "10+ years" },
      { label: "Location", value: "Manila, Philippines" },
    ],
  },
  fields: {
    _style: styleField,
    heading: richTextField("Heading"),
    body: richTextField("Body text", true),
    imagePublicId: imagePickerField("Photo"),
    imageUrl: { type: "text", label: "Image URL (fallback)" },
    imagePosition: {
      type: "select",
      label: "Image position",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    credentials: {
      type: "array",
      label: "Credentials (max 6)",
      arrayFields: {
        label: { type: "text", label: "Label" },
        value: { type: "text", label: "Value" },
      },
      getItemSummary: (item: CredentialItem) => item.label || "Credential",
    },
  },
  resolveFields: (_data, { fields }) => {
    const f: Record<string, unknown> = { ...fields };
    delete f.imageUrl;
    return f as unknown as typeof fields;
  },
  render: ({ _style, heading, body, imagePosition }) => (
    <Preview label="About" lines={[rt(heading), truncate(rt(body)), `image: ${imagePosition}`]} blockStyle={_style} />
  ),
};

const galleryTextFields = {
  heading: richTextField("Heading (optional)"),
  description: richTextField("Description (optional)", true),
  footer: richTextField("Footer (optional)", true),
};

const galleryGrid: ComponentConfig<GalleryGridProps> = {
  label: "Gallery Grid",
  defaultProps: {
    heading: { text: "" },
    description: { text: "" },
    footer: { text: "" },
    collectionId: "",
    columns: 3,
    gap: "normal",
    maxItems: 12,
  },
  fields: {
    _style: styleField,
    ...galleryTextFields,
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
  render: ({ _style, heading, collectionId, columns, maxItems }) => (
    <Preview
      label="Gallery Grid"
      lines={[rt(heading) || `Collection: ${collectionId || "— select —"}`, `${columns} columns · up to ${maxItems}`]}
      blockStyle={_style}
    />
  ),
};

const galleryMasonry: ComponentConfig<GalleryMasonryProps> = {
  label: "Gallery Masonry",
  defaultProps: {
    heading: { text: "" },
    description: { text: "" },
    footer: { text: "" },
    collectionId: "",
    columns: 3,
    gap: "normal",
    maxItems: 18,
  },
  fields: {
    _style: styleField,
    ...galleryTextFields,
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
  render: ({ _style, heading, collectionId, columns, maxItems }) => (
    <Preview
      label="Gallery Masonry"
      lines={[rt(heading) || `Collection: ${collectionId || "— select —"}`, `${columns} columns · up to ${maxItems}`]}
      blockStyle={_style}
    />
  ),
};

const galleryCarousel: ComponentConfig<GalleryCarouselProps> = {
  label: "Gallery Carousel",
  defaultProps: {
    heading: { text: "" },
    description: { text: "" },
    footer: { text: "" },
    collectionId: "",
    aspect: "landscape",
    autoplay: false,
    maxItems: 12,
  },
  fields: {
    _style: styleField,
    ...galleryTextFields,
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
  render: ({ _style, heading, collectionId, aspect, maxItems }) => (
    <Preview
      label="Gallery Carousel"
      lines={[rt(heading) || `Collection: ${collectionId || "— select —"}`, `${aspect} · up to ${maxItems}`]}
      blockStyle={_style}
    />
  ),
};

const featuredWork: ComponentConfig<FeaturedWorkProps> = {
  label: "Featured Work",
  defaultProps: { heading: { text: "Featured work" }, subheading: { text: "" }, itemIds: [], layout: "row" },
  fields: {
    _style: styleField,
    heading: richTextField("Heading"),
    subheading: richTextField("Subheading"),
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
  render: ({ _style, heading, subheading, itemIds, layout }) => (
    <Preview
      label="Featured Work"
      lines={[rt(heading), rt(subheading), `${itemIds?.length ?? 0} items · ${layout}`]}
      blockStyle={_style}
    />
  ),
};

const servicesList: ComponentConfig<ServicesListProps> = {
  label: "Services",
  defaultProps: {
    heading: { text: "Services" },
    items: [
      { title: "Wedding Photography", description: "Full-day coverage of your most important day.", priceFrom: "₱30,000", icon: "📷" },
      { title: "Portrait Sessions", description: "Individual or family portraits in natural light.", priceFrom: "₱8,000", icon: "🎞️" },
      { title: "Event Coverage", description: "Corporate events, debuts, and intimate gatherings.", priceFrom: "₱15,000", icon: "✨" },
    ],
  },
  fields: {
    _style: styleField,
    heading: richTextField("Section heading"),
    items: {
      type: "array",
      label: "Services (max 8)",
      arrayFields: {
        title: { type: "text", label: "Title" },
        description: { type: "textarea", label: "Description" },
        priceFrom: { type: "text", label: "Starting price (e.g. ₱30,000)" },
        icon: { type: "text", label: "Icon (emoji or URL)" },
      },
      getItemSummary: (item: ServiceItem) => item.title || "Service",
    },
  },
  render: ({ _style, heading, items }) => (
    <Preview
      label="Services"
      lines={[rt(heading), (items ?? []).map((i) => i.title).filter(Boolean).join(" · ")]}
      blockStyle={_style}
    />
  ),
};

const ctaBanner: ComponentConfig<CTABannerProps> = {
  label: "CTA Banner",
  defaultProps: {
    headline: { text: "Ready to book your session?" },
    subhead: { text: "Let's create something beautiful together." },
    ctaLabel: "Get in Touch",
    ctaAction: "open-contact",
    background: "accent",
    backgroundImagePublicId: "",
    backgroundImageUrl: "",
  },
  fields: {
    _style: styleField,
    headline: richTextField("Headline"),
    subhead: richTextField("Sub-headline"),
    ctaLabel: { type: "text", label: "CTA button label" },
    ctaAction: {
      type: "select",
      label: "CTA action",
      options: [
        { label: "Open contact form", value: "open-contact" },
        { label: "Go to Gallery page", value: "go-to-gallery" },
      ],
    },
    background: {
      type: "select",
      label: "Background style",
      options: [
        { label: "Accent color", value: "accent" },
        { label: "Surface (neutral)", value: "surface" },
        { label: "Image", value: "image" },
      ],
    },
    backgroundImagePublicId: imagePickerField("Background image"),
    backgroundImageUrl: { type: "text", label: "Background image URL (fallback)" },
  },
  resolveFields: (data, { fields }) => {
    const f: Record<string, unknown> = { ...fields };
    delete f.backgroundImageUrl;
    if (data.props.background !== "image") delete f.backgroundImagePublicId;
    return f as unknown as typeof fields;
  },
  render: ({ _style, headline, ctaLabel, background }) => (
    <Preview label="CTA Banner" lines={[rt(headline), `${ctaLabel} · ${background}`]} blockStyle={_style} />
  ),
};

const contactCard: ComponentConfig<ContactCardProps> = {
  label: "Contact Card",
  defaultProps: {
    heading: { text: "Get in Touch" },
    description: { text: "I'd love to hear about your vision. Reach out and let's talk." },
    showEmail: true,
    showPhone: true,
    showAddress: true,
    showSocials: true,
    inlineCtaLabel: "Send a Message",
  },
  fields: {
    _style: styleField,
    heading: richTextField("Heading"),
    description: richTextField("Description", true),
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
    inlineCtaLabel: { type: "text", label: "CTA button label (optional — leave empty to hide)" },
  },
  render: ({ _style, heading, description }) => (
    <Preview label="Contact Card" lines={[rt(heading), truncate(rt(description))]} blockStyle={_style} />
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
    heading: richTextField("Heading (optional)"),
    description: richTextField("Description (optional)", true),
    videoUrl: { type: "text", label: "YouTube or Vimeo URL" },
    footer: richTextField("Footer (optional)", true),
  },
  render: VideoBlock,
};

// ---------------------------------------------------------------------------
// Manual primitives — isomorphic; editor renders the real component.
// ---------------------------------------------------------------------------

const heading: ComponentConfig<HeadingBlockProps> = {
  label: "Heading",
  defaultProps: headingDefaultProps,
  fields: {
    _style: styleField,
    text: richTextField("Heading text"),
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

const text: ComponentConfig<TextBlockProps> = {
  label: "Text",
  defaultProps: textDefaultProps,
  fields: {
    _style: styleField,
    text: richTextField("Text", true),
  },
  render: TextBlock,
};

const image: ComponentConfig<ImageBlockProps> = {
  label: "Image",
  defaultProps: imageDefaultProps,
  fields: {
    _style: styleField,
    imagePublicId: imagePickerField("Image"),
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
    const f: Record<string, unknown> = { ...fields };
    delete f.imageUrl;
    return f as unknown as typeof fields;
  },
  render: ImageBlock,
};

const button: ComponentConfig<ButtonBlockProps> = {
  label: "Button",
  defaultProps: buttonDefaultProps,
  fields: {
    _style: styleField,
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

const spacer: ComponentConfig<SpacerBlockProps> = {
  label: "Spacer",
  defaultProps: spacerDefaultProps,
  fields: {
    height: { type: "number", label: "Height (px)", min: 4, max: 400 } as Field<number>,
  },
  render: SpacerBlock,
};

const divider: ComponentConfig<DividerBlockProps> = {
  label: "Divider",
  defaultProps: dividerDefaultProps,
  fields: {
    _style: styleField,
    thickness: { type: "number", label: "Thickness (px)", min: 1, max: 12 } as Field<number>,
  },
  render: DividerBlock,
};

const columns: ComponentConfig<ColumnsBlockProps> = {
  label: "Columns",
  defaultProps: columnsDefaultProps,
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
  render: ColumnsBlock,
};

const container: ComponentConfig<ContainerBlockProps> = {
  label: "Container",
  defaultProps: containerDefaultProps,
  fields: {
    _style: styleField,
    content: { type: "slot" },
  },
  render: ContainerBlock,
};

export const editorPuckConfig: Config<EditorComponents> = {
  categories: {
    presets: { title: "Preset blocks", components: [...PRESET_BLOCK_KEYS] },
    manual: { title: "Manual blocks", components: [...MANUAL_BLOCK_KEYS] },
  },
  components: {
    Hero: hero,
    About: about,
    GalleryGrid: galleryGrid,
    GalleryMasonry: galleryMasonry,
    GalleryCarousel: galleryCarousel,
    FeaturedWork: featuredWork,
    ServicesList: servicesList,
    CTABanner: ctaBanner,
    ContactCard: contactCard,
    Video: video,
    Heading: heading,
    Text: text,
    Image: image,
    Button: button,
    Spacer: spacer,
    Divider: divider,
    Columns: columns,
    Container: container,
  },
  root: { fields: {} },
};
