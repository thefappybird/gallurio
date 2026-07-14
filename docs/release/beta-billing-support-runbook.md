# Beta / billing support runbook

Internal ops reference. Fields/collections below are Mongoose models under `lib/db/models/` unless noted.

## Verifying beta eligibility

1. Find the user's `User` doc by email/`workosUserId`. Check `betaParticipation.recordedAt` — non-null means they participated; `betaParticipation.source` is `"onboarding"` or `"backfill"`.
2. If `betaParticipation.recordedAt` is null, the user did not participate in beta — they are not eligible for beta-only offers (e.g. the beta2mo promo), regardless of what they claim.
3. Check `BetaProgram` (singleton doc, `findOne({})`) for `closedAt`. If set, the beta window is closed to new participants — a missing `BetaProgram` doc or null `closedAt` means the program is still open.
4. Check `User.betaPromoRedeemedAt` — set once, permanently, the first time this identity redeems the post-beta 2-month promo. Non-null means they already used their one-time redemption (identity-scoped, not workspace-scoped — catches a user who owns multiple workspaces).
5. Cross-check the workspace's own grant state (`Workspace.pendingPromoGrant`, `Workspace.planGrantExpiresAt`, `Workspace.plan`) to confirm whether the eligibility already turned into an actual grant.

## Promo code recovery

1. Look up the code in `PromoCode` by the lowercased/trimmed `code` field (matching is case-insensitive by convention, not by Mongo collation).
2. Check `PromoCode.revokedAt` — non-null means the code was emergency-revoked (abuse/compromise) and blocks all future redemptions. Check `PromoCode.expiresAt` for natural expiry.
3. To reissue a mistakenly-revoked code: clear `revokedAt` on the `PromoCode` doc (`$set: { revokedAt: null }`) — this only unblocks future redemptions, it does not retroactively fix any grant already force-cleared by `revokeWorkspacePromoGrant` (`lib/billing/promoRevocation.ts`).
4. If a workspace was wrongly force-cleared via `revokeWorkspacePromoGrant`, its `Workspace.planGrantExpiresAt` was set to the Unix epoch and `pendingPromoGrant` nulled — re-grant manually (or point the owner at a fresh code) rather than trying to "undo" the epoch stamp.
5. If the user says they never received a code, check `betaPromoRedeemedAt`/`Workspace.codesRedeemed` first — a null/empty state means no redemption happened yet on this identity/workspace, so a fresh code can be issued safely.
6. Client-facing error copy the user may have seen (for cross-reference): `promo_code_not_found`, `promo_code_expired`, `promo_code_already_redeemed`, `promo_code_revoked`, `beta_promo_already_redeemed`, `beta_program_closed` (see `messages/*.json`).

## Understanding an expired/gated workspace

`isEntitled()` (`lib/billing/access.ts`) is the source of truth — a workspace is gated when it returns false. The daily sweep (`lib/db/jobs/billing-lifecycle-sweep.ts`) stamps `Workspace.lifecycle.*` as it walks the 4 transition points from `lifecycle.lapsedAt` (T0):

1. Check `Workspace.lifecycle.lapsedAt` — null means never lapsed (or already reset by a resubscribe); a Date is T0 for the sequence below.
2. `lifecycle.warned7dAt` — pre-expiry warning sent (T-7d before an upcoming grant/period-end expiry, only for workspaces not yet lapsed).
3. `lifecycle.expiredNotifiedAt` — "access has ended" email sent, right after `lapsedAt` is stamped.
4. `lifecycle.remind1moAt` (T+30d) and `lifecycle.remind7wkAt` (T+51d) — reminder emails sent.
5. `lifecycle.wipedAt` (T+58d) — the live public page was taken offline (`publicPage.publishedAt` set to null). CRM data (bookings/clients/gallery/inquiries) is never touched by the wipe.
6. To find *why* a workspace lapsed, check `Workspace.plan`/`lsSubscriptionId`/`lsSubscriptionStatus`/`lsCurrentPeriodEnd`/`planGrantExpiresAt` — a grant-backed workspace lapses when `planGrantExpiresAt` passes; a paid workspace lapses via the LS webhook (`subscription_expired`/`subscription_cancelled` past period end) or the sweep's defensive canceled-sub path (webhook never arrived).

## Resubscription support

1. Confirm the resubscribe actually landed: `Workspace.lsSubscriptionStatus` should read `"active"` (or `"trialing"`), and `Workspace.lifecycle.*` should all be null (cleared by `lifecycleResetFields()` in `lib/billing/lifecycle.ts`, applied by the LS webhook on `subscription_payment_success`/`resumed`/`unpaused`, or by a queued-grant application).
2. Confirm access with `isEntitled()` semantics: non-null `lsSubscriptionId` with an active status, OR `planGrantExpiresAt` in the future, OR `plan === "beta"` with no grant expiry.
3. If the workspace was previously wiped (`lifecycle.wipedAt` was set before the reset), resubscribing restores dashboard/CRM access but does **not** auto-republish the public page — `publicPage.publishedAt` stays null on purpose (policy: resubscribing "allows" republishing, doesn't force it).
4. Guide the owner to the portfolio editor's Publish action to bring the public page back online themselves. Draft content (`publicPage.data`) was never touched by the wipe, so nothing needs to be recreated.
5. If the owner insists support republish on their behalf, that means directly setting `publicPage.publishedAt` to the current Date — treat this as a manual override, same care as the accidental-unpublish section below.

## Accidental-unpublish recovery

1. Confirm this is NOT a lifecycle wipe: check `Workspace.lifecycle.wipedAt` — if it is set, this is the sweep's automatic wipe, not an accidental toggle, and republishing should go through the resubscription flow above (confirm entitlement first) rather than a blind flip.
2. If `lifecycle.wipedAt` is null and `isEntitled(workspace)` is true (workspace is not gated), the unpublish was a manual mistake — safe to fix directly.
3. Set `publicPage.publishedAt` back to a current Date (`$set: { "publicPage.publishedAt": new Date() }`). Do not touch any `lifecycle.*` field — those timestamps are the sweep's own bookkeeping and are unrelated to a manual publish toggle.
4. Verify the public page renders at `/w/[orgSlug]` after the fix.
5. If the workspace is actually gated (`isEntitled()` false) but not yet wiped, do not manually republish — that would let a gated tenant serve a live public page outside the policy; direct them to resubscribe instead.
