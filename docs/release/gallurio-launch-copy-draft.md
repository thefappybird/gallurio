# Gallurio Launch Copy Draft

Status: current English launch copy collected for review and localization.
This is a handoff draft, not final legal approval. Prices must be populated
from the live Lemon Squeezy API.

## Pricing page

### Header

**Headline:** Simple plans for creative professionals and studios.

**Body:** Every new workspace gets one month of full Gallurio Pro, free, no
card required. After that, keep going with a single Pro subscription - monthly
or yearly.

### Pro plan

**Name:** Pro

**Free-access label:** Start with 1 month free, no card required.

**Description:** Everything you need to run bookings, clients, galleries, and
your public page.

**Price labels:**

- Monthly: `[LIVE API PRICE] PHP / month`
- Yearly: `[LIVE API PRICE] PHP / year - save 2 months`

**Features:**

- Portfolio page builder and public site
- Unlimited bookings and inquiries
- Client management and team roles
- Invoice PDFs
- Custom branding and advanced galleries
- Priority support

**Primary CTA:** Start my free month

### Billing notice

Payments are processed securely by Lemon Squeezy, our Merchant of Record.
Lemon Squeezy handles payment processing, tax calculation, invoices, billing
support, and eligible refund processing.

No charge is collected during your first free month.

### Pricing transparency

The price, billing period, and subscription terms are shown before you complete
any payment, and you can cancel anytime from your billing portal.

## Lifecycle email copy

These are the current English lifecycle messages. The dates are measured from
terminal expiry.

### Seven days before access ends

**Subject:** Your Gallurio Pro access ends in a week

**Heading:** A week left of full access

**Body:** Your free month of Gallurio Pro ends in 7 days. Subscribe now to keep
your portfolio online and all your bookings, clients, and gallery intact.

**CTA:** Subscribe to Pro

### At expiry

**Subject:** Your Gallurio Pro access has ended

**Heading:** Your access has ended

**Body:** Your Pro access has ended, but nothing is lost - your site and all
your data are safely saved. Subscribe to bring your portfolio back online
instantly.

**CTA:** Resubscribe

### 30 days after expiry

**Subject:** Your portfolio is still saved on Gallurio

**Heading:** We saved everything for you

**Body:** It's been a month. Your portfolio and data are still saved and ready.
Resubscribe anytime to pick up exactly where you left off.

**CTA:** Resubscribe

### 51 days after expiry

**Subject:** Last week to keep your portfolio online

**Heading:** Final reminder

**Body:** Your published site will be taken offline in one week unless you
resubscribe. Your bookings, clients, and gallery stay safe either way - but
resubscribe now to keep your site live.

**CTA:** Resubscribe

## Policy wording for review

- The initial beta program runs for two months and ends globally when Gallurio
  closes beta; beta access is not a separate two-month timer per user.
- Verified beta participants may redeem one two-month Pro promo at any time
  after eligibility is recorded.
- Beta access may be incomplete, changed, limited, suspended, or removed.
- Closing beta does not delete stored user or workspace data.
- Gallurio Pro is monthly or yearly; Starter is not part of the launch catalog.
- New workspaces receive one month of full Pro at no charge, with no card required.
- If payment is not renewed, workspace access is limited and account data is retained.
- A published public page may be taken offline after the approved retention period.
- Resubscribing restores access and allows the public page to be republished.

## Localization status

Launch locales are `en`, `fil`, `ms`, `id`, and `ar`. The pricing, terms,
refund, and application message catalogs already include Arabic routing work,
but the transactional lifecycle email catalog currently has four locales only:
`en`, `fil`, `ms`, and `id`. Arabic lifecycle email copy is still a required
release task.

Source references: `messages/en.json`, `lib/email/messages.ts`,
`lib/billing/lifecycle.ts`, and `lib/db/jobs/billing-lifecycle-sweep.ts`.
