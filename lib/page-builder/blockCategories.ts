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
// drop-zones + the raw data-driven gallery/featured blocks.
export const MANUAL_BLOCK_KEYS = [
  "GalleryGrid",
  "GalleryMasonry",
  "FeaturedWork",
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
