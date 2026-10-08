import type { SortDir } from "./sort";

/**
 * Header click cycle: unsorted -> asc -> desc -> unsorted (null = reset).
 * Always asc first; a different column starts at asc.
 */
export function nextSort(
  activeKey: string | null,
  activeDir: SortDir,
  clickedKey: string
): { key: string; dir: SortDir } | null {
  if (clickedKey !== activeKey) return { key: clickedKey, dir: "asc" };
  return activeDir === "asc" ? { key: clickedKey, dir: "desc" } : null;
}
