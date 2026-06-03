/**
 * Block category groupings for the Puck component drawer — "Preset blocks"
 * (composed presets) and "Manual blocks" (barebones primitives).
 *
 * Kept in its own dependency-free module (NO block imports) so BOTH the server
 * `config.ts` and the client `editorConfig.tsx` can import it. Importing these
 * from `config.ts` would drag the server block graph (Mongo, node:async_hooks)
 * into the client bundle and break the build.
 */

export const PRESET_BLOCK_KEYS = [
  "Hero",
  "About",
  "ServicesList",
  "GalleryGrid",
  "GalleryMasonry",
  "GalleryCarousel",
  "FeaturedWork",
  "Video",
  "CTABanner",
  "ContactCard",
] as const;

export const MANUAL_BLOCK_KEYS = [
  "Heading",
  "Text",
  "Image",
  "Button",
  "Columns",
  "Container",
  "Spacer",
  "Divider",
] as const;
