import { SORT_CONFIG, type SortDir, type SortTable } from "./sort";

/** Next direction for a header click: flip the active column, else the new column's natural dir. */
export function nextSortDir(
  table: SortTable,
  activeKey: string,
  activeDir: SortDir,
  clickedKey: string
): SortDir {
  if (clickedKey === activeKey) return activeDir === "asc" ? "desc" : "asc";
  const columns: Record<string, { defaultDir?: SortDir }> = SORT_CONFIG[table].columns;
  return columns[clickedKey]?.defaultDir ?? "asc";
}
