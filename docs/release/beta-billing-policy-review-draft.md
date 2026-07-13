# Gallurio Beta and Billing Policy Review Draft

Status: review draft. This document records the product decision and is not
legal approval.

## Beta program

Gallurio will run the beta program for two months as an initial launch period.
Beta access is program-wide: it does not create a separate two-month timer for
each user. When Gallurio closes the beta program, all active beta access ends
at the same time.

Closing beta must not delete, wipe, or invalidate a user's account, workspace,
portfolio, bookings, clients, gallery, team, or other stored data.

## Beta participant benefit

Each verified beta participant may receive one Gallurio Pro promo code. The
promo grants two months of Pro access starting when the participant redeems it.
The participant may redeem it at any time after their beta participation has
been recorded. The code has no ordinary expiry date; emergency revocation for
abuse or compromise must be an explicit, audited operator action.

The code is one-time per eligible user identity. Gallurio must verify historical
beta participation before accepting the redemption; possession of the code by
itself is not sufficient proof of eligibility.

The implementation must define and document whether redemption during an active
paid subscription is rejected, queued, or added after the paid period. It must
not silently shorten paid access or extend the promo repeatedly.

## Paid Pro

Gallurio Pro has monthly and yearly variants only. There is no Starter product
and no customer-selected downgrade target. Pricing and currency come from the
live Lemon Squeezy product/variant data.

## Failed payment and expiry

Gallurio follows Lemon Squeezy's payment decision. A transient payment-failed,
past-due, or paused notification does not by itself expire the workspace.
Gallurio expires access only after Lemon Squeezy reports a terminal
non-payment/expiry decision or another provider-authoritative terminal event.

After terminal expiry, the workspace is routed to subscription recovery. The
data remains stored. The current lifecycle is:

- T0: access is gated and the expiry message is sent.
- T+30 days: send the saved-data reminder.
- T+51 days: warn that the published page will be taken offline in one week.
- T+58 days: unpublish the public page while retaining the workspace, CRM data,
  and drafts.

Resubscribing restores access and allows the owner to republish the page.

## Review questions

- What is the exact beta start/end date, and who may close beta operationally?
- What database evidence proves beta participation after beta is closed?
- Is the no-expiry redemption rule and emergency revocation process acceptable?
- What happens when an eligible participant already has active paid Pro?
- Which exact Lemon Squeezy event/status is the terminal non-payment decision?
- Which legal jurisdiction, contact address, and support/refund SLA should be
  published?
