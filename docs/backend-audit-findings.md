# Backend Audit Findings — 2026-06-17 (updated 2026-07-12)

Snapshot audit of the Gallurio backend against the six principles the team wants
enforced on every endpoint (see `CLAUDE.md` → **Backend endpoint principles**):

1. API rate limiting
2. Extreme-case error handling that never breaks the app
3. N+1 / DB fetch efficiency
4. Auth checks on every page (not just login)
5. Auth token / secret exposure
6. MongoDB tenant isolation (the "RLS-equivalent" — Mongo has no row-level
   security, so isolation must be enforced in app code via `workspaceId`)

> **Status: audit pass complete.** The 7-item priority list from the
> "Performance audit" section below has been executed end-to-end: EH-2, EH-3,
> EH-10, DB-1, DB-2, DB-3, RL-2, and RL-3 are closed (fixed or verified
> already-fixed); DB-9 was checked with no change needed; DB-4/DB-5/DB-6/DB-8
> were each individually re-verified and closed with reasoning rather than
> left as generic "keep open" placeholders. Everything outside that list
> (EH-4/5/6/7/8/9, RL-1/RL-4, TI-1/TI-2) is unchanged from the original notes.

---

## Overall posture

- **Auth & tenant isolation: STRONG.** Spot audit found no auth-bypass or
  tenant-bleed. All authenticated pages resolve context via `requireOrg()`, all
  scoped queries filter by `workspaceId`, mutations by `_id` also filter by
  `workspaceId`, public routes resolve `orgSlug → workspaceId` before reading
  tenant data, and there are no `withAuth()` calls outside `lib/auth/session.ts`.
  Remaining items here are hardening, not holes.
- **Robustness & efficiency: GOOD, real gaps fixed this pass.** The N+1 loops,
  missing timeout, and missing error boundaries flagged below are now closed.

---

## 1. API rate limiting

| # | Finding | Location | Severity | Direction |
|---|---------|----------|----------|-----------|
| RL-1 | Rate limiter is in-memory / per-process (sliding window). On Hetzner with >1 app instance, counters are not shared and a cold start resets them. **This is a deliberate, documented deferral** (see file header) per the simplicity principle — Redis only when a real multi-instance abuse problem appears. | `lib/server/rateLimit.ts` | med | When prod runs multiple instances, swap the `Map` for a Redis sorted-set keyed the same way (`rateLimit()` signature stays identical). Until then, accept as best-effort. **Stays deferred for beta** — single VPS process. |
| RL-2 | ~~Public inquiry endpoint relies on honeypot + IP rate limit + Zod only; no CAPTCHA/Turnstile.~~ — **CLOSED 2026-07-12**: Cloudflare Turnstile already existed for the (auth) sign-in/sign-up/forgot-password forms (`lib/server/turnstile.ts` + a route-local widget) but was never wired into the public inquiry form. Extracted the widget to the shared `components/ui/turnstile-widget.tsx` (repointed all 3 auth call sites, registered in `REUSABLE_CODE.md`), and wired both halves into the inquiry flow: `app/api/inquiries/route.ts` now calls `verifyTurnstileToken` (rejects with 400 `verification_failed` before any DB work) and `ContactForm.tsx` renders the widget on the location tab, gating submit on a token and resetting it on any failed attempt — same pattern the auth forms already use. `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY` are **required** in production (verification fails closed when unset, same as auth) — added to `.env.example` and `docs/RELEASE-CHECKLIST.md` §9. | `app/api/inquiries/route.ts`, `app/(public)/w/[orgSlug]/_components/ContactForm.tsx`, `components/ui/turnstile-widget.tsx` | — | Fixed. |
| RL-3 | ~~Public gallery endpoint takes `limit` straight from the query string with no upper bound.~~ — **CLOSED 2026-07-12 (was already fixed, stale finding)**: `listPublicCollectionItemsPage` (`lib/db/queries/gallery.ts`) already clamps via `clampLimit()` to `[1, 50]` and safely decodes the cursor with a try/catch returning `null` on malformed input — no unbounded scan is possible. No code change needed. | `app/api/public/w/[orgSlug]/collections/[id]/route.ts`, `lib/db/queries/gallery.ts` | — | Verified already fixed. |
| RL-4 | No app-level rate limiting on other cheap-to-abuse endpoints (signed Cloudflare upload request, `/api/clients`, auth callback). Hetzner has no edge WAF, so app-level limiting matters. | `app/api/images/direct-upload`, `app/api/clients`, `app/api/auth/callback` | low–med | Decide which endpoints need throttling; reuse `rateLimit()`. |

## 2. Extreme-case error handling

