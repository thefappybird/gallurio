# Backend Audit Findings — 2026-06-17

Snapshot audit of the Gallurio backend against the six principles the team wants
enforced on every endpoint (see `CLAUDE.md` → **Backend endpoint principles**):

1. API rate limiting
2. Extreme-case error handling that never breaks the app
3. N+1 / DB fetch efficiency
4. Auth checks on every page (not just login)
5. Auth token / secret exposure
6. MongoDB tenant isolation (the "RLS-equivalent" — Mongo has no row-level
   security, so isolation must be enforced in app code via `workspaceId`)

> **Status: notes only.** Nothing here is fixed yet. This is the raw lapse list
> to turn into a prioritized remediation plan. Each item still needs to be
> confirmed against current code before work starts — treat severities as a
> starting hypothesis, not a verdict.

---

## Overall posture

- **Auth & tenant isolation: STRONG.** Spot audit found no auth-bypass or
  tenant-bleed. All authenticated pages resolve context via `requireOrg()`, all
  scoped queries filter by `workspaceId`, mutations by `_id` also filter by
  `workspaceId`, public routes resolve `orgSlug → workspaceId` before reading
  tenant data, and there are no `withAuth()` calls outside `lib/auth/session.ts`.
  Remaining items here are hardening, not holes.
- **Robustness & efficiency: GOOD with real gaps.** A handful of N+1 loops,
  missing projections, missing external-call timeouts, and webhook/abuse
  hardening gaps are worth scheduling.

---

## 1. API rate limiting

| # | Finding | Location | Severity | Direction |
|---|---------|----------|----------|-----------|
| RL-1 | Rate limiter is in-memory / per-process (sliding window). On Hetzner with >1 app instance, counters are not shared and a cold start resets them. **This is a deliberate, documented deferral** (see file header) per the simplicity principle — Redis only when a real multi-instance abuse problem appears. | `lib/server/rateLimit.ts` | med | When prod runs multiple instances, swap the `Map` for a Redis sorted-set keyed the same way (`rateLimit()` signature stays identical). Until then, accept as best-effort. |
| RL-2 | Public inquiry endpoint relies on honeypot + IP rate limit + Zod only; no CAPTCHA/Turnstile. A distributed bot can still create inquiry rows and trigger notification + client-confirmation emails. | `app/api/inquiries/route.ts` | med | Add Turnstile challenge to the inquiry form and verify server-side before processing. |
| RL-3 | Public gallery endpoint takes `limit` straight from the query string with no upper bound. `?limit=1000000` → large scan. | `app/api/public/w/[orgSlug]/collections/[id]/route.ts` | med | Zod-validate `limit` (1–100) and `cursor` format. |
| RL-4 | No app-level rate limiting on other cheap-to-abuse endpoints (signed Cloudflare upload request, `/api/clients`, auth callback). Hetzner has no edge WAF, so app-level limiting matters. | `app/api/images/direct-upload`, `app/api/clients`, `app/api/auth/callback` | low–med | Decide which endpoints need throttling; reuse `rateLimit()`. |

## 2. Extreme-case error handling

| # | Finding | Location | Severity | Direction |
|---|---------|----------|----------|-----------|
| EH-1 | Billing webhook returns **500 on any handler error**, so the provider retries the same event for ~24h; combined with non-idempotent handlers this risks duplicate application. Carried forward unfixed through the Paddle→Lemon Squeezy migration. | `app/api/webhooks/lemonsqueezy/route.ts` (~245–260) | high | Return 200 after the signature is verified even when a handler fails; record the failed event (dead-letter / log) and make handlers idempotent on the event `id`. |
| EH-2 | Public portfolio page has no `error.tsx`. If `findPublishedWorkspaceBySlug()` or `normalizePublicPageData()` throws (DB timeout, corrupt stored data), the whole page 500s instead of degrading. | `app/(public)/w/[orgSlug]/{page,layout}.tsx` | high | Add `error.tsx` boundary; wrap normalization so corrupt data renders `ComingSoonFallback` instead of throwing. |
| EH-3 | External image API calls (`cfFetch`) have no timeout; a slow/hung upstream can block the route handler indefinitely (incl. a 3× retry-with-sleep path). | `lib/storage/cloudflareImages.ts` | high | Add `AbortController` timeout (~10–15s); map `AbortError` → 503. |
| EH-4 | Lemon Squeezy SDK calls have no timeout; a slow Lemon Squeezy API blocks `/api/billing/checkout` (also hit during onboarding). | `lib/lemonsqueezy/client.ts` | med | Wrap in `Promise.race` with a timeout or configure SDK timeout; 503 on timeout. |
| EH-5 | Email send failures are swallowed by callers (`.catch()`); a Resend outage means an inquiry is saved but nobody is notified, with no retry. | `lib/email/send.ts` + inquiry callers | med | Log failed sends to a collection for manual/automated retry; surface a dashboard warning on elevated failures. |
| EH-6 | `await req.json().catch(() => ({}))` collapses malformed JSON into an empty object, indistinguishable from a missing field, logged nowhere. | `app/api/inquiries/route.ts` (~26) and other routes | med | Catch parse errors explicitly; return a distinct `malformed_json` 400 and log request metadata. |
| EH-7 | Subscription-mismatch is detected and logged but silently re-routed; a replayed/compromised webhook could rebind a workspace's subscription with no alert. | `app/api/webhooks/lemonsqueezy/route.ts` (~44–70) | med | Record to an anomalies log / alert ops rather than silently accepting. |
| EH-8 | Booking PATCH recomputes `firstSessionStart`/`lastSessionEnd` via `Math.min(...)`; a bad date parses to `NaN` and corrupts denormalized bounds. | `app/api/bookings/[id]/route.ts` (~275–281) | low | Validate all session dates before computing bounds; 400 on parse failure. |
| EH-9 | Checkout-workflow resume-hook failure is logged but returns 200; the user's checkout modal can hang waiting for a signal that never comes. | `app/api/webhooks/lemonsqueezy/route.ts` (~120–135) | low | Keep DB write authoritative; alert on orphaned workflow runs; ensure the client has a timeout/fallback. |

