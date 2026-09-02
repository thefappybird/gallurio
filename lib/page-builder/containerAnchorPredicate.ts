/**
 * Shared predicate for container-anchor logic. A Container should keep its
 * editor drop anchor not only when empty, but also when every real child is
 * itself a container-class block (Container or Columns) — otherwise a
 * Container nesting only containers/columns has no droppable anchor left to
 * receive a sibling drop.
 */

export function isContainerClass(type: string): boolean {
  return type === "Container" || type === "Columns";
}

export function shouldKeepAnchor(realChildren: Array<{ type: string }>): boolean {
  return realChildren.length === 0 || realChildren.every((child) => isContainerClass(child.type));
}
