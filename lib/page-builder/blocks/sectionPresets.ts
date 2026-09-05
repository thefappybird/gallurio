/**
 * Section presets — the "Preset blocks" shown in the editor drawer.
 *
 * Every preset but the `nav` group is a `Container` (see manualBlocks) whose
 * `content` slot is PRE-FILLED with a composition of manual blocks (Heading +
 * Text + Button…). Dragging one in inserts the whole section; every child
 * block is then selected and styled INDIVIDUALLY via its own `_style` toolkit
 * — so each piece of text is its own block, not a bundle of text-inputs on one
 * monolithic component. The `nav` group's single insertable entry renders through
 * `NavigationBlock` instead (`componentType: "Navigation"`) — see
 * `./NavigationBlock.tsx`.
 *
 * The compositions live one file per section group under `./presets/`. THIS file
 * is the registry that names them: one Navigation item plus 11 groups x 3
 * variants = 34 insertable component keys,
 * each carrying its group, its localized label/description keys, and what
 * workspace content it depends on.
 *
 * The registry is the SINGLE source those facts come from. `puckConfig`,
 * `createEditorConfig`, `PRESET_BLOCK_KEYS`, `fillBlockDefaults`, the editor's
 * drawer categories, demo-mode filtering, and the guide's preset detection all
 * derive from it rather than repeating preset keys by hand.
 *
 * Client-safe (pure data + the isomorphic Container/Navigation renders), so
 * the SAME configs power the editor canvas and the public renderer. Only the
 * `_style` field and the bg-image field differ between editor/prod (the editor
 * swaps in visual pickers) — field KEYS match, so editor/prod parity holds.
 */

import type { ContainerBlockProps } from "./manualBlocks";
import type { NavigationBlockProps } from "./NavigationBlock";
import {
  NAVIGATION_PRESET,
  NAV_BORDERED_PRESET,
  NAV_UNDERLINED_PRESET,
  NAV_SCALED_PRESET,
} from "./presets/navigation";
import { HERO_PRESET, HERO_SPLIT_PRESET, HERO_STATEMENT_PRESET } from "./presets/hero";
import { ABOUT_PRESET, ABOUT_PORTRAIT_PRESET, ABOUT_PROFILE_PRESET } from "./presets/about";
import { SERVICES_PRESET, SERVICES_MENU_PRESET, SERVICES_FEATURE_PRESET } from "./presets/services";
import { CTA_PRESET, CTA_IMAGE_PRESET, CTA_MINIMAL_PRESET } from "./presets/cta";
import { CONTACT_PRESET, CONTACT_SPLIT_PRESET, CONTACT_BAR_PRESET } from "./presets/contact";
import {
  GALLERY_GRID_PRESET,
  GALLERY_GRID_FULL_PRESET,
  GALLERY_GRID_FRAMED_PRESET,
} from "./presets/galleryGrid";
import {
  GALLERY_MASONRY_PRESET,
  GALLERY_MASONRY_WALL_PRESET,
  GALLERY_MASONRY_JOURNAL_PRESET,
} from "./presets/galleryMasonry";
import {
  FEATURED_WORK_PRESET,
  FEATURED_WORK_LEAD_PRESET,
  FEATURED_WORK_INDEX_PRESET,
} from "./presets/featuredWork";
import {
  GALLERY_LANDING_PRESET,
  GALLERY_LANDING_SPLIT_PRESET,
  GALLERY_LANDING_MASTHEAD_PRESET,
} from "./presets/galleryLanding";
import { VIDEO_PRESET, VIDEO_SPLIT_PRESET, VIDEO_CINEMA_PRESET } from "./presets/video";
import {
  FOOTER_SIGNATURE_PRESET,
  FOOTER_DIRECTORY_PRESET,
  FOOTER_STATEMENT_PRESET,
} from "./presets/footer";