## 3. N+1 / DB fetch efficiency

| # | Finding | Location | Severity | Direction |
|---|---------|----------|----------|-----------|
| DB-1 | N+1: gallery detach issues one `countDocuments()` per item to refcount shared assets, inside a transaction. Detaching 50 items → 50 queries. | `lib/db/queries/gallery.ts` (~485–495, `detachItemsFromCollection`) | high | Aggregate refcounts once (`$group` by `assetId`), then `deleteMany`/`updateMany` from the in-memory result. |
| DB-2 | N+1: gallery reorder issues one `updateOne()` per item to set `order`. | `app/api/portfolio/gallery/collections/[id]/items/reorder/route.ts` (~38–45) | med | Batch with `bulkWrite()`. |
| DB-3 | Dashboard top-clients fetches full `Client` docs (incl. embedded `transactions[]`, up to ~200 entries) when only name/totalSpent/id are needed. | `app/[locale]/(app)/dashboard/_data/dashboard-metrics.ts` (~244, `getTopClients`) | med | Add `.select({ _id:1, name:1, totalSpent:1 })`. |
| DB-4 | Booking GET fetches the whole booking (sessions, customFields, notes) without projection though the response uses few fields. | `app/api/bookings/[id]/route.ts` (~61) | low | Project to the fields the response needs. |
| DB-5 | Inquiry list filters by status + `createdAt` range + sort; verify the existing compound index actually serves the range without a separate sort stage. | `lib/db/models/Inquiry.ts` (indexes) + `lib/db/queries/inquiries.ts` | med | Confirm with `explain()`; reorder index so `createdAt` is last if needed. |
| DB-6 | Booking import opens a transaction **per row** (up to 500), serializing writes and risking route timeout + partial-commit state. | `app/api/bookings/import/route.ts` (~115–251) | med | Batch rows per transaction (e.g. 10/tx) or offload large imports to a background job. |
| DB-7 | Dashboard activity feed scans `ActivityLog` with only a `limit(10)` and no date/entity filter; fine today (365-day TTL) but degrades as the collection grows. | `app/[locale]/(app)/dashboard/_data/dashboard-metrics.ts` (~133) | low | Add a date-range/entity filter to stabilize the query plan. |
| DB-8 | CSV export buffers all bookings (up to 10k) + the full CSV string in memory; no streaming. | `app/api/bookings/export/route.ts` | low | Stream the CSV via `Response.body`. |

## 4. Auth checks on every page

- **No lapses found.** All 25 authenticated pages under `app/[locale]/(app)/**`
  call `requireOrg()`; all API route handlers authenticate except the
  intentionally public ones (`/api/auth/callback`, HMAC-verified Lemon Squeezy webhook,
  public inquiry submission, slug-scoped public reads, email-matched invite
  accept). `proxy.ts` gates everything via an explicit public-path allowlist.
- Keep this invariant: every new authenticated page must call `requireOrg()`,
  every server action `ownerContext()`/`requireRole()`, every route handler an
  explicit identity or signature check.

## 5. Auth token / secret exposure

- **No lapses found.** No tokens/sessions/cookies are logged; no secret lives in
  a `NEXT_PUBLIC_` var (only redirect URI / app URL); no session state is
  serialized into client props; `AUTHKIT_DEBUG` logging is gated and logs only
  metadata, never tokens. `WORKOS_COOKIE_PASSWORD`, API keys, and
  `ACTIVE_WORKSPACE_COOKIE_SECRET` are accessed server-side only.
- Ops note: leave `AUTHKIT_DEBUG` unset in production.

## 6. MongoDB tenant isolation (RLS-equivalent)

- **No lapses found in production code.** Mongo has no row-level security, so
  isolation is enforced in app code and it holds: every tenant-scoped query
  includes `workspaceId`, every mutation by `_id` also filters by `workspaceId`,
  client-supplied `workspaceId` is never trusted for authz (the active-workspace
  cookie is always re-validated against DB memberships), and public routes
  resolve `orgSlug → workspaceId` before reading.
- TI-1 (low): one **test** queries `GalleryItem.find({ collectionId })` without
  `workspaceId` (`.../reorder/route.test.ts` ~42). Harmless (single-workspace
  test) but a bad pattern to copy — add the `workspaceId` filter.
- TI-2 (low, schema): `Workspace.ownerUserId` has no unique index; the
  "one workspace per owner" rule is enforced only by an idempotent upsert in
  onboarding. Add a unique index if hard DB-level enforcement is wanted.

---

## Suggested remediation order (to refine into a plan)

1. EH-3 image-API timeouts, EH-2 public portfolio `error.tsx`, EH-1 billing
   webhook 200-on-handler-error + idempotency — these prevent hard breaks /
   billing drift.
2. DB-1 gallery detach N+1, DB-3 top-clients projection, DB-6 import batching.
3. RL-2 inquiry CAPTCHA, RL-3 public-gallery `limit` bound.
4. EH-4/EH-5/EH-6/EH-7 resilience + observability hardening.
5. Lower-severity DB projections, TI-1/TI-2, EH-8/EH-9.
6. RL-1 distributed rate limiting — only when prod actually runs multiple
   instances (currently a deliberate deferral).
