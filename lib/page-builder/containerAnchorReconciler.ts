/**
 * Container anchors are editor-only drop targets. Puck does not run component
 * resolveData after every remove/move, so this reconciler is invoked from the
 * live editor store as well as from Container.resolveData.
 *
 * The anchor is now always kept (appended as the LAST child) — see
 * shouldKeepAnchor. Its rendered height (full footprint / 4px bridge / flex-
 * fill leftover space / 0) is decided by EditorContainerAnchor from live
 * layout data, not here; this reconciler only maintains the anchor's
 * PRESENCE and stays a pure, idempotent function of the data.
 */

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
    const keepAnchor = shouldKeepAnchor();

    // Puck supplies a stable id for every editor item. Without one, do not
    // invent a transient anchor that would churn on the next reconciliation —
    // just strip any stray anchor instead.
    if (!keepAnchor || typeof id !== "string" || !id) {
      if (content.length === realChildren.length) return nextItem;
      changed = true;
      return { ...nextItem, props: { ...nextItem.props, content: realChildren } };
    }

    const anchorId = `${id}--anchor`;
    const anchorItem: SlotItem = { type: "ContainerAnchor", props: { id: anchorId, height: 0 } };
    const desiredContent = [...realChildren, anchorItem];

    const alreadyCorrect =
      content.length === desiredContent.length &&
      content.every((child, i) => {
        const want = desiredContent[i];
        if (isAnchor(want)) return isAnchor(child) && child.props.id === anchorId;
        return child === want;
      });
    if (alreadyCorrect) return nextItem;

    changed = true;
    return { ...nextItem, props: { ...nextItem.props, content: desiredContent } };
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