| # | Finding | Location | Severity | Direction |
|---|---------|----------|----------|-----------|
| EH-1 | ~~Billing webhook returns 500 on any handler error~~ — **CLOSED 2026-07-12**: `app/api/webhooks/lemonsqueezy/route.ts:315-322` already acks 200 after signature verification even when a handler throws, logging the error instead of surfacing it to Lemon Squeezy's retry loop. No action needed. | `app/api/webhooks/lemonsqueezy/route.ts` | — | Fixed. Idempotency-on-event-id is still not explicit — low-priority follow-up if duplicate webhook deliveries are ever observed. |
| EH-2 | ~~Public portfolio page has no `error.tsx`.~~ — **CLOSED 2026-07-12**: added `app/(public)/error.tsx`, placed one segment above `w/[orgSlug]` so it catches failures in `w/[orgSlug]/layout.tsx` itself (a segment's own `error.tsx` does not catch its co-located layout, only pages/children below it) as well as `page.tsx`. No workspace/locale context is available at this level (the fetch that would supply it may be what failed), so it stays plain/English, mirroring the same reasoning `w/[orgSlug]/not-found.tsx` already uses. | `app/(public)/error.tsx` | — | Fixed. |
| EH-3 | ~~External image API calls (`cfFetch`) have no timeout.~~ — **CLOSED 2026-07-12**: `cfFetch` (`lib/storage/cloudflareImages.ts`) now wraps every Cloudflare request in an `AbortController` with a 15s timeout; `AbortError` is re-thrown as a descriptive timeout error instead of hanging the caller (incl. the 3× retry-with-sleep path in `verifyImageOwnership`). | `lib/storage/cloudflareImages.ts` | — | Fixed. |
| EH-4 | Lemon Squeezy SDK calls have no timeout; a slow Lemon Squeezy API blocks `/api/billing/checkout` (also hit during onboarding). | `lib/lemonsqueezy/client.ts` | med | Wrap in `Promise.race` with a timeout or configure SDK timeout; 503 on timeout. |
| EH-5 | Email send failures are swallowed by callers (`.catch()`); a Resend outage means an inquiry is saved but nobody is notified, with no retry. | `lib/email/send.ts` + inquiry callers | med | Log failed sends to a collection for manual/automated retry; surface a dashboard warning on elevated failures. |
| EH-6 | `await req.json().catch(() => ({}))` collapses malformed JSON into an empty object, indistinguishable from a missing field, logged nowhere. | `app/api/inquiries/route.ts` (~26) and other routes | med | Catch parse errors explicitly; return a distinct `malformed_json` 400 and log request metadata. |
| EH-7 | Subscription-mismatch is detected and logged but silently re-routed; a replayed/compromised webhook could rebind a workspace's subscription with no alert. | `app/api/webhooks/lemonsqueezy/route.ts` (~44–70) | med | Record to an anomalies log / alert ops rather than silently accepting. |
| EH-8 | Booking PATCH recomputes `firstSessionStart`/`lastSessionEnd` via `Math.min(...)`; a bad date parses to `NaN` and corrupts denormalized bounds. | `app/api/bookings/[id]/route.ts` (~275–281) | low | Validate all session dates before computing bounds; 400 on parse failure. |
| EH-9 | Checkout-workflow resume-hook failure is logged but returns 200; the user's checkout modal can hang waiting for a signal that never comes. | `app/api/webhooks/lemonsqueezy/route.ts` (~120–135) | low | Keep DB write authoritative; alert on orphaned workflow runs; ensure the client has a timeout/fallback. |
| EH-10 | ~~No `error.tsx`/`global-error.tsx` exists anywhere in the app.~~ — **CLOSED 2026-07-12**: added `app/[locale]/(app)/error.tsx` (branded fallback — reuses the existing `app.errors.generic` copy, a "Try again" button calling `reset()`, and a "Back to dashboard" link; one new locale key `app.errorBoundary.retry` added to all 5 locales) and a root `app/global-error.tsx` (must render its own `<html>/<body>` per Next.js convention; testable content split into an exported `GlobalErrorContent` since jsdom can't cleanly host a component that returns `<html>`). Public portfolio boundary tracked separately as EH-2. | `app/[locale]/(app)/error.tsx`, `app/global-error.tsx` | — | Fixed. |

## 3. N+1 / DB fetch efficiency

| # | Finding | Location | Severity | Direction |
|---|---------|----------|----------|-----------|
| DB-1 | ~~Gallery detach issues one `countDocuments()` per item.~~ — **CLOSED 2026-07-12**: `detachItemsFromCollection` now runs a single aggregation (`$group` by `assetId`) to get every referencing `_id` per asset (batch + external) in one round trip, then issues one `deleteMany` + one `updateMany` instead of N `countDocuments`/`deleteOne`/`updateOne` calls. Semantics preserved exactly: an asset with an external reference gets all its batch items deleted; an asset referenced only within the batch keeps exactly one item (dedup) and deletes the rest. Test asserts `countDocuments` is never called. | `lib/db/queries/gallery.ts` | — | Fixed. |
| DB-2 | ~~Gallery reorder issues one `updateOne()` per item.~~ — **CLOSED 2026-07-12**: now does one `find` (which ids actually belong to the collection) + one `bulkWrite` instead of N sequential `updateOne` calls — 2 round trips total regardless of batch size. The original "no gap" behavior (a foreign/stale id doesn't consume an order slot) is preserved exactly; an existing test already encoded this invariant and stayed green. | `app/api/portfolio/gallery/collections/[id]/items/reorder/route.ts` | — | Fixed. |
| DB-3 | ~~Dashboard top-clients fetches full `Client` docs.~~ — **CLOSED 2026-07-12**: `getTopClients` now projects `.select({ _id: 1, name: 1, totalSpent: 1 })`. Verified safe: the only consumer (`TopClientsBar`) only reads those three fields. | `app/[locale]/(app)/dashboard/_data/dashboard-metrics.ts` | — | Fixed. |
| DB-4 | ~~Booking GET fetches the whole booking without projection.~~ — **CLOSED 2026-07-12 (false positive)**: re-checked the route — the response is `NextResponse.json({ ...booking, client })`, i.e. the full lean booking document is the intended API contract (feeds a booking detail/edit view that legitimately needs sessions, customFields, notes, amount, etc.). Narrowing the projection would silently break the frontend without a coordinated contract change. No fix applied. | `app/api/bookings/[id]/route.ts` | — | Verified not applicable. |
| DB-5 | ~~Inquiry list index may not serve the range+sort without a separate stage.~~ — **CLOSED 2026-07-12 (verified correct)**: the query filters `{workspaceId, status, createdAt: range}` sorted by `createdAt`. The existing index `{workspaceId:1, status:1, createdAt:-1}` is already textbook-correct per the equality-sort-range (ESR) indexing rule (equality fields first, range/sort field last) — no separate sort stage is needed. When `status` isn't filtered, the fallback index `{workspaceId:1, createdAt:-1}` is equally correct. No `explain()` run needed given the deterministic index shape; no change applied. | `lib/db/models/Inquiry.ts`, `lib/db/queries/inquiries.ts` | — | Verified correct as-is. |
| DB-6 | Booking import opens a transaction **per row** (up to 500), serializing writes. — **Re-assessed 2026-07-12, deferred deliberately**: the original motivating risk ("route timeout") was written with a Vercel serverless execution-time limit in mind; now that hosting is moving to Hetzner's long-lived Node process behind Caddy (no imposed function timeout), that specific risk is much smaller — the remaining concern is pure round-trip latency, a nice-to-have not a beta blocker. Batching multiple rows into shared transactions while preserving the existing per-row partial-success/failure isolation (a bad row today doesn't affect others) is a real refactor of money/booking-write logic; not worth the correctness risk under this pass without dedicated test coverage. Left open, lower priority than at first assessed. | `app/api/bookings/import/route.ts` (~115–251) | low (was med) | Revisit only if the 500-row import is observed to be slow in practice on Hetzner; if so, batch in transactions of ~10 rows, keeping per-row try/catch *inside* the shared transaction so one row's failure doesn't abort the whole batch. |
| DB-7 | Dashboard activity feed scans `ActivityLog` with only a `limit(10)` and no date/entity filter; fine today (365-day TTL) but degrades as the collection grows. | `app/[locale]/(app)/dashboard/_data/dashboard-metrics.ts` (~133) | low | Add a date-range/entity filter to stabilize the query plan. |
| DB-8 | CSV export buffers all bookings + the full CSV string in memory; no streaming. — **Re-assessed 2026-07-12, deferred deliberately**: already bounded by the existing `EXPORT_ROW_LIMIT = 10_000` hard cap (rejects with 413 above it), so worst-case memory is a few MB — not a real problem on a Hetzner VPS. True streaming would be a nice-to-have at this scale, not worth the added complexity right now. | `app/api/bookings/export/route.ts` | low | Revisit only if the row cap itself needs to grow significantly. |
| DB-9 | Mongoose connection singleton (`lib/db/mongoose.ts`) sets `maxPoolSize: 10` with no `minPoolSize`/`connectTimeoutMS` tuning. — **CLOSED 2026-07-12 (verified, no change needed)**: reasonable default for a single long-lived Node process at beta concurrency; no code change made. | `lib/db/mongoose.ts` | — | Verified adequate for beta. Bump `maxPoolSize` only if connection-wait latency shows up in practice. |

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
  resolve `orgSlug → workspaceId` before reading. Re-confirmed 2026-07-12: every
  compound index across all models is `workspaceId`-first by explicit convention
  (documented in `lib/db/models/teamMembership.ts`).
- TI-1 (low): one **test** queries `GalleryItem.find({ collectionId })` without
  `workspaceId` (`.../reorder/route.test.ts` ~42). Harmless (single-workspace
  test) but a bad pattern to copy — add the `workspaceId` filter.
- TI-2 (low, schema): `Workspace.ownerUserId` has no unique index; the
  "one workspace per owner" rule is enforced only by an idempotent upsert in
  onboarding. Add a unique index if hard DB-level enforcement is wanted.

---

## Performance audit — 2026-07-12 (executed 2026-07-12)

A generic "Next.js backend performance" checklist was reviewed against
Gallurio's actual architecture (Mongoose/MongoDB Atlas, long-lived Node
process on a Hetzner VPS behind Caddy/Nginx — not Vercel serverless, not
Postgres). Most of the generic checklist doesn't apply; filtered down to what's
real, then executed end-to-end.

**Not worth auditing here — explicitly out of scope, with reason:**
- *Edge runtime for lightweight routes* — N/A. The app runs as a single Node
  process on a VPS; `runtime = "edge"` is a Vercel Edge Network concept that
  doesn't apply to this deployment target. All route handlers already use
  `runtime = "nodejs"`, correctly.
- *External connection pooler (PgBouncer) / `connection_limit=1`* — N/A. This
  is Postgres/serverless-cold-start advice; Gallurio is Mongo (Atlas manages
  its own pooling) on a long-lived process, so a single sized connection pool
  per process (`maxPoolSize: 10`, see DB-9) is the right shape, not a
  per-invocation `connection_limit=1`.
- *ISR / tag-based revalidation (`next: {revalidate}`, `revalidateTag`)* —
  not applicable to a per-tenant CRM dashboard where nearly everything is
  user/workspace-specific and already correctly marked `dynamic =
  "force-dynamic"` or invalidated via `revalidatePath` (~80+ call sites).
- *Bundle analyzer, tree-shaking, font optimization, `<Image>` adoption* —
  frontend team's lane, not a backend concern.
- *Suspense/streaming granularity* — frontend concern, not backend.
- *External Redis/Memcached cache, CDN `Cache-Control` headers* — explicitly
  and correctly deferred already (see RL-1); no CDN sits in front of Hetzner.
- *`fast-json-stringify` / custom serialization* — no dataset at Gallurio's
  scale benefits from this; native `JSON.stringify` is fine.

**Executed — final disposition of every item:**

1. ~~EH-1~~ — closed, was already fixed.
2. **EH-10** — closed. App-wide + root error boundaries added.
3. **EH-3** — closed. `cfFetch` timeout added.
4. **DB-1 / DB-2** — closed. Gallery detach/reorder batched.
5. **RL-2** — closed. Existing (auth) Turnstile infra extracted + wired into
   the public inquiry form. **RL-3** — closed, was already fixed (stale
   finding; `clampLimit`/safe cursor decode already existed).
6. **DB-3** — closed (projection added). **DB-4** — closed, verified
   not-applicable (full response is the intended contract). **DB-5** — closed,
   verified correct (index already ESR-optimal). **DB-6** — re-assessed and
   deliberately deferred (Hetzner removes the original motivating risk;
   remaining correctness-risk-vs-value tradeoff doesn't justify touching
   money/booking transaction logic this pass). **DB-8** — re-assessed and
   deliberately deferred (already bounded by the existing 10k-row cap).
7. **DB-9** — checked, no change needed (`maxPoolSize: 10` adequate for beta).

This closes the audit plan opened 2026-07-12. EH-4/5/6/7/8/9, RL-1/RL-4, and
TI-1/TI-2 remain open at their original (lower) priority — see the
remediation order below for what's left.

---

## Suggested remediation order (remaining work)

1. EH-4/EH-5/EH-6/EH-7 resilience + observability hardening (Lemon Squeezy
   SDK timeout, email-send retry/alerting, malformed-JSON logging, webhook
   anomaly alerting).
2. Lower-severity items: TI-1/TI-2, EH-8/EH-9, DB-7 activity-feed filter.
3. RL-4 — decide which cheap-to-abuse endpoints need throttling beyond the
   inquiry form.
4. DB-6 / DB-8 — only if the 500-row import or 10k-row export are observed to
   be slow in practice; see their entries above for the specific approach.
5. RL-1 distributed rate limiting — only when prod actually runs multiple
   instances (currently a deliberate deferral).
