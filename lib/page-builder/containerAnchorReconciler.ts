/**
 * Legacy ContainerAnchor blocks are removed from editor data. Containers now
 * expose real, editable margins for separation and drop affordance, so an
 * invisible child must never take part in Puck's layout or drag calculations.
 */

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

/** Strip every legacy anchor while retaining real children and their order. */
export function reconcileContainerSlot(_id: unknown, content: SlotItem[]): SlotItem[] {
  const realChildren = content.filter((child) => !isAnchor(child));
  return content.length === realChildren.length ? content : realChildren;
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

/** Remove legacy anchors with structural sharing for Puck's setData. */
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
