import { shouldKeepAnchor } from "./containerAnchorPredicate";

type SlotItem = {
  type: string;
  props: Record<string, unknown>;
};

type PuckTreeData = {
  content?: SlotItem[];
  zones?: Record<string, SlotItem[]>;
  [key: string]: unknown;
};

const isAnchor = (item: SlotItem) => item.type === "ContainerAnchor";

/**
 * Keep one editor-only anchor at the end of every empty/container-only slot.
 * It restores the durable Puck drop bridge without manufacturing visual margin.
 */
export function reconcileContainerSlot(id: unknown, content: SlotItem[]): SlotItem[] {
  const realChildren = content.filter((child) => !isAnchor(child));
  if (!shouldKeepAnchor(realChildren)) {
    return content.length === realChildren.length ? content : realChildren;
  }

  const parentId = typeof id === "string" && id.length > 0 ? id : "container";
  const anchorId = `${parentId}--anchor`;
  const alreadyCanonical = content.length === realChildren.length + 1
    && content.at(-1)?.type === "ContainerAnchor"
    && content.at(-1)?.props.id === anchorId;
  if (alreadyCanonical) return content;

  return [...realChildren, { type: "ContainerAnchor", props: { id: anchorId, height: 0 } }];
}

function reconcileItems(items: SlotItem[]): { items: SlotItem[]; changed: boolean } {
  let changed = false;
  const nextItems = items.map((item) => {
    const childContent = item.props.content;
    const nested = Array.isArray(childContent) ? reconcileItems(childContent as SlotItem[]) : null;

    let nextItem = item;
    if (nested?.changed) {
      nextItem = { ...nextItem, props: { ...nextItem.props, content: nested.items } };
      changed = true;
    }

    if (nextItem.type !== "Container") return nextItem;

    const content = Array.isArray(nextItem.props.content) ? nextItem.props.content as SlotItem[] : [];
    const desiredContent = reconcileContainerSlot(nextItem.props.id, content);
    if (desiredContent === content) return nextItem;

    changed = true;
    return { ...nextItem, props: { ...nextItem.props, content: desiredContent } };
  });

  return { items: changed ? nextItems : items, changed };
}

/** Normalize editor-only anchors with structural sharing for Puck's setData. */
export function reconcileContainerAnchors<T extends PuckTreeData>(data: T): T {
  const content = reconcileItems((data.content ?? []) as SlotItem[]);
  let zonesChanged = false;
  const zones = data.zones
    ? Object.fromEntries(Object.entries(data.zones).map(([zone, items]) => {
      const next = reconcileItems(items);
      if (next.changed) zonesChanged = true;
      return [zone, next.items];
    }))
    : undefined;

  if (!content.changed && !zonesChanged) return data;
  return {
    ...data,
    ...(content.changed ? { content: content.items } : {}),
    ...(zonesChanged ? { zones } : {}),
  } as T;
}