// Re-exported so existing importers (tests, templates) keep working unchanged.
export {
  NAVIGATION_PRESET, NAV_BORDERED_PRESET, NAV_UNDERLINED_PRESET, NAV_SCALED_PRESET,
  HERO_PRESET, HERO_SPLIT_PRESET, HERO_STATEMENT_PRESET,
  ABOUT_PRESET, ABOUT_PORTRAIT_PRESET, ABOUT_PROFILE_PRESET,
  SERVICES_PRESET, SERVICES_MENU_PRESET, SERVICES_FEATURE_PRESET,
  CTA_PRESET, CTA_IMAGE_PRESET, CTA_MINIMAL_PRESET,
  CONTACT_PRESET, CONTACT_SPLIT_PRESET, CONTACT_BAR_PRESET,
  GALLERY_GRID_PRESET, GALLERY_GRID_FULL_PRESET, GALLERY_GRID_FRAMED_PRESET,
  GALLERY_MASONRY_PRESET, GALLERY_MASONRY_WALL_PRESET, GALLERY_MASONRY_JOURNAL_PRESET,
  FEATURED_WORK_PRESET, FEATURED_WORK_LEAD_PRESET, FEATURED_WORK_INDEX_PRESET,
  GALLERY_LANDING_PRESET, GALLERY_LANDING_SPLIT_PRESET, GALLERY_LANDING_MASTHEAD_PRESET,
  VIDEO_PRESET, VIDEO_SPLIT_PRESET, VIDEO_CINEMA_PRESET,
  FOOTER_SIGNATURE_PRESET, FOOTER_DIRECTORY_PRESET, FOOTER_STATEMENT_PRESET,
};

// ---------------------------------------------------------------------------
// Registry types
// ---------------------------------------------------------------------------

/** The 12 section groups, in drawer order. */
export const PRESET_GROUP_IDS = [
  "nav",
  "hero",
  "about",
  "services",
  "cta",
  "contact",
  "galleryGrid",
  "galleryMasonry",
  "featuredWork",
  "galleryLanding",
  "video",
  "footer",
] as const;
export type PresetGroupId = (typeof PRESET_GROUP_IDS)[number];

/**
 * Workspace content a preset needs before it says anything. Drives demo-mode
 * filtering (no collections picker there) and prerequisite copy in the drawer.
 */
export const PRESET_DEPENDENCIES = ["gallery", "collections", "contact", "video"] as const;
export type PresetDependency = (typeof PRESET_DEPENDENCIES)[number];

export type SectionPresetEntry = {
  /** English label. Also the drawer label wherever no translator runs (production
   *  `puckConfig`, tests). Within a group these are the VARIANT names — the group
   *  name is the category title above them. */
  label: string;
  /** Key under `app.pageBuilder.editor.puckConfig`. */
  labelKey: string;
  /** One-sentence drawer subtitle, English. */
  description: string;
  descriptionKey: string;
  group: PresetGroupId;
  dependsOn: readonly PresetDependency[];
  defaultProps: ContainerBlockProps | NavigationBlockProps;
  /** Which Puck render/fields this entry uses. Every preset but the `nav` group
   *  renders through `ContainerBlock`; defaults to "Container" so the other 33
   *  entries need no change. */
  componentType?: "Container" | "Navigation";
  /** Optional editor-only hints. Never a field — parity with `puckConfig` holds. */
  metadata?: Record<string, unknown>;
};

// A registry row. `group` and the camelCase i18n keys are derived from the key so
// entries cannot drift into inconsistent naming.
function entry(
  key: string,
  group: PresetGroupId,
  label: string,
  description: string,
  defaultProps: ContainerBlockProps | NavigationBlockProps,
  extra?: {
    dependsOn?: readonly PresetDependency[];
    metadata?: Record<string, unknown>;
    componentType?: "Container" | "Navigation";
  }
): SectionPresetEntry {
  const camel = key.charAt(0).toLowerCase() + key.slice(1);
  return {
    label,
    labelKey: `puckConfig.blocks.${camel}`,
    description,
    descriptionKey: `puckConfig.presetDescriptions.${camel}`,
    group,
    dependsOn: extra?.dependsOn ?? [],
    defaultProps,
    componentType: extra?.componentType ?? "Container",
    ...(extra?.metadata ? { metadata: extra.metadata } : {}),
  };
}

