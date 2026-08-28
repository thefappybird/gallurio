/**
 * fillBlockDefaults — shallow-merges each block's saved props with the block's
 * defaultProps, filling MISSING keys only (never overwriting user values).
 *
 * This runs in the editor only, on load. It ensures that controls show pre-filled
 * defaults even for blocks saved before defaultProps was declared.
 *
 * Pure in-memory; persisted only when the user explicitly saves.
 * Does NOT run on the public renderer (uses defaultProps + render fallbacks instead).
 */

import {
  containerDefaultProps,
  columnsDefaultProps,
  headingDefaultProps,
  textDefaultProps,
  imageDefaultProps,
  buttonDefaultProps,
  spacerDefaultProps,
  dividerDefaultProps,
} from "./blocks/manualBlocks";
import { galleryGridDefaultProps } from "./blocks/GalleryGridBlock";
import { galleryMasonryDefaultProps } from "./blocks/GalleryMasonryBlock";
import { featuredWorkDefaultProps } from "./blocks/FeaturedWorkBlock";
import { SECTION_PRESET_KEYS } from "./blocks/sectionPresets";

// Map of block type → its defaultProps.
// Preset blocks (HeroPreset, etc.) all share the ContainerBlockProps shape, so
// every one of the registry's 33 keys falls back to containerDefaultProps for
// normalization — derived so a new/renamed preset can't be missed by hand.
const BLOCK_DEFAULTS: Record<string, Record<string, unknown>> = {
  Heading: headingDefaultProps as Record<string, unknown>,
  Text: textDefaultProps as Record<string, unknown>,
  Image: imageDefaultProps as Record<string, unknown>,
  Button: buttonDefaultProps as Record<string, unknown>,
  Spacer: spacerDefaultProps as Record<string, unknown>,
  Divider: dividerDefaultProps as Record<string, unknown>,
  Columns: columnsDefaultProps as Record<string, unknown>,
  Container: containerDefaultProps as Record<string, unknown>,
  GalleryGrid: galleryGridDefaultProps as Record<string, unknown>,
  GalleryMasonry: galleryMasonryDefaultProps as Record<string, unknown>,
  FeaturedWork: featuredWorkDefaultProps as Record<string, unknown>,
  ...Object.fromEntries(
    SECTION_PRESET_KEYS.map((key) => [key, containerDefaultProps as Record<string, unknown>]),
  ),
};

/**
 * Deep-merges `src` into `dst` in-place, filling MISSING keys only.
 * - Primitive keys: only added if not present in dst.
 * - Object keys: recursively merged (allows filling missing sub-keys inside _style).
 * - Arrays: never merged (arrays are owned outright by the saved value or default).
 */
function deepFillMissing(
  dst: Record<string, unknown>,
  src: Record<string, unknown>,
): void {
  for (const key of Object.keys(src)) {
    if (!(key in dst)) {
      // Key is missing in saved data — fill from default.
      // Deep-clone objects so mutations don't affect defaultProps.
      dst[key] =
        typeof src[key] === "object" &&
        src[key] !== null &&
        !Array.isArray(src[key])
          ? structuredClone(src[key])
          : src[key];
    } else if (
      typeof src[key] === "object" &&
      src[key] !== null &&
      !Array.isArray(src[key]) &&
      typeof dst[key] === "object" &&
      dst[key] !== null &&
      !Array.isArray(dst[key])
    ) {
      // Both sides are plain objects → recurse into sub-keys.
      deepFillMissing(
        dst[key] as Record<string, unknown>,
        src[key] as Record<string, unknown>,
      );
    }
    // else: dst already has this key with a non-object value — leave it (never overwrite).
  }
}

export type BlockEntry = { type: string; props: Record<string, unknown> };

/**
 * Back-compat: an Image block saved before the background-image redesign
 * (commit ee5084d) stored the picture as top-level `imagePublicId`/`imageUrl`
 * instead of `_style.bgImagePublicId`. Synthesize the new shape here so the
 * editor's Design-tab image picker (which reads `_style.bgImagePublicId`)
 * reflects the already-saved image instead of showing "no image chosen".
 * Handles the common Cloudflare-asset-id case; a raw `imageUrl` fallback with
 * no asset id has no Design-tab equivalent in the new schema and is left to
 * ImageBlock's own render-time fallback (still renders correctly, just isn't
 * "picked" in the panel).
 */
function migrateLegacyImageProps(block: BlockEntry): BlockEntry {
  if (block.type !== "Image") return block;
  const props = block.props;
  const style = (props._style ?? {}) as Record<string, unknown>;
  if (style.bgImagePublicId) return block; // already on the new shape
  const legacyId = props.imagePublicId;
  if (typeof legacyId !== "string" || !legacyId) return block;
  const rest = { ...props };
  delete rest.imagePublicId;
  delete rest.imageUrl;
  delete rest.fit;
  return {
    ...block,
    props: { ...rest, _style: { ...style, bgImagePublicId: legacyId } },
  };
}

/**
 * Fill defaults for a single block entry (mutates a shallow clone of props).
 */
function fillEntry(block: BlockEntry): BlockEntry {
  const migrated = migrateLegacyImageProps(block);
  const defaults = BLOCK_DEFAULTS[migrated.type];
  if (!defaults) return migrated;
  const props = { ...migrated.props };
  deepFillMissing(props, defaults);
  return { ...migrated, props };
}

/**
 * Fill defaults for an array of blocks (content or zone items).
 */
function fillItems(items: BlockEntry[]): BlockEntry[] {
  return items.map(fillEntry);
}

export type PuckDataLike = {
  root?: Record<string, unknown>;
  content: BlockEntry[];
  zones?: Record<string, BlockEntry[]>;
};

/**
 * Returns a new PuckData object with defaultProps filled into every block's props.
 * The input is NOT mutated.
 */
export function fillBlockDefaults(data: PuckDataLike): PuckDataLike {
  return {
    root: data.root,
    content: fillItems(data.content ?? []),
    zones: data.zones
      ? Object.fromEntries(
          Object.entries(data.zones).map(([k, v]) => [k, fillItems(v)]),
        )
      : data.zones,
  };
}
