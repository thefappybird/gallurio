/**
 * Guarantees every block in a Puck tree has a string `props.id`.
 *
 * Puck's RSC slot renderer keys each rendered child by `item.props.id`
 * (`@puckeditor/core/dist/chunk-YQWFSBOU.mjs`'s SlotRenderInternal:
 * `content.map((item) => jsx(Item, {config, item, metadata}, item.props.id))`).
 * Template-authored nested slot children intentionally carry no id (see
 * `templates/_blocks.ts`'s header), and persisted template-seed drafts /
 * published pages are raw template data — so every id-less child renders
 * with `key={undefined}`, tripping React's "unique key" warning.
 *
 * This fills in a DETERMINISTIC id — derived from tree position, never
 * random — for every block missing one, so a server render and a client
 * render of the same data produce the same ids. Existing ids are NEVER
 * changed. Root-level children (root `content`, and each `zones[key]`
 * array) without an id get `root-<index>` / `zone-<zoneKey>-<index>`;
 * nested slot children get `<parentId>--<slotName>-<index>`.
 *
 * `mapBlocks` (blockTree.ts) can't do this directly: its per-block callback
 * receives only the block, with no parent-id/slot-name/index context, which
 * a path-derived id needs. This walker mirrors mapBlocks's traversal rules
 * (root content, every `zones[]` array, nested slot arrays reached through
 * any non-`NON_BLOCK_ARRAY_PROPS` prop, the same cycle/depth guards) but
 * threads that extra context through instead.
 */

import type { PuckBlockEntry, PuckData } from "@/lib/page-builder/types";
import { NON_BLOCK_ARRAY_PROPS, MAX_WALK_DEPTH, isBlockEntry } from "@/lib/page-builder/blockTree";

function hasStringId(props: Record<string, unknown>): boolean {
  return typeof props.id === "string" && props.id.length > 0;
}

export function ensureBlockIds(data: PuckData): PuckData {
  const visitedArrays = new WeakSet<object>();
  const visitedBlocks = new WeakSet<object>();

  function rebuildArray(arr: unknown, rootLabel: string, depth: number): unknown {
    if (depth > MAX_WALK_DEPTH || !Array.isArray(arr) || visitedArrays.has(arr)) return arr;
    visitedArrays.add(arr);
    let changed = false;
    const next = arr.map((item, index) => {
      if (isBlockEntry(item)) {
        if (visitedBlocks.has(item)) return item;
        visitedBlocks.add(item);
        const needsId = !hasStringId(item.props);
        const ownId = needsId ? `${rootLabel}-${index}` : (item.props.id as string);
        let nextProps: Record<string, unknown> = needsId ? { ...item.props, id: ownId } : item.props;
        let propsChanged = needsId;
        for (const [key, value] of Object.entries(item.props)) {
          if (NON_BLOCK_ARRAY_PROPS.has(key)) continue;
          if (Array.isArray(value)) {
            const nextValue = rebuildArray(value, `${ownId}--${key}`, depth + 1);
            if (nextValue !== value) {
              if (!propsChanged) nextProps = { ...nextProps };
              nextProps[key] = nextValue;
              propsChanged = true;
            }
          }
        }
        const result = propsChanged ? { ...item, props: nextProps } : item;
        if (result !== item) changed = true;
        return result;
      }
      if (Array.isArray(item)) {
        const nextItem = rebuildArray(item, rootLabel, depth + 1);
        if (nextItem !== item) changed = true;
        return nextItem;
      }
      return item;
    });
    return changed ? next : arr;
  }

  const nextContent = rebuildArray(data.content, "root", 0) as PuckBlockEntry[];
  let nextZones = data.zones;
  if (data.zones) {
    const rebuiltZones: Record<string, PuckBlockEntry[]> = {};
    let zonesChanged = false;
    for (const key of Object.keys(data.zones)) {
      const arr = data.zones[key];
      const nextArr = Array.isArray(arr) ? (rebuildArray(arr, `zone-${key}`, 0) as PuckBlockEntry[]) : arr;
      rebuiltZones[key] = nextArr;
      if (nextArr !== arr) zonesChanged = true;
    }
    nextZones = zonesChanged ? rebuiltZones : data.zones;
  }

  if (nextContent === data.content && nextZones === data.zones) return data;
  return { ...data, content: nextContent, zones: nextZones };
}
