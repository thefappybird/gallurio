import "server-only";
import { Workspace } from "@/lib/db/models";

// Derives the provider's own timestamp for a Lemon Squeezy subscription/
// invoice resource — attributes.updated_at, falling back to created_at.
// Returns null when neither is present/parseable so callers can treat the
// event as a degraded-fallback (always-apply) update instead of gating it.
export function resolveProviderEventTimestamp(
  attrs: Record<string, unknown>
): Date | null {
  const raw =
    typeof attrs.updated_at === "string"
      ? attrs.updated_at
      : typeof attrs.created_at === "string"
        ? attrs.created_at
        : null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Applies a Workspace $set, but only if `eventTimestamp` is at least as new
// as the workspace's last-applied provider timestamp (Workspace.lsLastEventAt).
// This is the sole ordering gate across every webhook handler: an
// out-of-order/delayed event can never overwrite state a newer event already
// wrote, while a genuinely newer event (including a newer resubscription)
// always wins. `eventTimestamp === null` (no updated_at/created_at on the
// payload) is a degraded fallback — applies unconditionally without touching
// lsLastEventAt, since there's nothing reliable to compare or record.
export async function applyOrderedWorkspaceUpdate(
  filter: Record<string, unknown>,
  set: Record<string, unknown>,
  eventTimestamp: Date | null
): Promise<void> {
  if (!eventTimestamp) {
    await Workspace.updateOne(filter, { $set: set });
    return;
  }

  // $lte, not $lt: two distinct events can legitimately share a provider
  // timestamp at second granularity (e.g. subscription_created +
  // subscription_updated fired together at checkout). Exact-duplicate
  // redeliveries never reach here — the {provider,eventKey} claim in
  // app/api/webhooks/lemonsqueezy/route.ts already suppresses those upstream
  // — so accepting an equal timestamp is safe and required for the
  // second-processed same-timestamp event to still apply.
  await Workspace.updateOne(
    {
      ...filter,
      $or: [{ lsLastEventAt: null }, { lsLastEventAt: { $lte: eventTimestamp } }],
    },
    { $set: { ...set, lsLastEventAt: eventTimestamp } }
  );
}
