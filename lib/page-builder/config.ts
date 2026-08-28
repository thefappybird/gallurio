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
import { MANUAL_BLOCK_KEYS } from "./blockCategories";
import { galleryGridBlockConfig } from "./blocks/GalleryGridBlock";
import { galleryMasonryBlockConfig } from "./blocks/GalleryMasonryBlock";
import { featuredWorkBlockConfig } from "./blocks/FeaturedWorkBlock";
import { collectionCardBlockConfig } from "./blocks/CollectionCardBlock";
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
  containerAnchorBlockConfig,
  type ContainerBlockProps,
  type ContainerAnchorProps,
} from "./blocks/manualBlocks";
import {
  SECTION_PRESETS,
  SECTION_PRESET_KEYS,
  PRESET_GROUPS,
  type SectionPresetKey,
  type PresetGroupId,
} from "./blocks/sectionPresets";
import type { GalleryGridProps } from "./blocks/GalleryGridBlock";
import type { GalleryMasonryProps } from "./blocks/GalleryMasonryBlock";
import type { FeaturedWorkProps } from "./blocks/FeaturedWorkBlock";
import type { CollectionCardProps } from "./blocks/CollectionCardBlock";
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

type Components = Record<SectionPresetKey, ContainerBlockProps> & {
  // Data blocks
  GalleryGrid: GalleryGridProps;
  GalleryMasonry: GalleryMasonryProps;
  FeaturedWork: FeaturedWorkProps;
  CollectionCard: CollectionCardProps;
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

// A composed-section preset is the Container render + fields, with a pre-filled
// `content` slot supplied as defaultProps.
function presetConfig(label: string, defaultProps: ContainerBlockProps) {
  return { label, fields: containerFields, defaultProps, render: ContainerBlock };
}

// The drawer's 11 collapsible section-group categories, derived from the
// registry's PRESET_GROUPS so they can't drift from the 33 preset keys. Only
// the first group starts open — 33 items all expanded is an unusable drawer.
// Object.fromEntries widens to string keys, so this one cast restores the
// exact PresetGroupId -> Category shape (all keys/values are still built
// straight from PRESET_GROUPS, nothing is hand-typed).
const presetCategories = Object.fromEntries(
  PRESET_GROUPS.map((group) => [
    group.id,
    { title: group.label, components: [...group.keys], defaultExpanded: group.id === "hero" },
  ])
) as Record<PresetGroupId, { title: string; components: SectionPresetKey[]; defaultExpanded: boolean }>;

// The 33 preset components, derived from the registry. Same fromEntries-cast
// reasoning as presetCategories above: Puck's Config generic wants the exact
// `Record<SectionPresetKey, ...>` shape that a mapped fromEntries can't infer.
const presetComponents = Object.fromEntries(
  SECTION_PRESET_KEYS.map((key) => [key, presetConfig(SECTION_PRESETS[key].label, SECTION_PRESETS[key].defaultProps)])
) as Record<SectionPresetKey, ReturnType<typeof presetConfig>>;

export const puckConfig: Config<Components> = {
  categories: {
    ...presetCategories,
    manual: { title: "Manual blocks", components: [...MANUAL_BLOCK_KEYS], defaultExpanded: false },
  },
  components: {
    ...presetComponents,
    GalleryGrid: galleryGridBlockConfig,
    GalleryMasonry: galleryMasonryBlockConfig,
    FeaturedWork: featuredWorkBlockConfig,
    CollectionCard: collectionCardBlockConfig,
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
    ContainerAnchor: containerAnchorBlockConfig,
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
