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
import type { Config, ComponentConfig } from "@measured/puck";
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
  containerResolvePermissions,
  type ContainerBlockProps,
  type ContainerAnchorProps,
} from "./blocks/manualBlocks";
import {
  pageBodyBlockConfig,
  type PageBodyBlockProps,
} from "./blocks/PageBodyBlock";
import {
  SECTION_PRESETS,
  SECTION_PRESET_KEYS,
  NAV_PRESET_KEYS,
  LEGACY_NAV_PRESETS,
  LEGACY_NAV_PRESET_KEYS,
  PRESET_GROUPS,
  type SectionPresetKey,
  type LegacyNavPresetKey,
  type PresetGroupId,
} from "./blocks/sectionPresets";
import {
  navigationBlockConfig,
  navigationFields,
  navigationPermissions,
  NavigationBlock,
  type NavigationBlockProps,
} from "./blocks/NavigationBlock";
import type { GalleryGridProps } from "./blocks/GalleryGridBlock";
import type { GalleryMasonryProps } from "./blocks/GalleryMasonryBlock";
import type { FeaturedWorkProps } from "./blocks/FeaturedWorkBlock";
import type { CollectionCardProps } from "./blocks/CollectionCardBlock";
import type { VideoBlockProps } from "./blocks/VideoBlock";
import type { ContactDetailsProps } from "./blocks/ContactDetailsBlock";
import { masonryCloneBlockConfig, type MasonryCloneProps } from "./blocks/MasonryCloneBlock";
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

type NavPresetKey = (typeof NAV_PRESET_KEYS)[number];

type Components = Omit<Record<SectionPresetKey, ContainerBlockProps>, NavPresetKey> &
  Record<NavPresetKey, NavigationBlockProps> & {
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
    PageBody: PageBodyBlockProps;
    ContainerAnchor: ContainerAnchorProps;
    MasonryClone: MasonryCloneProps;
    Navigation: NavigationBlockProps;
  } & Record<LegacyNavPresetKey, NavigationBlockProps>;

// A composed-section preset is the Container render + fields, with a pre-filled
// `content` slot supplied as defaultProps. `nav` group entries instead render
// through NavigationBlock (componentType: "Navigation" in the registry).
function presetConfig(label: string, defaultProps: ContainerBlockProps) {
  return {
    label,
    fields: containerFields,
    defaultProps,
    resolvePermissions: containerResolvePermissions,
    render: ContainerBlock,
  };
}

function navPresetConfig(label: string, defaultProps: NavigationBlockProps) {
  return {
    label,
    fields: navigationFields,
    defaultProps,
    permissions: navigationPermissions,
    render: NavigationBlock,
  };
}

// The drawer's 12 collapsible section-group categories, derived from the
// registry's PRESET_GROUPS so they can't drift from the insertable preset keys.
// Only the first group starts open; expanding everything is an unusable drawer.
// Object.fromEntries widens to string keys, so this one cast restores the
// exact PresetGroupId -> Category shape (all keys/values are still built
// straight from PRESET_GROUPS, nothing is hand-typed).
const presetCategories = Object.fromEntries(
  PRESET_GROUPS.map((group) => [
    group.id,
    { title: group.label, components: [...group.keys], defaultExpanded: group.id === "nav" },
  ])
) as Record<PresetGroupId, { title: string; components: SectionPresetKey[]; defaultExpanded: boolean }>;

// The insertable preset components, derived from the registry. Same fromEntries-cast
// reasoning as presetCategories above: Puck's Config generic wants the exact
// `Record<SectionPresetKey, ...>` shape that a mapped fromEntries can't infer.
// `nav` group entries render through NavigationBlock instead of ContainerBlock.
const presetComponents = Object.fromEntries(
  SECTION_PRESET_KEYS.map((key) => {
    const presetEntry = SECTION_PRESETS[key];
    return presetEntry.componentType === "Navigation"
      ? [key, navPresetConfig(presetEntry.label, presetEntry.defaultProps as NavigationBlockProps)]
      : [key, presetConfig(presetEntry.label, presetEntry.defaultProps as ContainerBlockProps)];
  })
) as unknown as Omit<Record<SectionPresetKey, ComponentConfig<ContainerBlockProps>>, NavPresetKey> &
  Record<NavPresetKey, ComponentConfig<NavigationBlockProps>>;

const legacyNavComponents = Object.fromEntries(
  LEGACY_NAV_PRESET_KEYS.map((key) => [
    key,
    navPresetConfig("Navigation", LEGACY_NAV_PRESETS[key]),
  ])
) as unknown as Record<LegacyNavPresetKey, ComponentConfig<NavigationBlockProps>>;

export const puckConfig: Config<Components> = {
  categories: {
    ...presetCategories,
    manual: { title: "Manual blocks", components: [...MANUAL_BLOCK_KEYS], defaultExpanded: false },
  },
  components: {
    ...presetComponents,
    ...legacyNavComponents,
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
    PageBody: pageBodyBlockConfig,
    ContainerAnchor: containerAnchorBlockConfig,
    MasonryClone: masonryCloneBlockConfig,
    Navigation: navigationBlockConfig,
  },
  root: {
    fields: {},
    render: (({ _rootStyle, children }: { _rootStyle?: RootPageStyle; children?: React.ReactNode }) =>
      React.createElement(
        "div",
        // The root wrapper is the `pfpage` container: all blocks are descendants,
        // so PF_RESPONSIVE_CSS's `@container pfpage` rules respond to the page
        // width (== viewport here, == clamped canvas in the editor).
        {
          style: {
            ...resolveRootStyle(_rootStyle),
            display: "grid",
            gridTemplateRows: "auto minmax(auto, 1fr) auto",
            minHeight: "100dvh",
            ...PF_PAGE_CONTAINER,
          },
        },
        React.createElement("style", { dangerouslySetInnerHTML: { __html: PF_RESPONSIVE_CSS } }),
        children,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      )) as any,
  },
};
