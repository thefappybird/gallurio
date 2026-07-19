import "server-only";
import { PromoCode, Workspace } from "@/lib/db/models";

// Emergency revocation (audited operator action) for abuse/compromise.
// Idempotent — a second call on an already-revoked code is a no-op. Blocks
// only FUTURE redemptions of the code (see the promo_code_revoked check in
// lib/actions/promoCode.ts); it does not retroactively touch grants already
// applied from earlier redemptions — see revokeWorkspacePromoGrant for that.
export async function revokePromoCode(codeId: string, revokedByUserId: string): Promise<void> {
  const at = new Date();
  await PromoCode.updateOne({ _id: codeId, revokedAt: null }, { $set: { revokedAt: at } });
  console.info("[promo-revocation] code revoked", { codeId, revokedByUserId, at });
}

// Force-clears an already-applied OR already-queued grant on one workspace.
// Setting planGrantExpiresAt to the epoch makes isEntitled() treat it as
// already-past — the same lazy-expiry mechanism checkGrantExpiry.ts already
// relies on. Does not flip `plan` directly; the existing lazy-expiry/sweep
// machinery handles the actual downgrade+lifecycle stamping on next access,
// consistent with every other expiry path.
export async function revokeWorkspacePromoGrant(
  workspaceId: string,
  revokedByUserId: string
): Promise<void> {
  const at = new Date();
  await Workspace.updateOne(
    { _id: workspaceId },
    {
      $set: {
        planGrantExpiresAt: new Date(0),
        "pendingPromoGrant.grantMonths": null,
        "pendingPromoGrant.queuedAt": null,
      },
    }
  );
  console.info("[promo-revocation] workspace grant revoked", { workspaceId, revokedByUserId, at });
}
