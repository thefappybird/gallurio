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

import React from "react";
import type { Config } from "@measured/puck";
import { resolveRootStyle, type RootPageStyle } from "./rootStyle";
import { PF_PAGE_CONTAINER, PF_RESPONSIVE_CSS } from "./responsive";
import { PRESET_BLOCK_KEYS, MANUAL_BLOCK_KEYS } from "./blockCategories";
import { galleryGridBlockConfig } from "./blocks/GalleryGridBlock";
import { galleryMasonryBlockConfig } from "./blocks/GalleryMasonryBlock";
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
    GalleryGridPreset: presetConfig(SECTION_PRESETS.GalleryGridPreset.label, SECTION_PRESETS.GalleryGridPreset.defaultProps),
    GalleryMasonryPreset: presetConfig(SECTION_PRESETS.GalleryMasonryPreset.label, SECTION_PRESETS.GalleryMasonryPreset.defaultProps),
    FeaturedWorkPreset: presetConfig(SECTION_PRESETS.FeaturedWorkPreset.label, SECTION_PRESETS.FeaturedWorkPreset.defaultProps),
    GalleryLandingPreset: presetConfig(SECTION_PRESETS.GalleryLandingPreset.label, SECTION_PRESETS.GalleryLandingPreset.defaultProps),
    GalleryGrid: galleryGridBlockConfig,
    GalleryMasonry: galleryMasonryBlockConfig,
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
  root: {
    fields: {},
    render: (({ _rootStyle, children }: { _rootStyle?: RootPageStyle; children?: React.ReactNode }) =>
      React.createElement(
        "div",
        // The root wrapper is the `pfpage` container: all blocks are descendants,
        // so PF_RESPONSIVE_CSS's `@container pfpage` rules respond to the page
        // width (== viewport here, == clamped canvas in the editor).
        { style: { ...resolveRootStyle(_rootStyle), minHeight: "100%", ...PF_PAGE_CONTAINER } },
        React.createElement("style", { dangerouslySetInnerHTML: { __html: PF_RESPONSIVE_CSS } }),
        children,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      )) as any,
  },
};
