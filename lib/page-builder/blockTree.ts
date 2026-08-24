/**
 * Pure Puck-tree block walker shared by the SEO collectors
 * (`lib/page-builder/seo/publishedImages*.ts`), the publish-time reconciler
 * (`lib/page-builder/reconcile.ts`), and any future code that needs to read
 * or rewrite every block in a published/drafted Puck tree.
 *
 * No `server-only`, no React, no DB import here — safe from both server-only
 * and plain modules, and trivially unit-testable.
 *
 * A published Puck tree nests real content blocks inside preset "slot" props
 * (e.g. `GalleryGridPreset.props.content = [Heading, Text, GalleryGrid]`),
 * not only in the top-level `content`/`zones` arrays. Both exports below walk
 * that full tree: root `content`, every `zones[*]` array, and recursively any
 * prop value shaped like a nested block array. `images`/`backgroundImages`
 * are never walked as block arrays — they hold image records, not blocks.
 */

import type { PuckData, PuckBlockEntry } from "@/lib/page-builder/types";

/** Props keys holding image records, never nested blocks — never recurse into these. */
const NON_BLOCK_ARRAY_PROPS = new Set(["images", "backgroundImages"]);

/** Recursion depth cap while walking untrusted persisted Puck JSON. */
const MAX_WALK_DEPTH = 10;

function isBlockEntry(value: unknown): value is PuckBlockEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown; props?: unknown };
  return typeof v.type === "string" && !!v.props && typeof v.props === "object" && !Array.isArray(v.props);
}

/**
 * Every block reachable from a Puck data tree: root content, every `zones`
 * array, and recursively any prop value shaped like a nested block array
 * (Puck slot fields). Guards cycles/pathological depth with a visited-set +
 * depth cap so a malformed tree can't hang or throw.
 */
export function collectBlocks(data: PuckData): PuckBlockEntry[] {
  const out: PuckBlockEntry[] = [];
  const visitedArrays = new WeakSet<object>();
  const visitedBlocks = new WeakSet<object>();

  function walk(arr: unknown, depth: number): void {
    if (depth > MAX_WALK_DEPTH || !Array.isArray(arr) || visitedArrays.has(arr)) return;
    visitedArrays.add(arr);
    for (const item of arr) {
      if (isBlockEntry(item)) {
        if (visitedBlocks.has(item)) continue;
        visitedBlocks.add(item);
        out.push(item);
        for (const [key, value] of Object.entries(item.props)) {
          if (NON_BLOCK_ARRAY_PROPS.has(key)) continue;
          if (Array.isArray(value)) walk(value, depth + 1);
        }
      } else if (Array.isArray(item)) {
        walk(item, depth + 1);
      }
    }
  }

  walk(data.content, 0);
  if (data.zones) {
    for (const key of Object.keys(data.zones)) {
      walk(data.zones[key], 0);
    }
  }
  return out;
}

/**
 * Immutably rebuilds a Puck data tree, applying `fn` to every block reachable
 * at every depth — root content, every zone, and every nested slot array
 * reached through a block's own props (mirrors `collectBlocks`'s traversal).
 * `fn` receives one block and must return a block; return the SAME reference
 * when nothing about that block changed, so unaffected subtrees keep
 * reference identity (no spurious diffs downstream). Never mutates `data` or
 * any block; preserves key order, non-block props, `zones`, and the exact
 * structure everywhere `fn` made no change.
 */
export function mapBlocks(data: PuckData, fn: (block: PuckBlockEntry) => PuckBlockEntry): PuckData {
  const visitedArrays = new WeakSet<object>();
  const visitedBlocks = new WeakSet<object>();

  function rebuildArray(arr: unknown, depth: number): unknown {
    if (depth > MAX_WALK_DEPTH || !Array.isArray(arr) || visitedArrays.has(arr)) return arr;
    visitedArrays.add(arr);
    let changed = false;
    const next = arr.map((item) => {
      if (isBlockEntry(item)) {
        if (visitedBlocks.has(item)) return item;
        visitedBlocks.add(item);
        const transformed = fn(item);
        let nextProps = transformed.props;
        let propsChanged = false;
        for (const [key, value] of Object.entries(transformed.props)) {
          if (NON_BLOCK_ARRAY_PROPS.has(key)) continue;
          if (Array.isArray(value)) {
            const nextValue = rebuildArray(value, depth + 1);
            if (nextValue !== value) {
              if (!propsChanged) nextProps = { ...transformed.props };
              nextProps[key] = nextValue;
              propsChanged = true;
            }
          }
        }
        const result = propsChanged ? { ...transformed, props: nextProps } : transformed;
        if (result !== item) changed = true;
        return result;
      }
      if (Array.isArray(item)) {
        const nextItem = rebuildArray(item, depth + 1);
        if (nextItem !== item) changed = true;
        return nextItem;
      }
      return item;
    });
    return changed ? next : arr;
  }

  const nextContent = rebuildArray(data.content, 0) as PuckBlockEntry[];
  let nextZones = data.zones;
  if (data.zones) {
    const rebuiltZones: Record<string, PuckBlockEntry[]> = {};
    let zonesChanged = false;
    for (const key of Object.keys(data.zones)) {
      const arr = data.zones[key];
      const nextArr = Array.isArray(arr) ? (rebuildArray(arr, 0) as PuckBlockEntry[]) : arr;
      rebuiltZones[key] = nextArr;
      if (nextArr !== arr) zonesChanged = true;
    }
    nextZones = zonesChanged ? rebuiltZones : data.zones;
  }

  if (nextContent === data.content && nextZones === data.zones) return data;
  return { ...data, content: nextContent, zones: nextZones };
}
