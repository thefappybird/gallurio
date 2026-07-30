/**
 * Field-by-field reconciliation between an existing client and the values a
 * user just typed. Shared by client creation (name-collision) and inquiry
 * linking so both resolve differences the same way.
 *
 * Four cases, only one of which is a question:
 *   existing blank  + typed filled          -> additive, filled in silently
 *   existing filled + typed blank           -> keep existing, not surfaced
 *   equal                                   -> no-op, not surfaced
 *   existing filled + typed filled, differ  -> conflict, the user picks
 */

/**
 * `tags` is deliberately excluded: it is a set, so combining is always additive
 * and can never conflict. `source` is provenance and is never reconciled.
 */
export const RECONCILED_FIELDS = ["email", "phone", "notes"] as const;

export type ReconciledField = (typeof RECONCILED_FIELDS)[number];

export type ReconcilableClient = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  tags?: string[] | null;
};

export type AdditiveChange = { field: ReconciledField; value: string };
export type FieldConflict = {
  field: ReconciledField;
  existingValue: string;
  typedValue: string;
};

export type ReconcileResult = {
  /** Filled in automatically — shown as "will be added", never prompted. */
  additive: AdditiveChange[];
  /** Genuine disagreements the user must resolve. */
  conflicts: FieldConflict[];
  /** Union of both tag sets, or null when neither side contributes anything. */
  tags: string[] | null;
};

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function reconcileClient(
  existing: ReconcilableClient,
  typed: ReconcilableClient
): ReconcileResult {
  const additive: AdditiveChange[] = [];
  const conflicts: FieldConflict[] = [];

  for (const field of RECONCILED_FIELDS) {
    const existingValue = clean(existing[field]);
    const typedValue = clean(typed[field]);

    if (!typedValue) continue; // nothing typed -> keep existing, never surfaced
    if (existingValue === typedValue) continue; // no-op
    if (!existingValue) {
      additive.push({ field, value: typedValue });
      continue;
    }
    conflicts.push({ field, existingValue, typedValue });
  }

  const merged = [...(existing.tags ?? []), ...(typed.tags ?? [])];
  const tags = merged.length > 0 ? [...new Set(merged)] : null;

  return { additive, conflicts, tags };
}
