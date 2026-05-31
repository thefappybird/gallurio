# Gallurio Release Checklist

Run through this list before promoting to production. It covers the parts of the codebase that are easy to miss in a feature-review pass and the dev-mode shortcuts that must be removed or replaced with real flows.

Last updated: 2026-05-28 (post teams-enhancements: standalone /teams page)

## 1. Dev-mode escape hatches

These exist to unblock local iteration. Each one is gated by `NODE_ENV !== "production"` today, but the long-term plan is to replace them with real production flows. Before shipping:

- [ ] **`lib/actions/dev.ts → devActivatePlanAction`**
  - Currently flips `Workspace.plan` directly without touching HitPay.
  - Replacement plan: drive `Workspace.plan` from the HitPay webhook only. Owner-initiated upgrades go through `/api/billing/checkout` (already implemented). Owner-initiated downgrades go through a HitPay portal session that the webhook then reconciles back into our `Workspace.plan` field.
  - When real subscription management lands: keep the team-cap downgrade guard logic — it already mirrors the one in `app/api/webhooks/hitpay/route.ts`. The `DEV plan` settings tab should be removed (or moved behind a `?dev=1` query param).
- [ ] **`lib/actions/dev.ts → devSeedMemberAction`**
  - Bypasses the `assertCanAddTeamMember` seat reservation and the `PendingTeamAssignment` row that the real invite flow creates.
  - Replacement plan: the real owner flow is `inviteMemberAction`. Remove this action — it predates the real one.
- [ ] **`app/[locale]/(app)/settings/dev-plan/_panel.tsx`** (Dev · plan settings tab)
  - Gated by `IS_DEV` in `app/[locale]/(app)/settings/[[...catchall]]/page.tsx`. Will not render in production builds, but should be deleted alongside `devActivatePlanAction`.

Search to confirm everything dev-only is gated: `rg "NODE_ENV !== \"production\"" -t ts -t tsx`.

## 2. HitPay subscription wiring

The Phase 3 branch added one piece of real billing behavior (cancellation always drops to free; see `app/api/webhooks/hitpay/route.ts:127-160`) and one dev shim. Before ship:

- [ ] **Owner-initiated downgrades** must be flow-tested end-to-end through HitPay sandbox: create subscription → owner downgrades from Pro to Starter while over the Starter team cap → confirm the webhook refuses the plan change AND the user sees the downgrade-block-modal pointing at teams to delete.
- [ ] **Cancellation while over-cap** must be flow-tested: workspace on Pro with 8 teams → cancel subscription → confirm `Workspace.plan` flips to `free`, `hitpayRecurringStatus` flips to `cancelled`, and the next session render shows the `DowngradeBlockModal` listing the teams to delete.
- [ ] **Webhook signature** must use a real `HITPAY_WEBHOOK_SALT` in production env vars. Confirm `verifyHitpayCallback` returns false for unsigned bodies.
- [ ] **Real prices** in `lib/hitpay/plans.ts` match the HitPay dashboard side (free 0, starter 499 PHP, pro 1199 PHP). Currency code is `PHP`.

## 3. Pending-invite seat lifecycle

These checks belong on the production deploy, not just code review. The atomicity story relies on Mongo indexes existing, so a fresh database needs the indexes built.

- [ ] **Indexes built** — connect to the production Mongo and confirm:
  - `Team` has the partial-unique index `{ workspaceId: 1 }` where `isDefault: true`.
  - `TeamMembership` has the compound unique index `{ workspaceId: 1, teamId: 1, clerkUserId: 1 }`.
  - `PendingTeamAssignment` has `{ workspaceId: 1, email: 1 }` unique and `{ createdAt: 1, claimedAt: 1 }`.
  - `PendingTeamAssignment` does NOT have a TTL on `createdAt` (the cleanup cron owns deletion so seats get refunded; a TTL would skip the refund).
  - Mongoose calls `syncIndexes()` on boot via the model setup, but verify post-deploy.
- [ ] **Vercel cron** — confirm `/api/cron/release-expired-invite-seats` is registered (`vercel.json`) and that `CRON_SECRET` is set as a production env var. Hit the endpoint manually with the bearer token once to confirm it returns 200 with a JSON report.
- [ ] **Clerk webhook secret** — `CLERK_WEBHOOK_SECRET` is set in production env. The webhook must verify svix signatures or it returns 400.

## 4. Phase 2 deferrals

These are documented gaps from Phase 2 that are intentionally deferred to Phase 4:

- [x] **Team deletion guard for bookings** — RESOLVED in Phase 4 by switching to **soft-delete**: `deleteTeamAction` was removed in favor of `deactivateTeamAction`/`reactivateTeamAction`. Teams are never hard-deleted once bookings reference them, so no `TEAM_HAS_BOOKINGS` guard is needed — deactivation always succeeds and preserves history.
- [ ] **Teams table booking columns** — the standalone `/teams` table omits per-team "bookings completed" / "confirmed bookings" columns. `Booking.teamId` now exists (Phase 4), so this is unblocked: add a per-team status-count aggregation (backed by the `{ workspaceId, teamId, status, firstSessionStart }` index) and surface the columns in `app/[locale]/(app)/teams/_components/teams-table.tsx`. Deferred to a later Teams polish pass.

