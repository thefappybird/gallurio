/**
 * Container anchors are editor-only empty-state drop targets. Puck does not run
 * component resolveData after every remove/move, so this reconciler is invoked
 * from the live editor store as well as from Container.resolveData.
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

function reconcileItems(items: SlotItem[]): { items: SlotItem[]; changed: boolean } {
  let changed = false;
  const nextItems = items.map((item) => {
    const childContent = item.props.content;
    const nested = Array.isArray(childContent)
      ? reconcileItems(childContent as SlotItem[])
      : null;

    let nextItem = item;
    if (nested?.changed) {
      nextItem = {
        ...nextItem,
        props: { ...nextItem.props, content: nested.items },
      };
      changed = true;
    }

    // Only actual Container blocks own a ContainerAnchor. Preset sections use
    // the same visual renderer but deliberately retain their authored content.
    if (nextItem.type !== "Container") return nextItem;

    const content = Array.isArray(nextItem.props.content)
      ? nextItem.props.content as SlotItem[]
      : [];
    const realChildren = content.filter((child) => !isAnchor(child));
    const id = nextItem.props.id;

    if (realChildren.length > 0) {
      if (content.length === realChildren.length) return nextItem;
      changed = true;
      return { ...nextItem, props: { ...nextItem.props, content: realChildren } };
    }

    // Puck supplies a stable id for every editor item. Without one, do not
    // invent a transient anchor that would churn on the next reconciliation.
    if (typeof id !== "string" || !id) return nextItem;
    const anchorId = `${id}--anchor`;
    const currentAnchor = content.length === 1 && content[0] && isAnchor(content[0]);
    if (currentAnchor && content[0].props.id === anchorId) return nextItem;

    changed = true;
    return {
      ...nextItem,
      props: {
        ...nextItem.props,
        content: [{ type: "ContainerAnchor", props: { id: anchorId, height: 0 } }],
      },
    };
  });

  return { items: changed ? nextItems : items, changed };
}

/**
 * Returns the original data reference when every Container is already correct;
 * otherwise returns a structurally shared normalized copy for Puck's setData.
 */
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
