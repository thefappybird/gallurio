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
import { navigationDefaultProps } from "./blocks/NavigationBlock";
import { SECTION_PRESETS, SECTION_PRESET_KEYS } from "./blocks/sectionPresets";

// Map of block type → its defaultProps.
// Preset blocks (HeroPreset, etc.) mostly share the ContainerBlockProps shape,
// so every registry key falls back to containerDefaultProps for normalization
// — EXCEPT the `nav` group's 3 keys (componentType: "Navigation"), which fall
// back to navigationDefaultProps instead. Derived off the registry so a new/
// renamed/re-typed preset can't be missed by hand.
const BLOCK_DEFAULTS: Record<string, Record<string, unknown>> = {
  Heading: headingDefaultProps as Record<string, unknown>,
  Text: textDefaultProps as Record<string, unknown>,
  Image: imageDefaultProps as Record<string, unknown>,
  Button: buttonDefaultProps as Record<string, unknown>,
  Spacer: spacerDefaultProps as Record<string, unknown>,
  Divider: dividerDefaultProps as Record<string, unknown>,
  Columns: columnsDefaultProps as Record<string, unknown>,
  Container: containerDefaultProps as Record<string, unknown>,
  Navigation: navigationDefaultProps as Record<string, unknown>,
  GalleryGrid: galleryGridDefaultProps as Record<string, unknown>,
  GalleryMasonry: galleryMasonryDefaultProps as Record<string, unknown>,
  FeaturedWork: featuredWorkDefaultProps as Record<string, unknown>,
  ...Object.fromEntries(
    SECTION_PRESET_KEYS.map((key) => [
      key,
      (SECTION_PRESETS[key].componentType === "Navigation"
        ? navigationDefaultProps
        : containerDefaultProps) as Record<string, unknown>,
    ]),
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

const MASONRY_SLOT_KEYS = ["content", "column1", "column2", "column3", "column4"] as const;

function masonryColumnCount(props: Record<string, unknown>): 2 | 3 | 4 {
  const style = props._style as Record<string, unknown> | undefined;
  const columns = style?.galleryColumns;
  return columns === 2 || columns === 4 ? columns : 3;
}

function distributeMasonryItems(items: BlockEntry[], columns: 2 | 3 | 4): BlockEntry[][] {
  const lanes = Array.from({ length: columns }, () => [] as BlockEntry[]);
  items.forEach((item, index) => lanes[index % columns].push(item));
  return lanes;
}

/**
 * Upgrades the retired single-flow Masonry slot to independent column lanes.
 * Puck stores an established slot in `zones`, while freshly composed preset
 * data can still carry the same children inline in props, so both shapes must
 * migrate. This is editor-load-only and becomes persistent on the next save;
 * the renderer keeps its legacy fallback for pages that have not been edited.
 */
function migrateMasonryLanes(data: PuckDataLike): PuckDataLike {
  const sourceZones = data.zones
    ? Object.fromEntries(Object.entries(data.zones).map(([key, items]) => [key, [...items]]))
    : undefined;
  const zoneMigrations: Array<{ id: string; columns: 2 | 3 | 4 }> = [];

  const migrateEntry = (block: BlockEntry): BlockEntry => {
    let props = { ...block.props };

    // Preset data may contain nested slots inline before Puck expands them into
    // zones. Walk all Masonry slot shapes so nested blocks are upgraded too.
    for (const key of MASONRY_SLOT_KEYS) {
      const items = props[key];
      if (Array.isArray(items)) props[key] = items.map((item) => migrateEntry(item as BlockEntry));
    }

    if (block.type !== "GalleryMasonry" || props.masonryLayout === "columns") {
      return { ...block, props };
    }

    const columns = masonryColumnCount(props);
    const id = typeof props.id === "string" ? props.id : undefined;
    const flowZoneKey = id ? `${id}:content` : undefined;
    const flowZoneItems = flowZoneKey && sourceZones ? sourceZones[flowZoneKey] ?? [] : [];
    const inlineItems = Array.isArray(props.content) ? (props.content as BlockEntry[]) : [];
    const sourceItems = flowZoneItems.length > 0 ? flowZoneItems : inlineItems;
    const lanes = distributeMasonryItems(sourceItems, columns);

    props = { ...props, masonryLayout: "columns", content: [] };
    if (flowZoneItems.length > 0 && id && sourceZones) {
      zoneMigrations.push({ id, columns });
    } else {
      lanes.forEach((items, index) => {
        props[`column${index + 1}`] = items;
      });
    }

    return { ...block, props };
  };

  const content = (data.content ?? []).map(migrateEntry);
  const zones = sourceZones
    ? Object.fromEntries(Object.entries(sourceZones).map(([key, items]) => [key, items.map(migrateEntry)]))
    : undefined;
  if (zones) {
    for (const { id, columns } of zoneMigrations) {
      const flowZoneKey = `${id}:content`;
      const lanes = distributeMasonryItems(zones[flowZoneKey] ?? [], columns);
      lanes.forEach((items, index) => {
        zones[`${id}:column${index + 1}`] = items;
      });
      delete zones[flowZoneKey];
    }
  }

  return { root: data.root, content, zones };
}

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
  const migrated = migrateMasonryLanes(data);
  return {
    root: migrated.root,
    content: fillItems(migrated.content ?? []),
    zones: migrated.zones
      ? Object.fromEntries(
          Object.entries(migrated.zones).map(([k, v]) => [k, fillItems(v)]),
        )
      : migrated.zones,
  };
}