## 5. Multi-tenant isolation spot-checks

Confirm before shipping that no recently-added query/mutation forgets the `workspaceId` filter. Common landmines:

- [ ] Every `Team.find*` / `Team.update*` / `Team.delete*` includes `workspaceId` in the filter — exceptions need to be system jobs (cron, webhook drain) and must be commented as such.
- [ ] Every `TeamMembership.find*` / `*delete*` includes `workspaceId`.
- [ ] Every `PendingTeamAssignment.find*` includes `workspaceId` except the cron sweep (intentional: scans all workspaces).
- [ ] Every `Booking.find*` / `*delete*` etc. still includes `workspaceId` (no regression from teams work).

Run: `rg "Team(Membership|)\.(find|update|delete)" app lib --type ts` and audit the matches.

## 6. Test, lint, build gates

- [ ] `pnpm typecheck` — clean.
- [ ] `pnpm lint` — 0 errors (existing React Compiler warnings on bookings/branding files are OK).
- [ ] `pnpm test` — 100% pass.
- [ ] `pnpm build` — successful Next.js build. The dev-plan settings page should NOT appear in the route list (gated out by `IS_DEV`).

## 7. Locale parity

- [ ] All five locales (`en, fil, ms, id, th`) have every `app.teams.*` key (the block moved out of `app.settings.teams` when Teams became a standalone page) and the `app.sidebar.teams` nav label. The dev-plan strings intentionally remain English in all locales because the panel is dev-only.
- [ ] When a new locale is added, copy the entire `app` block first, then translate values.

## 8. Routing / proxy

- [ ] `proxy.ts` redirects members away from `/dashboard`, `/clients`, `/inquiries`, `/gallery`, `/teams`, and `/settings` (except `/settings/account` for the Clerk profile area). Verify manually by signing in as a member.
- [ ] AppSidebar shows `[Bookings]` only for members and hides the footer Settings link. The `/teams` link only appears for owners.

## 8a. Invitation email delivery (NO email service wired yet)

The invite flow (`inviteMemberAction`) creates the `PendingTeamAssignment` row and calls Clerk's `createOrganizationInvitation`, but **no invitation email is delivered in the current dev setup** — Clerk's org-invitation email is not configured. The owner sees the pending invite in the team's Details drawer, but the invitee receives nothing. Before production:

- [ ] **Enable Clerk organization-invitation emails** in the Clerk dashboard (Organizations → invitations), OR wire a transactional email provider and send the invite link yourself. Confirm a real email lands in the invitee's inbox in a staging environment.
- [ ] Consider passing a `redirectUrl` to `createOrganizationInvitation` so accepted invites land directly in the in-app accept flow rather than Clerk's default page.
- [ ] Re-test the full accept → webhook drain → `TeamMembership` creation path once emails actually send.

## 9. Env-var matrix

Confirm these are set in the production Vercel project:

- [ ] `DATABASE_URL`
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`
- [ ] `CLERK_WEBHOOK_SECRET`
- [ ] `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- [ ] `HITPAY_API_KEY`, `HITPAY_WEBHOOK_SALT`, `HITPAY_API_BASE` (production base, not sandbox)
- [ ] `CRON_SECRET`

`NODE_ENV=production` is set automatically by Vercel.

## 10. Smoke after deploy

In production with a real HitPay account on test mode (or sandbox-redirected to the prod app):

- [ ] Sign up a new workspace — gets a Main team.
- [ ] Owner invites a teammate (from the `/teams` toolbar, a team's 3-dot menu, or its Details drawer) — they get an email (requires §8a), accept, and land at `/bookings` with the reduced sidebar.
- [ ] Owner revokes a pending invite from the team's Details drawer — the row disappears and the team's member count shows the seat back.
- [ ] Owner deletes a non-default team from the `/teams` 3-dot menu — TeamMembership rows for that team disappear and team count drops; a member who was only on that team becomes teamless and can be re-added via another team's "Add existing member" dropdown.
- [ ] Sign in as a member and try to navigate to `/settings` — proxy redirects to `/bookings`.

## 11. Location pin picker — geocoding provider

The booking location picker (`components/ui/location-picker.tsx`) geocodes via OpenStreetMap **Nominatim** (`nominatim.openstreetmap.org`) directly from the browser. This is free and keyless, ideal for dev and low volume, but Nominatim's usage policy caps usage at ~1 req/sec and asks for an identifiable app.

- [ ] Confirm expected booking-creation volume stays well under Nominatim's fair-use limit, OR switch to a hosted/commercial geocoder (e.g. a self-hosted Nominatim, Mapbox, or Google Places) before scale.
- [ ] If staying on Nominatim, verify the production domain sends an identifiable `Referer` (browsers do this automatically) and consider proxying through a server route to attach a descriptive `User-Agent`.
- [ ] Map tiles load from `tile.openstreetmap.org` — same fair-use considerations apply; budget a tile provider if traffic grows.

When everything in this file is checked, ship it.
