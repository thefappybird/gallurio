/**
 * Shared production Puck configuration for Gallurio portfolio pages.
 *
 * Block model:
 * - "Preset blocks" — composed SECTIONS. Each is a `Container` whose `content`
 *   slot is pre-filled with manual blocks (Heading/Text/Button…). Every piece of
 *   text is its own block, styled individually via its own `_style` toolkit.
 *   Plus the data-driven gallery/featured blocks.
 * - "Manual blocks" — the barebones primitives + the styleable Container/Columns
 *   drop-zones + the Video and Contact-details building blocks.
 *
 * Imported by:
 * - app/(public)/w/[orgSlug]/page.tsx  → <Render data={...} config={puckConfig} />
 * - the editor mirrors this via lib/page-builder/editorConfig.tsx (parity-tested)
 */

import type { Config } from "@measured/puck";
import { PRESET_BLOCK_KEYS, MANUAL_BLOCK_KEYS } from "./blockCategories";
import { galleryGridBlockConfig } from "./blocks/GalleryGridBlock";
import { galleryMasonryBlockConfig } from "./blocks/GalleryMasonryBlock";
import { galleryCarouselBlockConfig } from "./blocks/GalleryCarouselBlock";
import { featuredWorkBlockConfig } from "./blocks/FeaturedWorkBlock";
import { videoBlockConfig } from "./blocks/VideoBlock";
import { contactDetailsBlockConfig } from "./blocks/ContactDetailsBlock";
import {
  ContainerBlock,
  containerFields,
  headingBlockConfig,
  textBlockConfig,
  imageBlockConfig,
  buttonBlockConfig,
  spacerBlockConfig,
  dividerBlockConfig,
  columnsBlockConfig,
  containerBlockConfig,
  type ContainerBlockProps,
} from "./blocks/manualBlocks";
import { SECTION_PRESETS } from "./blocks/sectionPresets";
import type { GalleryGridProps } from "./blocks/GalleryGridBlock";
import type { GalleryMasonryProps } from "./blocks/GalleryMasonryBlock";
import type { GalleryCarouselProps } from "./blocks/GalleryCarouselBlock";
import type { FeaturedWorkProps } from "./blocks/FeaturedWorkBlock";
import type { VideoBlockProps } from "./blocks/VideoBlock";
import type { ContactDetailsProps } from "./blocks/ContactDetailsBlock";
import type {
  HeadingBlockProps,
  TextBlockProps,
  ImageBlockProps,
  ButtonBlockProps,
  SpacerBlockProps,
  DividerBlockProps,
  ColumnsBlockProps,
} from "./blocks/manualBlocks";

// ---------------------------------------------------------------------------
// Components union — every preset is a Container (composed section).
// ---------------------------------------------------------------------------

type Components = {
  // Preset sections (Container-based compositions)
  HeroPreset: ContainerBlockProps;
  AboutPreset: ContainerBlockProps;
  ServicesPreset: ContainerBlockProps;
  CtaPreset: ContainerBlockProps;
  ContactPreset: ContainerBlockProps;
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

// A composed-section preset is the Container render + fields, with a pre-filled
// `content` slot supplied as defaultProps.
function presetConfig(label: string, defaultProps: ContainerBlockProps) {
  return { label, fields: containerFields, defaultProps, render: ContainerBlock };
}

export const puckConfig: Config<Components> = {
  categories: {
    presets: { title: "Preset blocks", components: [...PRESET_BLOCK_KEYS], defaultExpanded: true },
    manual: { title: "Manual blocks", components: [...MANUAL_BLOCK_KEYS], defaultExpanded: false },
  },
  components: {
    HeroPreset: presetConfig(SECTION_PRESETS.HeroPreset.label, SECTION_PRESETS.HeroPreset.defaultProps),
    AboutPreset: presetConfig(SECTION_PRESETS.AboutPreset.label, SECTION_PRESETS.AboutPreset.defaultProps),
    ServicesPreset: presetConfig(SECTION_PRESETS.ServicesPreset.label, SECTION_PRESETS.ServicesPreset.defaultProps),
    CtaPreset: presetConfig(SECTION_PRESETS.CtaPreset.label, SECTION_PRESETS.CtaPreset.defaultProps),
    ContactPreset: presetConfig(SECTION_PRESETS.ContactPreset.label, SECTION_PRESETS.ContactPreset.defaultProps),
    GalleryGrid: galleryGridBlockConfig,
    GalleryMasonry: galleryMasonryBlockConfig,
    GalleryCarousel: galleryCarouselBlockConfig,
    FeaturedWork: featuredWorkBlockConfig,
    Video: videoBlockConfig,
    ContactDetails: contactDetailsBlockConfig,
    Heading: headingBlockConfig,
    Text: textBlockConfig,
    Image: imageBlockConfig,
    Button: buttonBlockConfig,
    Spacer: spacerBlockConfig,
    Divider: dividerBlockConfig,
    Columns: columnsBlockConfig,
    Container: containerBlockConfig,
  },
  root: { fields: {} },
};
