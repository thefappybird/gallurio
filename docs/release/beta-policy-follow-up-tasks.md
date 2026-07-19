# Beta and Billing Follow-up Tasks for Delegation

Scope: implement the approved Gallurio beta and payment-provider policy.
Keep the existing decisions: Lemon Squeezy is the current implementation,
while Lemon Squeezy, Creem, and Paddle are launch candidates; Gallurio Pro has
monthly/yearly variants only, public portfolios use `/w/<slug>` during beta,
and no user data is deleted when access ends.

## Product and data model

1. Define the beta program record and close operation.
   - Record the two-month beta start/end window and the operator-authorized
     close action.
   - Ensure beta access ends globally when beta closes; do not calculate a
     separate beta expiry date per user.
   - Stop new beta activation after close.
   - Preserve all account, workspace, portfolio, CRM, booking, gallery, and
     team data.

2. Persist historical beta participation before beta closes.
   - Use a durable identity-level record tied to the authoritative user
     identity, not only the current `Workspace.plan` value.
   - Record when/how eligibility was established and make the write
     idempotent.
   - Ensure staff/support can verify eligibility without exposing unrelated
     tenant data.

3. Add the beta participant two-month Pro promo.
   - Use a dedicated promo type or equivalent; do not reuse the perpetual
     `beta` grant semantics.
   - Grant Pro for exactly two calendar months from successful redemption.
   - Permit one redemption per eligible user identity, with atomic concurrent
     redemption protection.
   - Decide and test whether redemption while paid Pro is active is rejected,
     queued, or starts after the paid period; never silently shorten paid time
     or repeatedly extend the grant.
   - Implement no ordinary expiry on the promo code: eligible participants may
     redeem at any time after beta participation is recorded. Add an explicit,
     audited emergency revocation path for abuse or compromise.

4. Update product surfaces.
   - Keep promo entry available after beta closure where the policy permits.
   - Show clear success, invalid, ineligible, already-redeemed, expired, and
     error states.
   - Update subscription/access messaging so beta closure and the two-month
     promo are not described as perpetual beta access.

## Current Lemon Squeezy payment policy

5. Identify the provider-authoritative terminal payment signal.
   - Verify the exact Lemon Squeezy event/status payload for exhausted retries,
     unpaid/terminal subscriptions, expiry, and refunds in test mode.
   - Keep `subscription_payment_failed`, `past_due`, and `paused` as non-final
     unless Lemon Squeezy explicitly marks the subscription terminal. Re-derive
     this provider mapping if Creem or Paddle is selected.
   - Expire the workspace only from the approved terminal provider signal.

6. Implement and test terminal mapping.
   - Update the webhook handler, status mapping, access checks, lifecycle
     anchor, and replay behavior as needed.
   - Prevent a trailing non-terminal `subscription_updated` event from
     re-promoting a terminally expired workspace.
   - Preserve tenant-safe subscription/workspace resolution and raw-body HMAC
     verification.
   - Cover duplicate, out-of-order, replayed, and concurrent webhook delivery.

## Lifecycle and retained data

7. Verify the full lapse sequence against the approved policy.
   - T0 gate and notify.
   - T+30 days saved-data reminder.
   - T+51 days final public-page warning.
   - T+58 days unpublish only the public page; retain workspace, CRM, and draft
     data.
   - Resubscription clears the lapse state and permits republishing.

8. Complete recovery UX and operations.
   - Add the remaining in-app recovery/support/export messaging.
   - Add localized lifecycle email coverage, including Arabic.
   - Add delivery failure, retry, bounce, and complaint monitoring.
   - Document support steps for beta eligibility, promo recovery, expiry,
     resubscription, and accidental unpublish.

## Production data and deployment

9. Create a controlled production promo seeding path.
   - Do not commit the real promo code to source control.
   - Use an idempotent, audited production migration/admin operation with a
     unique code and the approved two-month type.
   - Require an explicit production target confirmation and redact the code
     from logs and operational output.
   - Record the code owner, distribution channel, redemption policy, and
     emergency revocation procedure in the secret/runbook system.

10. Update migrations, indexes, and release evidence.
    - Add any model/index migration required for beta participation and promo
      redemption.
    - Run the migration against a restored clone first, then produce a
      redacted production evidence report.
    - Record the beta close operation, promo seed, final release SHA, and
      rollback procedure.

## Tests and acceptance

11. Add tests for:
    - beta participation capture and historical eligibility;
    - global beta close and idempotent rerun;
    - one-time and concurrent promo redemption;
    - exactly two months of grant access and expiry;
    - active-Pro stacking behavior;
    - ineligible, already-redeemed, invalid, and revoked codes;
    - terminal Lemon Squeezy payment expiry versus transient failure;
    - webhook ordering, replay, tenant isolation, and no data deletion;
    - all five locales, Arabic RTL, loading/error/empty states, and 375 px.

12. Before marking complete, run affected tests, typecheck, lint, and build;
    retain the production-like webhook and migration evidence in the release
    record.
