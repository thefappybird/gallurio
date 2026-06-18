/**
 * Patch map for optimistic inquiry updates.
 * Fields beyond `status` are carried for consistent reconciliation even though
 * only `status` is currently rendered in the table.
 */
export type InquiryOptimisticPatch = Partial<{
  status: string;
  phone: string;
  total: number;
  deposit: number;
  notes: string;
}>;

/**
 * Apply a map of optimistic patches over an array of rows.
 * Each row is spread with its corresponding patch (if any) so the table
 * reflects modal edits immediately. Reconciles automatically once the server
 * data arrives and the component re-renders with fresh rows.
 */
export function applyOptimisticPatch<T extends { id: string }>(
  rows: T[],
  patches: Record<string, InquiryOptimisticPatch>,
): T[] {
  return rows.map((row) => {
    const patch = patches[row.id];
    return patch ? { ...row, ...patch } : row;
  });
}
