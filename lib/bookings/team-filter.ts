/**
 * Resolve the effective team-id filter for a booking read from an optional
 * client-supplied `team` param and the caller's allowed scope.
 *
 * - `requested` null/empty → use `scope` unchanged (no narrowing).
 * - owner (`scope === undefined`) → may request any team(s).
 * - staff (`scope` is an array) → request is intersected with scope (fail-closed),
 *   so a client can never widen past what they're allowed to see.
 */
export function resolveRequestedTeamIds(
  requested: string | null,
  scope: string[] | undefined
): string[] | undefined {
  const ids = (requested ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return scope;
  if (scope === undefined) return ids;
  const allowed = new Set(scope);
  return ids.filter((id) => allowed.has(id));
}
