# Lemon Squeezy Product Copy Draft

Status: use only if Lemon Squeezy is explicitly selected as Gallurio's live
Merchant of Record. Lemon Squeezy is implemented today, but Creem and Paddle
remain unintegrated launch candidates; do not publish this provider-specific
copy before the MoR decision.

Status: working draft from the current Gallurio product and billing copy.

Use the live Lemon Squeezy API/dashboard as the authority for currency, prices,
variant IDs, and checkout terms. Do not manually create a second price source
in this file or in Gallurio.

## Product

**Name:** Gallurio Pro

**Short description:**

Everything you need to run bookings, clients, galleries, and your public page.

**Long description:**

Gallurio helps creative professionals and studios manage their bookings,
clients, galleries, and public portfolio from one workspace.

## Variants

| Variant | Billing | Price | Gallurio environment value |
| --- | --- | --- | --- |
| Gallurio Pro Monthly | Monthly subscription | Read from the live API; currency should be PHP | `LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID` |
| Gallurio Pro Yearly | Yearly subscription | Read from the live API; currency should be PHP | `LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID` |

The yearly option is currently presented as saving two months. Confirm the
exact provider-calculated amount before publishing the listing.

There is no Starter variant and no customer-facing downgrade target.

## Included features

- Portfolio page builder and public site
- Unlimited bookings and inquiries
- Client management and team roles
- Invoice PDFs
- Custom branding and advanced galleries
- Priority support

## Introductory access

Current Gallurio copy:

> Every new workspace gets one month of full Gallurio Pro, free, no card required.

The initial beta program runs for two months and ends globally when Gallurio
closes beta; it is not a separate two-month timer per user. Verified beta
participants may redeem one two-month Pro promo at any time after eligibility
is recorded. Closing beta must not delete user data.

## Billing and cancellation copy

Payments are processed securely by Lemon Squeezy, Gallurio's Merchant of
Record. Lemon Squeezy handles payment processing, tax calculation, invoices,
billing support, and eligible refund processing.

The price, billing period, and subscription terms are shown before payment.
Customers can cancel from the billing portal. Cancellation stops future renewal
charges while access continues through the paid period.

## Expiry and retained-data copy

If a subscription reaches terminal expiry or is refunded, Gallurio limits
workspace access and routes the user to the subscription page. Data is retained:

- At expiry: access ends and the user is prompted to resubscribe.
- 30 days after expiry: send the saved-data reminder.
- 51 days after expiry: warn that the published page will be taken offline in one week.
- 58 days after expiry: unpublish the public page; retain the workspace, CRM data, and drafts so the page can be republished after resubscription.

The current implementation treats `past_due`, paused, and payment-failed
events as status updates until a terminal expiry/refund event. If Lemon Squeezy
policy requires immediate gating on a failed-payment event, resolve that before
publishing this copy.

## Provider fields to complete from the dashboard

- Store name and numeric Store ID
- Store currency confirmation
- Monthly variant ID
- Yearly variant ID
- Production API key
- Production webhook signing secret
- Production webhook URL: `https://www.gallurio.com/api/webhooks/lemonsqueezy`
- Production webhook event selection
- Payout and tax details
- Production/test-mode state

Source references: `messages/en.json`, `lib/lemonsqueezy/plans.ts`,
`lib/lemonsqueezy/pricing.ts`, `lib/billing/lifecycle.ts`, and
`docs/lemonsqueezy-integration/lemonsqueezy-setup.md`.
