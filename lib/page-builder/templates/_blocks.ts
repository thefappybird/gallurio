import type { PuckBlockEntry } from "@/lib/page-builder/types";

// Pure block factories used by the template seeds. Each returns a complete
// props object (every key the block reads) so seeded portfolios render fully
// without relying on Puck default-prop merging. No React/block-component imports
// here — this stays plain data so it's cheap to import server-side and in tests.

type CtaAction = "open-contact" | "scroll-to-section";

export function hero(props: {
  headline: string;
  subhead?: string;
  primaryCtaLabel?: string;
  primaryCtaAction?: CtaAction;
  primaryCtaTarget?: string;
  secondaryCtaLabel?: string;
  secondaryCtaAction?: CtaAction;
  secondaryCtaTarget?: string;
  alignment?: "left" | "center";
  height?: "tall" | "medium" | "short";
}): PuckBlockEntry {
  return {
    type: "Hero",
    props: {
      headline: props.headline,
      subhead: props.subhead ?? "",
      backgroundImagePublicId: "",
      backgroundImageUrl: "",
      backgroundOverlayOpacity: 50,
      primaryCtaLabel: props.primaryCtaLabel ?? "Get in touch",
      primaryCtaAction: props.primaryCtaAction ?? "open-contact",
      primaryCtaTarget: props.primaryCtaTarget ?? "",
      secondaryCtaLabel: props.secondaryCtaLabel ?? "View work",
      secondaryCtaAction: props.secondaryCtaAction ?? "scroll-to-section",
      secondaryCtaTarget: props.secondaryCtaTarget ?? "gallery",
      alignment: props.alignment ?? "center",
      height: props.height ?? "tall",
    },
  };
}

export function about(props: {
  heading?: string;
  body: string;
  imagePosition?: "left" | "right";
  credentials?: { label: string; value: string }[];
}): PuckBlockEntry {
  return {
    type: "About",
    props: {
      heading: props.heading ?? "About",
      body: props.body,
      imagePublicId: "",
      imageUrl: "",
      imagePosition: props.imagePosition ?? "right",
      credentials: props.credentials ?? [],
    },
  };
}

export function featuredWork(props: {
  heading?: string;
  subheading?: string;
  layout?: "row" | "stagger";
}): PuckBlockEntry {
  return {
    type: "FeaturedWork",
    props: {
      heading: props.heading ?? "Featured work",
      subheading: props.subheading ?? "",
      itemIds: [],
      layout: props.layout ?? "row",
    },
  };
}

export function servicesList(props: {
  heading?: string;
  items: { title: string; description?: string; priceFrom?: string; icon?: string }[];
}): PuckBlockEntry {
  return {
    type: "ServicesList",
    props: {
      heading: props.heading ?? "Services",
      items: props.items.map((i) => ({
        title: i.title,
        description: i.description ?? "",
        priceFrom: i.priceFrom ?? "",
        icon: i.icon ?? "",
      })),
    },
  };
}

export function ctaBanner(props: {
  headline: string;
  subhead?: string;
  ctaLabel?: string;
  ctaAction?: CtaAction;
  background?: "accent" | "surface" | "image";
}): PuckBlockEntry {
  return {
    type: "CTABanner",
    props: {
      headline: props.headline,
      subhead: props.subhead ?? "",
      ctaLabel: props.ctaLabel ?? "Get in touch",
      ctaAction: props.ctaAction ?? "open-contact",
      ctaTarget: "",
      background: props.background ?? "accent",
      backgroundImagePublicId: "",
      backgroundImageUrl: "",
    },
  };
}

export function contactCard(props: {
  heading?: string;
  description?: string;
  showAddress?: boolean;
  showSocials?: boolean;
}): PuckBlockEntry {
  return {
    type: "ContactCard",
    props: {
      heading: props.heading ?? "Get in touch",
      description: props.description ?? "",
      showEmail: true,
      showPhone: true,
      showAddress: props.showAddress ?? true,
      showSocials: props.showSocials ?? true,
      inlineCtaLabel: "Send a message",
    },
  };
}

export function galleryMasonry(props?: {
  columns?: 2 | 3 | 4;
  gap?: "tight" | "normal" | "loose";
  maxItems?: number;
}): PuckBlockEntry {
  return {
    type: "GalleryMasonry",
    props: {
      collectionId: "",
      columns: props?.columns ?? 3,
      gap: props?.gap ?? "normal",
      showCaptions: false,
      maxItems: props?.maxItems ?? 18,
    },
  };
}

export function galleryGrid(props?: {
  columns?: 2 | 3 | 4;
  gap?: "tight" | "normal" | "loose";
  maxItems?: number;
}): PuckBlockEntry {
  return {
    type: "GalleryGrid",
    props: {
      collectionId: "",
      columns: props?.columns ?? 3,
      gap: props?.gap ?? "normal",
      showCaptions: false,
      maxItems: props?.maxItems ?? 12,
    },
  };
}

export function galleryCarousel(props?: {
  aspect?: "square" | "landscape" | "portrait";
  maxItems?: number;
}): PuckBlockEntry {
  return {
    type: "GalleryCarousel",
    props: {
      collectionId: "",
      aspect: props?.aspect ?? "landscape",
      autoplay: false,
      maxItems: props?.maxItems ?? 12,
    },
  };
}

/** Wrap a zone's blocks in the PuckData envelope. */
export function zone(content: PuckBlockEntry[]) {
  return { content, root: {} as { props?: Record<string, unknown> } };
}