// ---------------------------------------------------------------------------
// The 34 insertable presets, in drawer order: Navigation first, then grouped variants.
//
// The ten original component keys are UNCHANGED — persisted pages reference them.
// Their LABELS changed from the old flat group name to the variant name, because
// the group name is now the collapsible category heading above them.
// ---------------------------------------------------------------------------

export const SECTION_PRESETS = {
  // ---- Navigation ----
  // Dragging one onto a page replaces that zone's existing Navigation (the
  // header is pinned/undeletable — there is never a second one) rather than
  // inserting alongside it.
  NavigationPreset: entry("NavigationPreset", "nav", "Navigation",
    "A flexible site header with editable branding, links, and contact button. Replaces the page's current header.",
    NAVIGATION_PRESET, { componentType: "Navigation" }),

  // ---- Hero ----
  HeroPreset: entry("HeroPreset", "hero", "Immersive cover",
    "Tall image or slideshow background with centered copy over a scrim.", HERO_PRESET),
  HeroSplitPreset: entry("HeroSplitPreset", "hero", "Split introduction",
    "Copy and CTA beside an editable image that keeps its own proportions.", HERO_SPLIT_PRESET),
  HeroStatementPreset: entry("HeroStatementPreset", "hero", "Typographic statement",
    "An oversized headline, a divider and a compact CTA — no image needed.", HERO_STATEMENT_PRESET),

  // ---- About ----
  AboutPreset: entry("AboutPreset", "about", "Editorial biography",
    "A heading and long-form biography at a readable measure.", ABOUT_PRESET),
  AboutPortraitPreset: entry("AboutPortraitPreset", "about", "Portrait and story",
    "A portrait beside the story, each editable on its own.", ABOUT_PORTRAIT_PRESET),
  AboutProfilePreset: entry("AboutProfilePreset", "about", "Studio profile",
    "The story spans two tracks; location, experience and specialty sit beside it.", ABOUT_PROFILE_PRESET),

  // ---- Services ----
  ServicesPreset: entry("ServicesPreset", "services", "Service cards",
    "Three equal bordered packages with prices that stay aligned.", SERVICES_PRESET),
  ServicesMenuPreset: entry("ServicesMenuPreset", "services", "Editorial menu",
    "Stacked rows split into title, description and price, with no card frames.", SERVICES_MENU_PRESET),
  ServicesFeaturePreset: entry("ServicesFeaturePreset", "services", "Featured service",
    "One prominent split service leads, with two quieter ones beneath.", SERVICES_FEATURE_PRESET),

  // ---- Call to action ----
  CtaPreset: entry("CtaPreset", "cta", "Accent band",
    "A centered color band closing with a contact CTA.", CTA_PRESET),
  CtaImagePreset: entry("CtaImagePreset", "cta", "Image invitation",
    "Closing copy and a CTA beside an editable image.", CTA_IMAGE_PRESET),
  CtaMinimalPreset: entry("CtaMinimalPreset", "cta", "Minimal closing",
    "A divider and headline beside a button on a contrasting band.", CTA_MINIMAL_PRESET),

  // ---- Contact ----
  ContactPreset: entry("ContactPreset", "contact", "Centered contact",
    "Heading, introduction, contact details and a CTA, centered.", CONTACT_PRESET,
    { dependsOn: ["contact"] }),
  ContactSplitPreset: entry("ContactSplitPreset", "contact", "Split inquiry",
    "A narrative and CTA beside contact details in a restrained frame.", CONTACT_SPLIT_PRESET,
    { dependsOn: ["contact"] }),
  ContactBarPreset: entry("ContactBarPreset", "contact", "Compact contact bar",
    "A wide closing row that stacks in reading order on a phone.", CONTACT_BAR_PRESET,
    { dependsOn: ["contact"] }),

  // ---- Gallery grid ----
  GalleryGridPreset: entry("GalleryGridPreset", "galleryGrid", "Classic grid",
    "A heading and description above a three-column grid.", GALLERY_GRID_PRESET,
    { dependsOn: ["gallery"] }),
  GalleryGridFullPreset: entry("GalleryGridFullPreset", "galleryGrid", "Full-width grid",
    "A minimal header over an edge-to-edge four-column grid.", GALLERY_GRID_FULL_PRESET,
    { dependsOn: ["gallery"] }),
  GalleryGridFramedPreset: entry("GalleryGridFramedPreset", "galleryGrid", "Framed selection",
    "A padded, bordered section around a small curated set.", GALLERY_GRID_FRAMED_PRESET,
    { dependsOn: ["gallery"] }),

  // ---- Gallery masonry ----
  GalleryMasonryPreset: entry("GalleryMasonryPreset", "galleryMasonry", "Editorial story",
    "A heading and description above a masonry flow.", GALLERY_MASONRY_PRESET,
    { dependsOn: ["gallery"] }),
  GalleryMasonryWallPreset: entry("GalleryMasonryWallPreset", "galleryMasonry", "Edge-to-edge wall",
    "Full width and tight gutters — the photographs form one wall.", GALLERY_MASONRY_WALL_PRESET,
    { dependsOn: ["gallery"] }),
  GalleryMasonryJournalPreset: entry("GalleryMasonryJournalPreset", "galleryMasonry", "Journal spread",
    "The introduction takes one track while the masonry spans the rest.", GALLERY_MASONRY_JOURNAL_PRESET,
    { dependsOn: ["gallery"] }),

  // ---- Featured work ----
  FeaturedWorkPreset: entry("FeaturedWorkPreset", "featuredWork", "Collection overview",
    "An introduction above three clickable collection tiles.", FEATURED_WORK_PRESET,
    { dependsOn: ["collections"] }),
  FeaturedWorkLeadPreset: entry("FeaturedWorkLeadPreset", "featuredWork", "Lead collections",
    "Two large collections in a landscape crop under a stronger introduction.", FEATURED_WORK_LEAD_PRESET,
    { dependsOn: ["collections"] }),
  FeaturedWorkIndexPreset: entry("FeaturedWorkIndexPreset", "featuredWork", "Compact project index",
    "Compact square collection tiles on a contrasting band.", FEATURED_WORK_INDEX_PRESET,
    { dependsOn: ["collections"] }),

  // ---- Gallery landing ----
  GalleryLandingPreset: entry("GalleryLandingPreset", "galleryLanding", "Slideshow cover",
    "A medium-height image or slideshow landing with centered copy.", GALLERY_LANDING_PRESET,
    {
      // Editor hint: uploading multiple background images activates the
      // auto-playing slideshow (ContainerBackgroundControls shows animation
      // controls at images.length >= 2).
      metadata: {
        backgroundImagesHint:
          "Upload multiple background images to turn this into an auto-playing carousel.",
      },
    }),
  GalleryLandingSplitPreset: entry("GalleryLandingSplitPreset", "galleryLanding", "Split gallery intro",
    "Copy beside one signature image, editable on its own.", GALLERY_LANDING_SPLIT_PRESET),
  GalleryLandingMastheadPreset: entry("GalleryLandingMastheadPreset", "galleryLanding", "Minimal masthead",
    "A type-led title and divider so the gallery starts right below.", GALLERY_LANDING_MASTHEAD_PRESET),

  // ---- Video ----
  VideoPreset: entry("VideoPreset", "video", "Centered film",
    "A centered heading, description and embedded film.", VIDEO_PRESET,
    { dependsOn: ["video"] }),
  VideoSplitPreset: entry("VideoSplitPreset", "video", "Film and story",
    "The film takes the larger side of a split, with context beside it.", VIDEO_SPLIT_PRESET,
    { dependsOn: ["video"] }),
  VideoCinemaPreset: entry("VideoCinemaPreset", "video", "Cinema band",
    "A full-width film on a contrasting band with a caption below.", VIDEO_CINEMA_PRESET,
    { dependsOn: ["video"] }),

  // ---- Footer ----
  FooterSignaturePreset: entry("FooterSignaturePreset", "footer", "Signature footer",
    "A divider, the studio name and compact Home, Gallery and Contact links.", FOOTER_SIGNATURE_PRESET),
  FooterDirectoryPreset: entry("FooterDirectoryPreset", "footer", "Directory footer",
    "Three columns for identity, navigation and contact details.", FOOTER_DIRECTORY_PRESET,
    { dependsOn: ["contact"] }),
  FooterStatementPreset: entry("FooterStatementPreset", "footer", "Closing statement",
    "A contrasting band with a final statement, CTA and quiet copyright line.", FOOTER_STATEMENT_PRESET),
} as const satisfies Record<string, SectionPresetEntry>;

