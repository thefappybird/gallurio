import type { BlockStyle } from "./styleToolkit";

type SlotItem = { type: string; props: Record<string, unknown> };
type PuckTreeData = {
  content?: SlotItem[];
  zones?: Record<string, SlotItem[]>;
  [key: string]: unknown;
};

const SLOT_KEYS = ["content", "column1", "column2", "column3", "column4"] as const;
const GAP_PX = { tight: 4, normal: 12, loose: 24 } as const;
const isClone = (item: SlotItem) => item.type === "MasonryClone";

function withoutId(props: Record<string, unknown>) {
  const rest = { ...props };
  delete rest.id;
  return rest;
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function reconcileLane(
  items: SlotItem[],
  clone: SlotItem | null,
): SlotItem[] {
  const real = items.filter((item) => !isClone(item));
  const desired = clone ? [...real, clone] : real;
  if (items.length !== desired.length) return desired;
  for (let index = 0; index < desired.length; index += 1) {
    const current = items[index];
    const next = desired[index];
    if (current === next) continue;
    if (isClone(current) && isClone(next) && sameJson(current.props, next.props)) continue;
    return desired;
  }
  return items;
}

function cloneFor(
  masonryId: string,
  column: number,
  source: SlotItem,
  gap: number,
  layoutSignature: string,
): SlotItem {
  return {
    type: "MasonryClone",
    props: {
      id: `${masonryId}--clone-${column}`,
      masonryId,
      column,
      gap,
      sourceId: String(source.props.id ?? ""),
      imageProps: withoutId(source.props),
      layoutSignature,
    },
  };
}

function reconcileMasonryLanes(
  props: Record<string, unknown>,
  readLane: (column: number) => SlotItem[],
  writeLane: (column: number, items: SlotItem[]) => void,
) {
  const style = (props._style ?? {}) as BlockStyle;
  const columns = style.galleryColumns === 2 || style.galleryColumns === 4 ? style.galleryColumns : 3;
  const masonryId = String(props.id ?? "masonry");
  // Fresh preset lanes are nested under column1..column4. EditorShell's generic
  // ID pass historically only walked `content`, so these children can reach the
  // reconciler without the stable id that both Puck and a linked clone require.
  const laneItems = Array.from({ length: 4 }, (_, index) => {
    const column = index + 1;
    const lane = readLane(column);
    let changed = false;
    const normalized = lane.map((item, itemIndex) => {
      if (typeof item.props.id === "string" && item.props.id) return item;
      changed = true;
      return {
        ...item,
        props: { ...item.props, id: `${masonryId}--column-${column}-item-${itemIndex + 1}` },
      };
    });
    if (changed) writeLane(column, normalized);
    return changed ? normalized : lane;
  });
  const realLanes = laneItems.map((lane) => lane.filter((item) => !isClone(item)));
  const eligible = props.masonryLoop === true
    && props.masonryLayout !== "flow"
    && realLanes.slice(0, columns).every((lane) => lane.filter((item) => item.type === "Image").length >= 3);
  const gap = GAP_PX[style.galleryGap ?? "normal"];
  const layoutSignature = JSON.stringify(realLanes.slice(0, columns).map((lane) =>
    lane.map((item) => [item.type, item.props.id, item.props._style]),
  ));

  for (let index = 0; index < 4; index += 1) {
    const lane = laneItems[index];
    const source = realLanes[index].find((item) => item.type === "Image");
    const clone = eligible && index < columns && source
      ? cloneFor(masonryId, index + 1, source, gap, layoutSignature)
      : null;
    const next = reconcileLane(lane, clone);
    if (next !== lane) writeLane(index + 1, next);
  }
}

/** Keeps internal MasonryClone children synchronized with every live Puck edit. */
export function reconcileMasonryClones<T extends PuckTreeData>(data: T): T {
  const sourceZones = data.zones;
  let zones = sourceZones;
  let changed = false;
  const zonedMasonry: Array<Record<string, unknown>> = [];

  const visitItems = (items: SlotItem[]): SlotItem[] => {
    let itemsChanged = false;
    const next = items.map((item) => {
      let props = item.props;
      for (const key of SLOT_KEYS) {
        const children = props[key];
        if (!Array.isArray(children)) continue;
        const migrated = visitItems(children as SlotItem[]);
        if (migrated !== children) {
          props = props === item.props ? { ...props } : props;
          props[key] = migrated;
        }
      }

      if (item.type === "GalleryMasonry") {
        const id = typeof props.id === "string" ? props.id : "";
        const usesZones = Boolean(id && sourceZones && Array.from({ length: 4 }, (_, index) =>
          `${id}:column${index + 1}`,
        ).some((key) => key in sourceZones));
        if (usesZones) {
          zonedMasonry.push(props);
        } else {
          const nextProps = props === item.props ? { ...props } : props;
          reconcileMasonryLanes(
            nextProps,
            (column) => Array.isArray(nextProps[`column${column}`]) ? nextProps[`column${column}`] as SlotItem[] : [],
            (column, lane) => { nextProps[`column${column}`] = lane; },
          );
          if (!sameJson(props, nextProps)) props = nextProps;
        }
      }

      if (props === item.props) return item;
      itemsChanged = true;
      return { ...item, props };
    });
    return itemsChanged ? next : items;
  };

  const content = visitItems(data.content ?? []);
  if (content !== data.content) changed = true;
  if (sourceZones) {
    const mapped = Object.fromEntries(Object.entries(sourceZones).map(([key, items]) => {
      const next = visitItems(items);
      if (next !== items) changed = true;
      return [key, next];
    }));
    zones = changed ? mapped : sourceZones;
  }

  if (zones) {
    for (const props of zonedMasonry) {
      const id = String(props.id);
      reconcileMasonryLanes(
        props,
        (column) => zones?.[`${id}:column${column}`] ?? [],
        (column, lane) => {
          if (zones === sourceZones) zones = { ...sourceZones };
          zones![`${id}:column${column}`] = lane;
          changed = true;
        },
      );
    }
  }

  if (!changed) return data;
  return { ...data, content, ...(zones ? { zones } : {}) } as T;
}
