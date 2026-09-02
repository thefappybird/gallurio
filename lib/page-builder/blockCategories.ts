/**
 * Block category groupings for the Puck component drawer.
 *
 * Section presets are grouped by section type (11 collapsible categories, three
 * variants each) — see `PRESET_GROUPS` in `blocks/sectionPresets.ts`, which is
 * the single registry those categories and keys derive from. "Manual blocks"
 * (barebones primitives) stays one collapsed category and is listed by hand.
 *
 * Kept free of RUNTIME block imports so BOTH the server `config.ts` and the
 * client `editorConfig.tsx` can import it: the preset registry is pure data and
 * imports `ContainerBlockProps` type-only, so nothing here drags the server
 * block graph (Mongo, node:async_hooks) into the client bundle.
 */

import { SECTION_PRESET_KEYS } from "./blocks/sectionPresets";

// Preset blocks: composed sections (Container with a pre-filled slot).
// Derived from the registry so the two can never drift apart.
export const PRESET_BLOCK_KEYS = SECTION_PRESET_KEYS;

// Manual blocks: barebones primitives + the styleable Container/Columns
// drop-zones + the gallery layout blocks. FeaturedWork stays registered solely
// for saved pages; new compositions use Columns plus individually editable
// CollectionCard blocks.
export const MANUAL_BLOCK_KEYS = [
  "GalleryGrid",
  "GalleryMasonry",
  "CollectionCard",
  "Heading",
  "Text",
  "Image",
  "Button",
  "Video",
  "Columns",
  "Container",
  "ContactDetails",
  "Spacer",
  "Divider",
] as const;

export type ManualBlockKey = (typeof MANUAL_BLOCK_KEYS)[number];

/** Drawer help copy for the small building blocks. Presets have the same
 * metadata on SECTION_PRESETS; manual blocks live here because this is their
 * insertable registry. */
export const MANUAL_BLOCK_METADATA = {
  GalleryGrid: {
    descriptionKey: "puckConfig.manualDescriptions.galleryGrid",
    description: "Displays selected gallery images in an editable row-and-column grid.",
  },
  GalleryMasonry: {
    descriptionKey: "puckConfig.manualDescriptions.galleryMasonry",
    description: "Displays selected gallery images in staggered columns that preserve their proportions.",
  },
  CollectionCard: {
    descriptionKey: "puckConfig.manualDescriptions.collectionCard",
    description: "Links to one gallery collection with an editable cover, title, and caption.",
  },
  Heading: {
    descriptionKey: "puckConfig.manualDescriptions.heading",
    description: "Adds an editable heading with level, typography, color, and alignment controls.",
  },
  Text: {
    descriptionKey: "puckConfig.manualDescriptions.text",
    description: "Adds editable body copy with typography, color, width, and alignment controls.",
  },
  Image: {
    descriptionKey: "puckConfig.manualDescriptions.image",
    description: "Adds one editable image with crop, size, radius, and alt-text controls.",
  },
  Button: {
    descriptionKey: "puckConfig.manualDescriptions.button",
    description: "Adds a call-to-action button that can open Contact or navigate between portfolio pages.",
  },
  Video: {
    descriptionKey: "puckConfig.manualDescriptions.video",
    description: "Embeds a YouTube or Vimeo video with an optional heading and caption.",
  },
  Columns: {
    descriptionKey: "puckConfig.manualDescriptions.columns",
    description: "Creates a responsive grid where blocks can be placed and resized across columns and rows.",
  },
  Container: {
    descriptionKey: "puckConfig.manualDescriptions.container",
    description: "Creates a styled section that groups blocks with its own spacing, alignment, and background.",
  },
  ContactDetails: {
    descriptionKey: "puckConfig.manualDescriptions.contactDetails",
    description: "Shows the workspace email, phone, and address from your contact settings.",
  },
  Spacer: {
    descriptionKey: "puckConfig.manualDescriptions.spacer",
    description: "Adds adjustable empty vertical space between blocks.",
  },
  Divider: {
    descriptionKey: "puckConfig.manualDescriptions.divider",
    description: "Adds a horizontal rule with adjustable width, thickness, color, and spacing.",
  },
} as const satisfies Record<
  ManualBlockKey,
  { descriptionKey: string; description: string }
>;

export const MANUAL_BLOCK_DESCRIPTION_KEYS = Object.fromEntries(
  MANUAL_BLOCK_KEYS.map((key) => [key, MANUAL_BLOCK_METADATA[key].descriptionKey]),
) as Record<ManualBlockKey, string>;

export function isManualBlockKey(key: string): key is ManualBlockKey {
  return (MANUAL_BLOCK_KEYS as readonly string[]).includes(key);
}
