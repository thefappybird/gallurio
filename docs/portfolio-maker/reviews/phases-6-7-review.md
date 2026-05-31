# Code Review — Portfolio Maker Phases 6 & 7

Reviewed: `git diff dev...HEAD` (commits `05e8d8d` Phase 6, `a5d1efb` Phase 7).
Reviewers: Opus correctness/conventions pass + security/multi-tenant audit.
Date: 2026-05-31.

## Summary

Two phases reviewed (inquiry API + draft-booking conversion; lead inbox + approval).
Overall: the submission transaction, the draft-filtering audit (list/calendar/
dashboard/clients/export/shifts), approval idempotency, tenant isolation, and the
four-states/a11y in the inbox were verified correct. One P0 contract gap and a set
of P1/P2 hardening items were found and fixed.

## Findings & resolutions

| # | Sev | Finding | Resolution |
|---|-----|---------|------------|
| 1 | **P0** | Draft bookings were fetchable/editable via `GET`/`PATCH /api/bookings/[id]` — the Phase 6 draft-filtering audit missed the by-id route, breaking the "drafts invisible to bookings surfaces" contract and allowing a draft to be mutated outside the approval transaction. | Added `status: { $ne: "draft" }` to both the GET and PATCH lookups. Drafts now 404 there; they remain viewable only via the lead inbox (`getInquiryWithDraft`, server-side). Added GET + PATCH draft-404 regression tests. |
| 2 | Med (sec) | Public 200 response leaked the internal `draftBookingId` (Booking-collection id enumeration / timing oracle). | Removed `draftBookingId` from the public response (now `{ ok, inquiryId }`); test updated. |
| 3 | P1 (sec) | `X-Forwarded-For` spoofing mints a fresh rate-limit bucket per request, bypassing the limiter and (via the `MAX_KEYS` clear) degrading legit users. | `getClientIp` now prefers Vercel's tamper-resistant `x-vercel-forwarded-for`, falling back to XFF for local/non-Vercel. Documented the best-effort nature + edge/WAF requirement in RELEASE-CHECKLIST §4c. |
| 4 | P1 | `Math.min(...[])` → `Infinity` → Invalid Date if `sessions` is ever empty (helper is exported, trusts input). | Added an explicit empty-sessions guard returning `submission_failed`. |
| 5 | P1 | Inquiry list used offset pagination but never clamped an over-range `?page=`, producing a confusing "showing N–N of N" empty table. | Added a server-side last-page redirect (mirrors the clients page). Kept offset pagination (matches bookings/clients precedent + simplicity); cursor migration noted as a future option. |
| 6 | P1 | `rateLimit` `resetAt` could be `NaN` for a pathological `limit: 0` config; `Retry-After` unclamped. | Guarded `resetAt` with `recent[0] ?? now`; clamped `Retry-After` to `>= 0`. |
| 7 | P2 | Double-approve race could double-credit client financials (recordBookingForClient ran even if the promotion matched 0 docs). | Capture `matchedCount`; skip recording (commit empty txn) when a concurrent approval already promoted the draft. |
| 8 | Low (sec) | Dev email fallback logged full body (client PII) to stdout — risk in prod-like preview deploys without a key. | Full body logged only when `NODE_ENV === "development"`; otherwise an envelope-only warning. Tests cover both branches. |
| 9 | P2 | `as unknown as Date` casts on `createdAt`/`updatedAt`. | Declared `createdAt`/`updatedAt` on `InquiryDoc`; removed the casts. |

## Deferred (documented, not code-fixable here)

- Edge/WAF rate limit on `/api/inquiries` — RELEASE-CHECKLIST §4c.
- `referrer` URL validation — product decision, RELEASE-CHECKLIST §4c.
- Email production env (`RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`) — RELEASE-CHECKLIST §4b.

## Verified correct (no change needed)

Submission transaction (atomic, slug-only workspace resolution, best-effort notify,
draft not credited to client metrics); draft-filtering across dashboard/clients/
bookings-list/export/shifts; approval idempotency; `getInquiryWithDraft` workspace
re-scoping; new compound indexes; inbox four-states + a11y + optimistic approve.
