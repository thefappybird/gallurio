/**
 * Pure Discover listing rules. `listedAt` is set once, when it is null and the
 * write leaves the workspace published AND listed. It is never reset.
 */
export function listingSet(
  prev: { listed?: boolean; listedAt: Date | null },
  next: { listed: boolean; published: boolean },
  now: Date,
): Record<string, unknown> {
  const set: Record<string, unknown> = { "discover.listed": next.listed };
  if (prev.listedAt == null && next.published && next.listed) {
    set["discover.listedAt"] = now;
  }
  return set;
}
