/**
 * Client-safe Puck config for the EDITOR canvas.
 *
 * The production blocks (lib/page-builder/blocks/*) are async server components
 * that hit Mongo + AsyncLocalStorage, so the shared `puckConfig` cannot be
 * imported into the client `<Puck>` editor. This config mirrors every block's
 * `fields` + `defaultProps` (so prop editing is identical) but renders a
 * lightweight, client-only PREVIEW instead of the real block. The real render
 * happens server-side via `<Render config={puckConfig}>` on the public page.
 *
 * Component `type` keys MUST match `puckConfig` exactly so data round-trips
 * between editor and renderer. A test (editorConfig.test.ts) guards parity.
 *
 * Prop types are imported type-only (erased at build) so no server module is
 * pulled into the client bundle.
 */

import type { Config, ComponentConfig, Field } from "@measured/puck";
import type { HeroBlockProps } from "./blocks/HeroBlock";
import type { AboutBlockProps, CredentialItem } from "./blocks/AboutBlock";
import type { GalleryGridProps } from "./blocks/GalleryGridBlock";
import type { GalleryMasonryProps } from "./blocks/GalleryMasonryBlock";
import type { GalleryCarouselProps } from "./blocks/GalleryCarouselBlock";
import type { FeaturedWorkProps, FeaturedWorkItemId } from "./blocks/FeaturedWorkBlock";
import type { ServicesListProps, ServiceItem } from "./blocks/ServicesListBlock";
import type { CTABannerProps } from "./blocks/CTABannerBlock";
import type { ContactCardProps } from "./blocks/ContactCardBlock";

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
};

// ---------------------------------------------------------------------------
// Shared preview chrome (uses the brand-kit CSS vars applied by the editor
// wrapper, so previews echo the portfolio's colors/fonts).
// ---------------------------------------------------------------------------

