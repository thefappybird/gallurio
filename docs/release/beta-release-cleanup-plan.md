# Beta-release cleanup — execution plan (crash-recovery copy)

Durable copy of the approved plan for `action/beta-release-cleanup`. Source checklist: `docs/RELEASE-CHECKLIST.md`. Free-mode policy: memory `project_free_mode_lifecycle`. Consolidate/delete this at PR time per docs hygiene.

## Scope
Land every code/data gate so post-provisioning `dev → prod` is plug-and-play. Covers Delegated Engineering Work #1–#12 and #14; **excludes #13 (Paddle)** — Lemon Squeezy is the sole billing authority. Operational provisioning (Hetzner/Atlas/Cloudflare/WorkOS/Resend/LS live store/DNS/secrets/cutover) is user-owned, out of scope.

## Locked decisions
1. **Free-mode = 1-month full-Pro grant, no permanent free tier.** One per email (`User.freeTrialConsumedAt`). Pro = straight paid LS (no LS trial). Unified lapse lifecycle (expired free-month AND lapsed paid Pro): T0−7d + T0 emails → gate to `/subscribe` (add logout button, no countdown) → T0+1mo + T0+~7wk emails → T0+2mo wipe live public page (draft + CRM data persist). Proactive daily sweep, idempotent per-stage timestamps. Full detail in memory `project_free_mode_lifecycle`.
2. Paid dunning = trust LS (keep Pro through past_due/paused; lapse only on expired/refund).
3. Durable checkout = Postgres World (`@workflow/world-postgres`).
4. Cloudflare proxied + `CF-Connecting-IP`.

## Waves (each item = buildable checkpoint + own tests; orchestrator builds/commits; ≤2 concurrent agents; hard FE/BE boundary)
- **Wave 0:** #6 fail-fast env validation (`lib/env.ts`); #1 remove legacy Starter billing state (+ migration).
- **Wave 1:** #5 one-month-free entry model + gating rewrite (`lib/billing/access.ts`, entitlements, onboarding, `/subscribe` logout); #4 lapse lifecycle scheduler (status table, daily sweep job, wipe, reminder emails); #2 remove downgrade flows / dev-tooling fail-closed; #11 align copy + derive LS prices dynamically.
- **Wave 2:** #3 durable idempotent LS webhooks (event ledger, retryable 5xx, replay script); #14 Postgres Workflow World (instrumentation worker, env, CI integration); #8 observable/recoverable email.
- **Wave 3:** #7 health/readiness + graceful shutdown + CF-IP/Caddyfile fix; #9 migration/reindex/db-target guards; #10 invite-seat cron hardening + systemd timers (hourly invite-seat, daily lifecycle).
- **Wave 4:** #12 loading/error/empty-state coverage; add `pnpm test:integration` to CI.

## Verification per wave
tsc + lint + targeted vitest + `pnpm test:integration` + build green; tenant-isolation review; indexes confirmed; 5-locale parity; Playwright lifecycle (free month → gate → resubscribe re-publish), reminder/wipe timeline with clock control, inquiry rate-limit distinct IPs, #12 states at 375/768/1280; durability proof (restart mid-checkout, signed event resumes once). Consolidate docs → PR with per-item checklist.
