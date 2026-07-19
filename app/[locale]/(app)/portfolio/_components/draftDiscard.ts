/**
 * Decides what clean canvas state to restore when the user discards unsaved
 * changes (UnsavedChangesDialog → Discard).
 *
 * - A previously-saved draft (has an id) is re-fetched from the DB so the canvas
 *   matches what is stored.
 * - A new, never-saved draft has no record to revert to, so it is dropped and
 *   the next available draft is opened — or an empty scratch canvas when none
 *   remain.
 *
 * `drafts` is expected newest-first (as `listDraftsAction` returns them).
 */
export type DiscardTarget =
  | { type: "refetch"; id: string }
  | { type: "open"; id: string }
  | { type: "scratch" };

export function resolveDiscardTarget(
  activeDraftId: string | null,
  drafts: { id: string }[],
): DiscardTarget {
  if (activeDraftId !== null) return { type: "refetch", id: activeDraftId };
  const next = drafts[0];
  return next ? { type: "open", id: next.id } : { type: "scratch" };
}
