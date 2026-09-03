/**
 * Container anchors are editor-only drop targets. Puck does not run component
 * resolveData after every remove/move, so this reconciler is invoked from the
 * live editor store as well as from Container.resolveData.
 *
 * Whether the anchor is kept at all (appended as the LAST child) depends on
 * the slot's real children — see shouldKeepAnchor. Its rendered height (full
 * footprint / 4px bridge) is decided by EditorContainerAnchor from live
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

/**
 * Canonical anchor layout for ONE Container slot: every real child in its
 * existing order, followed by exactly one anchor with the id `${id}--anchor`.
 * Returns the SAME array reference when `content` already matches.
 *
 * Both anchor writers go through this — the live store reconciler below and
 * the Container `resolveData` resolver in editorConfig. They used to disagree:
 * the resolver stripped every anchor as soon as a container had real children,
 * while the reconciler appended one straight back on the next store tick, so
 * Puck and the editor store ping-ponged `setData` forever (Puck's "setData is
 * expensive" warning on repeat, plus continuous canvas relayout).
 */
export function reconcileContainerSlot(id: unknown, content: SlotItem[]): SlotItem[] {
  const realChildren = content.filter((child) => !isAnchor(child));

  // Puck supplies a stable id for every editor item. Without one, do not
  // invent a transient anchor that would churn on the next reconciliation —
  // just strip any stray anchor instead.
  if (!shouldKeepAnchor(realChildren) || typeof id !== "string" || !id) {
    return content.length === realChildren.length ? content : realChildren;
  }

  const anchorId = `${id}--anchor`;
  const desiredContent = [
    ...realChildren,
    { type: "ContainerAnchor", props: { id: anchorId, height: 0 } } satisfies SlotItem,
  ];

  const alreadyCorrect =
    content.length === desiredContent.length &&
    content.every((child, i) => {
      const want = desiredContent[i];
      if (isAnchor(want)) return isAnchor(child) && child.props.id === anchorId;
      return child === want;
    });

  return alreadyCorrect ? content : desiredContent;
}

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
    const desiredContent = reconcileContainerSlot(nextItem.props.id, content);
    if (desiredContent === content) return nextItem;

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
