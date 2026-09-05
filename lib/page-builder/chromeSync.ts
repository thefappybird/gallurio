/**
 * Pure sync layer for "chrome" blocks (Navigation, Footer) that mirror
 * across the `home` and `gallery` Puck zones.
 *
 * No React, no DOM, no Puck runtime imports beyond types. Every exported
 * function returns new objects and never mutates its inputs; a genuine
 * no-op returns the same input reference.
 */
import type { ComponentData, Data } from "@measured/puck";

export type ChromeKind = "nav" | "footer";

export type ZoneKey = "home" | "gallery";

export type Zones = Record<ZoneKey, Data>;

export type IdFactory = () => string;

type ChromeProps = {
  id: string;
  _chrome?: ChromeKind;
  detached?: boolean;
  [key: string]: unknown;
};

const defaultIdFactory: IdFactory = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;

export function otherZoneOf(zone: ZoneKey): ZoneKey {
  return zone === "home" ? "gallery" : "home";
}

function chromeKindOf(block: ComponentData): ChromeKind | undefined {
  return (block.props as ChromeProps)._chrome;
}

function isDetached(block: ComponentData): boolean {
  return (block.props as ChromeProps).detached === true;
}

/** A slot prop's value is an array of Puck ComponentData entries. */
function isComponentDataArray(value: unknown): value is ComponentData[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as { type?: unknown }).type === "string" &&
        typeof (item as { props?: { id?: unknown } }).props === "object" &&
        typeof (item as { props?: { id?: unknown } }).props?.id === "string",
    )
  );
}

/**
 * Clones `source` into a new ComponentData that takes `id` as its own top
 * level Puck id, and recursively regenerates ids (via `idFactory`) for every
 * ComponentData found in any slot-shaped prop — including slots nested
 * inside slot children. Non-slot props are shallow-copied.
 */
function cloneChromeBlock(
  source: ComponentData,
  id: string,
  idFactory: IdFactory,
): ComponentData {
  const newProps: Record<string, unknown> = { ...source.props, id };
  for (const key of Object.keys(newProps)) {
    const value = newProps[key];
    if (isComponentDataArray(value)) {
      newProps[key] = value.map((child) => remapIds(child, idFactory));
    }
  }
  return { ...source, props: newProps } as ComponentData;
}

/** Full fresh clone: the node itself and every nested slot child get a new id. */
function remapIds(node: ComponentData, idFactory: IdFactory): ComponentData {
  return cloneChromeBlock(node, idFactory(), idFactory);
}

/** First block in `zone.content` whose `props._chrome === kind`, else null. */
export function findChrome(zone: Data, kind: ChromeKind): ComponentData | null {
  const content = zone.content ?? [];
  for (const block of content) {
    if (chromeKindOf(block) === kind) return block;
  }
  return null;
}

/**
 * Mirrors the changed zone's chrome block of `kind` into the other zone, in
 * full (config props + slot children). No-op when either zone's chrome of
 * that kind is detached, or when the source has none and never had one.
 *
 * Deletion mirroring: when the source zone no longer has a `kind` block but
 * `previousSource` shows it had one (and it wasn't detached), the removal is
 * mirrored onto the other zone too — otherwise a later edit on the other
 * zone would re-sync a "new" chrome block right back in (see the deleted-
 * footer-never-sticks case). `previousSource` is the changed zone's OWN data
 * from immediately before this edit; omit it (or pass a zone that never had
 * the chrome) to keep the old no-op behavior. Navigation is pinned/
 * undeletable via Puck permissions, so this path only ever fires for Footer
 * in practice.
 */
export function syncChrome(
  zones: Zones,
  changedZone: ZoneKey,
  kind: ChromeKind,
  idFactory: IdFactory = defaultIdFactory,
  previousSource?: Data,
): Zones {
  const source = findChrome(zones[changedZone], kind);
  const otherZone = otherZoneOf(changedZone);

  if (!source) {
    const previousBlock = previousSource ? findChrome(previousSource, kind) : null;
    if (!previousBlock || isDetached(previousBlock)) return zones;
    const target = findChrome(zones[otherZone], kind);
    if (!target || isDetached(target)) return zones;
    const otherContent = (zones[otherZone].content ?? []).filter((block) => block !== target);
    return { ...zones, [otherZone]: { ...zones[otherZone], content: otherContent } };
  }
  if (isDetached(source)) return zones;

  const target = findChrome(zones[otherZone], kind);
  if (target && isDetached(target)) return zones;

  const otherContent = zones[otherZone].content ?? [];

  if (target) {
    const mirrored = cloneChromeBlock(source, (target.props as ChromeProps).id, idFactory);
    const newContent = otherContent.map((block) => (block === target ? mirrored : block));
    return { ...zones, [otherZone]: { ...zones[otherZone], content: newContent } };
  }

  const mirrored = remapIds(source, idFactory);
  const newContent =
    kind === "nav" ? [mirrored, ...otherContent] : [...otherContent, mirrored];
  return { ...zones, [otherZone]: { ...zones[otherZone], content: newContent } };
}

/**
 * Anchor wins: overwrites `detachedZone`'s chrome of `kind` with the anchor
 * zone's copy and clears `detached` on both. No-op if the named zone is not
 * actually detached for that kind, or the anchor has no chrome to copy.
 */