function Preview({ label, lines }: { label: string; lines: Array<string | null | undefined> }) {
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

// ---------------------------------------------------------------------------
// Per-block editor configs (fields copied verbatim from the production blocks)
// ---------------------------------------------------------------------------

const hero: ComponentConfig<HeroBlockProps> = {
  label: "Hero",
  defaultProps: {
    headline: "Capturing moments that last forever",
    subhead: "Fine art photography for weddings, portraits, and events.",
    backgroundImagePublicId: "",
    backgroundImageUrl: "",
    backgroundOverlayOpacity: 50,
    primaryCtaLabel: "Get in Touch",
    primaryCtaAction: "open-contact",
    primaryCtaTarget: "",
    secondaryCtaLabel: "View Work",
    secondaryCtaAction: "scroll-to-section",
    secondaryCtaTarget: "gallery",
    alignment: "center",
    height: "tall",
  },
  fields: {
    headline: { type: "text", label: "Headline" },
    subhead: { type: "text", label: "Sub-headline (optional)" },
    backgroundImagePublicId: { type: "text", label: "Background image (Cloudinary public ID)" },
    backgroundImageUrl: { type: "text", label: "Background image URL (fallback)" },
    backgroundOverlayOpacity: {
      type: "number",
      label: "Overlay opacity (0–100)",
      min: 0,
      max: 100,
    } as Field<number>,
    primaryCtaLabel: { type: "text", label: "Primary CTA label" },
    primaryCtaAction: {
      type: "select",
      label: "Primary CTA action",
      options: [
        { label: "Open contact form", value: "open-contact" },
        { label: "Scroll to section", value: "scroll-to-section" },
      ],
    },
    primaryCtaTarget: { type: "text", label: "Primary CTA target section ID (for scroll)" },
    secondaryCtaLabel: { type: "text", label: "Secondary CTA label (optional)" },
    secondaryCtaAction: {
      type: "select",
      label: "Secondary CTA action",
      options: [
        { label: "Open contact form", value: "open-contact" },
        { label: "Scroll to section", value: "scroll-to-section" },
      ],
    },
    secondaryCtaTarget: { type: "text", label: "Secondary CTA target section ID" },
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
  render: ({ headline, subhead, primaryCtaLabel, height }) => (
    <Preview label="Hero" lines={[headline, subhead, `${primaryCtaLabel} · ${height}`]} />
  ),
};

const about: ComponentConfig<AboutBlockProps> = {
  label: "About",
  defaultProps: {
    heading: "About Me",
    body: "I'm a passionate photographer based in Manila, capturing life's most meaningful moments.\n\nWith over a decade of experience, I bring artistry and technical expertise to every session.",
    imagePublicId: "",
    imageUrl: "",
    imagePosition: "right",
    credentials: [
      { label: "Experience", value: "10+ years" },
      { label: "Location", value: "Manila, Philippines" },
    ],
  },
  fields: {
    heading: { type: "text", label: "Heading" },
    body: { type: "textarea", label: "Body text (line breaks preserved)" },
    imagePublicId: { type: "text", label: "Image (Cloudinary public ID)" },
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
  render: ({ heading, body, imagePosition }) => (
    <Preview label="About" lines={[heading, truncate(body), `image: ${imagePosition}`]} />
  ),
};

const galleryGrid: ComponentConfig<GalleryGridProps> = {
  label: "Gallery Grid",
  defaultProps: { collectionId: "", columns: 3, gap: "normal", showCaptions: false, maxItems: 12 },
  fields: {
    collectionId: { type: "text", label: "Collection ID" },
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
    showCaptions: {
      type: "select",
      label: "Show captions",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    } as Field<boolean>,
    maxItems: { type: "number", label: "Max items (1–100)", min: 1, max: 100 } as Field<number>,
  },
  render: ({ collectionId, columns, maxItems }) => (
    <Preview
      label="Gallery Grid"
      lines={[`Collection: ${collectionId || "— select —"}`, `${columns} columns · up to ${maxItems}`]}
    />
  ),
};

const galleryMasonry: ComponentConfig<GalleryMasonryProps> = {
  label: "Gallery Masonry",
  defaultProps: { collectionId: "", columns: 3, gap: "normal", showCaptions: false, maxItems: 18 },
  fields: {
    collectionId: { type: "text", label: "Collection ID" },
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
    showCaptions: {
      type: "select",
      label: "Show captions",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    } as Field<boolean>,
    maxItems: { type: "number", label: "Max items (1–100)", min: 1, max: 100 } as Field<number>,
  },
  render: ({ collectionId, columns, maxItems }) => (
    <Preview
      label="Gallery Masonry"
      lines={[`Collection: ${collectionId || "— select —"}`, `${columns} columns · up to ${maxItems}`]}
    />
  ),
};

const galleryCarousel: ComponentConfig<GalleryCarouselProps> = {
  label: "Gallery Carousel",
  defaultProps: { collectionId: "", aspect: "landscape", autoplay: false, maxItems: 12 },
  fields: {
    collectionId: { type: "text", label: "Collection ID" },
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
  render: ({ collectionId, aspect, maxItems }) => (
    <Preview
      label="Gallery Carousel"
      lines={[`Collection: ${collectionId || "— select —"}`, `${aspect} · up to ${maxItems}`]}
    />
  ),
};

const featuredWork: ComponentConfig<FeaturedWorkProps> = {
  label: "Featured Work",
  defaultProps: { heading: "Featured work", subheading: "", itemIds: [], layout: "row" },
  fields: {
    heading: { type: "text", label: "Heading" },
    subheading: { type: "text", label: "Subheading" },
    itemIds: {
      type: "array",
      label: "Gallery item IDs (max 3)",
      arrayFields: {
        id: { type: "text", label: "Item ID" },
      },
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
  render: ({ heading, subheading, itemIds, layout }) => (
    <Preview
      label="Featured Work"
      lines={[heading, subheading, `${itemIds?.length ?? 0} items · ${layout}`]}
    />
  ),
};

const servicesList: ComponentConfig<ServicesListProps> = {
  label: "Services",
  defaultProps: {
    heading: "Services",
    items: [
      { title: "Wedding Photography", description: "Full-day coverage of your most important day.", priceFrom: "₱30,000", icon: "📷" },
      { title: "Portrait Sessions", description: "Individual or family portraits in natural light.", priceFrom: "₱8,000", icon: "🎞️" },
      { title: "Event Coverage", description: "Corporate events, debuts, and intimate gatherings.", priceFrom: "₱15,000", icon: "✨" },
    ],
  },
  fields: {
    heading: { type: "text", label: "Section heading" },
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
  render: ({ heading, items }) => (
    <Preview
      label="Services"
      lines={[heading, (items ?? []).map((i) => i.title).filter(Boolean).join(" · ")]}
    />
  ),
};

const ctaBanner: ComponentConfig<CTABannerProps> = {
  label: "CTA Banner",
  defaultProps: {
    headline: "Ready to book your session?",
    subhead: "Let's create something beautiful together.",
    ctaLabel: "Get in Touch",
    ctaAction: "open-contact",
    ctaTarget: "",
    background: "accent",
    backgroundImagePublicId: "",
    backgroundImageUrl: "",
  },
  fields: {
    headline: { type: "text", label: "Headline" },
    subhead: { type: "text", label: "Sub-headline (optional)" },
    ctaLabel: { type: "text", label: "CTA button label" },
    ctaAction: {
      type: "select",
      label: "CTA action",
      options: [
        { label: "Open contact form", value: "open-contact" },
        { label: "Scroll to section", value: "scroll-to-section" },
      ],
    },
    ctaTarget: { type: "text", label: "CTA target section ID (for scroll)" },
    background: {
      type: "select",
      label: "Background style",
      options: [
        { label: "Accent color", value: "accent" },
        { label: "Surface (neutral)", value: "surface" },
        { label: "Image", value: "image" },
      ],
    },
    backgroundImagePublicId: { type: "text", label: "Background image (Cloudinary public ID)" },
    backgroundImageUrl: { type: "text", label: "Background image URL (fallback)" },
  },
  render: ({ headline, ctaLabel, background }) => (
    <Preview label="CTA Banner" lines={[headline, `${ctaLabel} · ${background}`]} />
  ),
};

const contactCard: ComponentConfig<ContactCardProps> = {
  label: "Contact Card",
  defaultProps: {
    heading: "Get in Touch",
    description: "I'd love to hear about your vision. Reach out and let's talk.",
    showEmail: true,
    showPhone: true,
    showAddress: true,
    showSocials: true,
    inlineCtaLabel: "Send a Message",
  },
  fields: {
    heading: { type: "text", label: "Heading" },
    description: { type: "textarea", label: "Description (optional)" },
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
  render: ({ heading, description }) => (
    <Preview label="Contact Card" lines={[heading, truncate(description)]} />
  ),
};

export const editorPuckConfig: Config<EditorComponents> = {
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
  },
  root: { fields: {} },
};
