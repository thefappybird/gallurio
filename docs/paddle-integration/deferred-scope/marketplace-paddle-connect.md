# Paddle Connect / Marketplace — Not Needed

## Short answer

Paddle Connect is **not needed for Gallurio's current scope.** No code, no setup, no Paddle Connect enrollment is required. This document explains why, so future sessions don't revisit it accidentally.

---

## What Paddle Connect is for

Paddle Connect (also called Paddle Marketplace) is a feature that lets a platform **split a single payment** between itself and a third-party seller/vendor, or **pay out funds** to third parties who are registered on the platform. Classic use cases:

- An app marketplace where Paddle collects from the end customer and splits the revenue between the marketplace and the app developer.
- A service platform where the platform collects from the end customer and pays out the service provider.

In other words, Connect exists when **money flows from end customer → platform → third party** within a single Paddle transaction.

---

## Why Gallurio doesn't need it

Gallurio has exactly one payment flow in scope:

**Gallurio (the company) → billing tenants (workspace owners) for their monthly SaaS subscription.**

This is a straightforward B2B subscription:
- Gallurio is the seller.
- The workspace owner is the buyer.
- Paddle is the Merchant of Record collecting on Gallurio's behalf.
- Standard Paddle Billing (products + prices + subscriptions) covers this 100%.

Tenants do **not** collect payments from their clients through Gallurio. Tenants accept payments from end clients **outside the app** — bank transfer, GCash, cash, their own payment terminal, whatever their clients prefer. Gallurio does not intermediate those transactions.

---

## What would require Connect

If a future version of Gallurio ever includes an in-app marketplace where:
- End clients pay for a booking through Gallurio's checkout, AND
- Gallurio splits that payment with the workspace owner

...then Paddle Connect would be required. That feature was explicitly dropped from MVP during the HitPay migration ("Marketplace (tenants → end-clients): Not in MVP"). The `SaaS-Blueprint.md` records this decision.

---

## Summary

| Scenario | Needs Connect? |
|---|---|
| Gallurio bills workspace owners monthly (current) | No |
| Tenant accepts cash / GCash / bank transfer from their clients | No |
| End client pays a booking fee through Gallurio's checkout | Yes — revisit if this enters scope |

Do not enroll in Paddle Connect, do not set `PADDLE_CONNECT_*` env vars, and do not add Connect-related code unless the in-app marketplace explicitly enters scope and is approved.