export function reanchorChrome(
  zones: Zones,
  detachedZone: ZoneKey,
  kind: ChromeKind,
  idFactory: IdFactory = defaultIdFactory,
): Zones {
  const detachedBlock = findChrome(zones[detachedZone], kind);
  if (!detachedBlock || !isDetached(detachedBlock)) return zones;

  const anchorZone = otherZoneOf(detachedZone);
  const anchorBlock = findChrome(zones[anchorZone], kind);
  if (!anchorBlock) return zones;

  const mirrored = cloneChromeBlock(
    anchorBlock,
    (detachedBlock.props as ChromeProps).id,
    idFactory,
  );
  mirrored.props = { ...mirrored.props, detached: false };

  const detachedContent = (zones[detachedZone].content ?? []).map((block) =>
    block === detachedBlock ? mirrored : block,
  );

  const result: Zones = {
    ...zones,
    [detachedZone]: { ...zones[detachedZone], content: detachedContent },
  };

  if (isDetached(anchorBlock)) {
    const clearedAnchor = { ...anchorBlock, props: { ...anchorBlock.props, detached: false } };
    const anchorContent = (zones[anchorZone].content ?? []).map((block) =>
      block === anchorBlock ? clearedAnchor : block,
    );
    result[anchorZone] = { ...zones[anchorZone], content: anchorContent };
  }

  return result;
}

/**
 * False when the other zone already holds a `detached` chrome block of this
 * `kind` — only one page per kind may be detached at a time.
 */
export function canDetach(zones: Zones, zone: ZoneKey, kind: ChromeKind): boolean {
  const otherBlock = findChrome(zones[otherZoneOf(zone)], kind);
  return !(otherBlock && isDetached(otherBlock));
}

/**
 * Recursively strips any `kind` chrome block found nested inside `block`'s
 * own slot-shaped props (not `block` itself — top-level chrome is handled
 * by the caller), collecting each into `found` in encounter order. Returns
 * the SAME reference when nothing changed anywhere in the subtree.
 */
function collectNestedChrome(
  block: ComponentData,
  kind: ChromeKind,
  found: ComponentData[],
): ComponentData {
  const props = block.props as Record<string, unknown>;
  const newProps: Record<string, unknown> = { ...props };
  let changed = false;
  for (const key of Object.keys(props)) {
    const value = props[key];
    if (!isComponentDataArray(value)) continue;
    let arrChanged = false;
    const walked: ComponentData[] = [];
    for (const child of value) {
      if (chromeKindOf(child) === kind) {
        found.push(child);
        arrChanged = true;
        continue;
      }
      const walkedChild = collectNestedChrome(child, kind, found);
      if (walkedChild !== child) arrChanged = true;
      walked.push(walkedChild);
    }
    if (arrChanged) {
      newProps[key] = walked;
      changed = true;
    }
  }
  return changed ? ({ ...block, props: newProps } as ComponentData) : block;
}

/**
 * Promotes a `kind` chrome block found nested inside another block's slot
 * (e.g. a Footer preset dropped into a Columns column instead of the zone's
 * own end-of-list target — a real drop-target ambiguity: a block that fills
 * the visible canvas leaves no accessible "outside" gap to aim for) back up
 * to the zone's top level, appended after the existing content. `_chrome`
 * only means anything at the top level — `findChrome`/`syncChrome`/
 * `normalizeChrome` never look inside slots, so a block left nested there is
 * permanently invisible to every chrome invariant: never mirrored, never
 * pinned, and no later edit ever surfaces it again.
 *
 * No-op (same reference) when no nested block of that kind exists anywhere
 * in the zone — including when the zone already has a top-level one; a
 * pre-existing top-level chrome block is untouched here, and any duplicate
 * this rescue produces is left for `normalizeChrome`'s existing collapse-to-
 * first rule to resolve.
 */
export function rescueNestedChrome(zone: Data, kind: ChromeKind): Data {
  const content = zone.content ?? [];
  const found: ComponentData[] = [];
  const walked = content.map((block) => collectNestedChrome(block, kind, found));
  if (found.length === 0) return zone;
  return { ...zone, content: [...walked, ...found] };
}

/**
 * Guarantees two chrome invariants at once: exactly one `_chrome === "nav"`
 * block at index 0, and at most one `_chrome === "footer"` block at the LAST
 * index. Displaced blocks move back to their pinned slot (the rest of the
 * order is preserved); duplicates of either kind collapse to the first,
 * dropping the extras.
 *
 * A zone with NO nav, or NO footer, is left alone on that axis — this
 * function must never invent either one. Injecting a default nav/footer
 * needs template/config data this pure module does not have; a later wave
 * (EditorShell's prepareForEditor) is responsible for that at the call site.
 * Footer stays optional: absence is a valid, unchanged state.
 */
export function normalizeChrome(zone: Data): Data {
  const content = zone.content ?? [];
  const navBlocks = content.filter((block) => chromeKindOf(block) === "nav");
  const footerBlocks = content.filter((block) => chromeKindOf(block) === "footer");
  if (navBlocks.length === 0 && footerBlocks.length === 0) return zone;

  const firstNav = navBlocks[0] ?? null;
  const firstFooter = footerBlocks[0] ?? null;

  const navOk = !firstNav || (content[0] === firstNav && navBlocks.length === 1);
  const footerOk =
    !firstFooter ||
    (content[content.length - 1] === firstFooter && footerBlocks.length === 1);
  if (navOk && footerOk) return zone;

  const rest = content.filter(
    (block) =>
      block !== firstNav &&
      block !== firstFooter &&
      chromeKindOf(block) !== "nav" &&
      chromeKindOf(block) !== "footer",
  );

  return {
    ...zone,
    content: [...(firstNav ? [firstNav] : []), ...rest, ...(firstFooter ? [firstFooter] : [])],
  };
}
