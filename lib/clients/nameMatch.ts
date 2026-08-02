/**
 * Shared client-matching predicate.
 *
 * Clients are no longer identified by a unique email, so "is this the same
 * person?" is answered by name (in either ordering) plus an exact email or
 * phone hit. Defined once here and used by client creation, inquiry linking,
 * and the bookings importer so all three agree on what counts as a match.
 */

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Both orderings of a name, so "Cruz, Ana" and "Ana Cruz" share a key.
 * A comma is an explicit "Last, First" marker; without one we still emit the
 * last-token-first rotation so a plain entry matches a comma-style record.
 */
export function nameKeys(raw: string | null | undefined): string[] {
  const normalized = normalizeName(raw);
  if (!normalized) return [];

  const keys = new Set<string>([normalized]);

  const commaIndex = (raw ?? "").indexOf(",");
  if (commaIndex >= 0) {
    const last = normalizeName((raw ?? "").slice(0, commaIndex));
    const first = normalizeName((raw ?? "").slice(commaIndex + 1));
    if (last && first) keys.add(`${first} ${last}`);
  } else {
    const parts = normalized.split(" ");
    if (parts.length > 1) {
      keys.add(`${parts[parts.length - 1]} ${parts.slice(0, -1).join(" ")}`);
    }
  }

  return [...keys];
}

/** Lowercase + trim; blank becomes null so two missing values never match. */
function normalizeContact(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export type ClientMatchInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

/**
 * True when the two records plausibly describe the same person: a shared name
 * key, or an exact email or phone hit. An email/phone match alone is enough —
 * it is a stronger signal than the name.
 */
export function isClientMatch(a: ClientMatchInput, b: ClientMatchInput): boolean {
  const emailA = normalizeContact(a.email);
  if (emailA && emailA === normalizeContact(b.email)) return true;

  const phoneA = normalizeContact(a.phone);
  if (phoneA && phoneA === normalizeContact(b.phone)) return true;

  const keysB = nameKeys(b.name);
  return nameKeys(a.name).some((key) => keysB.includes(key));
}