export type SectionPresetKey = keyof typeof SECTION_PRESETS;

/**
 * Render-only compatibility for drafts/pages created while the three
 * experimental navigation variants were insertable. Keep these registered,
 * but never list them in PRESET_GROUPS or PRESET_BLOCK_KEYS.
 */
export const LEGACY_NAV_PRESETS = {
  NavBorderedPreset: NAV_BORDERED_PRESET,
  NavUnderlinedPreset: NAV_UNDERLINED_PRESET,
  NavScaledPreset: NAV_SCALED_PRESET,
} as const;
export type LegacyNavPresetKey = keyof typeof LEGACY_NAV_PRESETS;
export const LEGACY_NAV_PRESET_KEYS = Object.keys(LEGACY_NAV_PRESETS) as LegacyNavPresetKey[];

/** All insertable preset keys, in drawer order. */
export const SECTION_PRESET_KEYS = Object.keys(SECTION_PRESETS) as SectionPresetKey[];

export type PresetGroup = {
  id: PresetGroupId;
  /** English category title. */
  label: string;
  labelKey: string;
  keys: readonly SectionPresetKey[];
};

const GROUP_LABELS: Record<PresetGroupId, string> = {
  nav: "Navigation",
  hero: "Hero",
  about: "About",
  services: "Services",
  cta: "Call to action",
  contact: "Contact",
  galleryGrid: "Gallery grid",
  galleryMasonry: "Gallery masonry",
  featuredWork: "Featured work",
  galleryLanding: "Gallery landing",
  video: "Video",
  footer: "Footer",
};

/** The drawer's collapsible categories: one Navigation plus 11 three-variant groups. */
export const PRESET_GROUPS: readonly PresetGroup[] = PRESET_GROUP_IDS.map((id) => ({
  id,
  label: GROUP_LABELS[id],
  labelKey: `puckConfig.categories.${id}`,
  keys: SECTION_PRESET_KEYS.filter((key) => SECTION_PRESETS[key].group === id),
}));

/** The insertable `nav` group key — it renders through `NavigationBlock`, not
 *  `ContainerBlock`, so `puckConfig`/`createEditorConfig`/`fillBlockDefaults`
 *  branch on this instead of assuming every preset is a Container. */
export const NAV_PRESET_KEYS: readonly SectionPresetKey[] = SECTION_PRESET_KEYS.filter(
  (key) => SECTION_PRESETS[key].componentType === "Navigation"
);

/** Presets that need the (auth-gated) collections picker — hidden in demo mode. */
export const COLLECTION_PRESET_KEYS: readonly SectionPresetKey[] = SECTION_PRESET_KEYS.filter(
  (key) => SECTION_PRESETS[key].dependsOn.includes("collections")
);
