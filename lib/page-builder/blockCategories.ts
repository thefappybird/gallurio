/**
 * Block category groupings for the Puck component drawer — "Preset blocks"
 * (composed presets) and "Manual blocks" (barebones primitives).
 *
 * Kept in its own dependency-free module (NO block imports) so BOTH the server
 * `config.ts` and the client `editorConfig.tsx` can import it. Importing these
 * from `config.ts` would drag the server block graph (Mongo, node:async_hooks)
 * into the client bundle and break the build.
 */

// Preset blocks: composed sections (Container with a pre-filled slot).
export const PRESET_BLOCK_KEYS = [
  "HeroPreset",
  "AboutPreset",
  "ServicesPreset",
  "CtaPreset",
  "ContactPreset",
  "GalleryGridPreset",
  "GalleryMasonryPreset",
  "FeaturedWorkPreset",
 ] as const;

// Manual blocks: barebones primitives + the styleable Container/Columns
// drop-zones + the raw data-driven gallery/featured blocks.
export const MANUAL_BLOCK_KEYS = [
  "GalleryGrid",
  "GalleryMasonry",
  "GalleryCarousel",
  "FeaturedWork",
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
