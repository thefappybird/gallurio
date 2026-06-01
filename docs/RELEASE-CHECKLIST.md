# Gallurio Release Checklist

Run through this list before promoting to production. It covers the parts of the codebase that are easy to miss in a feature-review pass and the dev-mode shortcuts that must be removed or replaced with real flows.

Last updated: 2026-05-28 (post teams-enhancements: standalone /teams page)

## 1. Dev-mode escape hatches

These exist to unblock local iteration. Each one is gated by `NODE_ENV !== "production"` today, but the long-term plan is to replace them with real production flows. Before shipping:

- [ ] **`lib/actions/dev.ts → devActivatePlanAction`**
  - Currently flips `Workspace.plan` directly without touching Paddle (dev-only bypass).
  - Replacement plan: drive `Workspace.plan` from the Paddle webhook only. Owner-initiated upgrades go through `/api/billing/checkout` + the Paddle.js overlay (already implemented). Owner-initiated downgrades are handled via the Paddle customer portal or a future in-app cancel/downgrade flow; the webhook then reconciles `Workspace.plan`.
  - When real subscription management lands: keep the team-cap downgrade guard logic — it already mirrors the one in `app/api/webhooks/paddle/route.ts`. The `DEV plan` settings tab should be removed (or moved behind a `?dev=1` query param).
- [ ] **`lib/actions/dev.ts → devSeedMemberAction`**
  - Bypasses the `assertCanAddTeamMember` seat reservation and the `PendingTeamAssignment` row that the real invite flow creates.
  - Replacement plan: the real owner flow is `inviteMemberAction`. Remove this action — it predates the real one.
- [ ] **`app/[locale]/(app)/settings/dev-plan/_panel.tsx`** (Dev · plan settings tab)
  - Gated by `IS_DEV` in `app/[locale]/(app)/settings/[[...catchall]]/page.tsx`. Will not render in production builds, but should be deleted alongside `devActivatePlanAction`.

Search to confirm everything dev-only is gated: `rg "NODE_ENV !== \"production\"" -t ts -t tsx`.

## 2. Paddle subscription wiring

Billing has been migrated from HitPay to Paddle. The items below supersede the old HitPay section. See `docs/paddle-integration/paddle-setup.md` for the full dashboard setup guide.

- [ ] **Owner-initiated downgrades** must be flow-tested end-to-end: create a live subscription → owner downgrades from Pro to Starter while over the Starter team cap → confirm the webhook refuses the plan change AND the user sees the downgrade-block-modal pointing at teams to delete.
- [ ] **Cancellation while over-cap** must be flow-tested: workspace on Pro with 8 teams → cancel subscription → confirm `Workspace.plan` flips to `free`, `paddleSubscriptionStatus` flips to `"canceled"`, and the next session render shows the `DowngradeBlockModal` listing the teams to delete.
- [ ] **Webhook signature** must use a real `PADDLE_WEBHOOK_SECRET` (destination secret from live Paddle Notifications). Confirm `verifyAndParsePaddleEvent` returns `null` for unsigned/tampered bodies.
- [ ] **Real prices** in `lib/paddle/plans.ts` match the live Paddle dashboard (free 0, Starter ₱250, Pro ₱500). The `priceId` fields must reference live `pri_…` IDs, not sandbox ones. See §12 above for the full Paddle pre-launch checklist.

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

- [ ] **Team deletion guard for bookings** — `deleteTeamAction` does not yet refuse to delete a team that has bookings tied to it because `Booking.teamId` is Phase 4. When Phase 4 lands, lift the `TODO(phase-4)` comment in `app/[locale]/(app)/teams/_actions.ts` and add a `Booking.countDocuments({ teamId, workspaceId })` guard that returns a `TEAM_HAS_BOOKINGS` error.
- [ ] **Teams table booking columns** — the standalone `/teams` table intentionally omits per-team "bookings completed" / "confirmed bookings" columns because `Booking.teamId` does not exist until Phase 4. When Phase 4 lands, add a per-team status-count aggregation and surface the two columns in `app/[locale]/(app)/teams/_components/teams-table.tsx`.

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

## 8b. Data export — move to background job at scale

`requestDataExportAction` currently runs synchronously inside a Server Action: queries all workspace documents, serialises to CSV, and sends via Resend in the same request. Fine for early workspaces; will timeout for large datasets.

- [ ] Move the export pipeline to a background job (Vercel Queues) before any workspace exceeds ~10k bookings.
- [ ] Confirm `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set as Vercel production env vars.
- [ ] Verify a test export email arrives with all three CSV attachments in the production environment.

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
- [ ] `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_ENV=production`, `PADDLE_PRICE_STARTER_ID`, `PADDLE_PRICE_PRO_ID` (all live values — see §12)
- [ ] `CRON_SECRET`

`NODE_ENV=production` is set automatically by Vercel.

## 10. Smoke after deploy

In production with live Paddle credentials (see §12 for Paddle-specific billing smoke tests):

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

## 12. Paddle billing (cannot test fully in dev)

The following items require live Paddle credentials and a real card. None can be verified in sandbox or dev mode.

- [ ] **Live API key set**: `PADDLE_API_KEY` starts with `pdl_live_` (not `pdl_sdbx_`).
- [ ] **Live webhook secret set**: `PADDLE_WEBHOOK_SECRET` is the destination secret from the live Notifications destination (`pdl_ntfset_…`).
- [ ] **Live client token set**: `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` starts with `live_`.
- [ ] **Environment set to production**: `NEXT_PUBLIC_PADDLE_ENV=production`.
- [ ] **Production Price IDs set**: `PADDLE_PRICE_STARTER_ID` and `PADDLE_PRICE_PRO_ID` are `pri_…` IDs from the **live** Paddle account (not the sandbox account — they are different).
- [ ] **Production webhook destination registered**: destination URL is `https://[domain]/api/webhooks/paddle` in the live Paddle account, subscribed to `subscription.*` and `transaction.completed`.
- [ ] **PHP payout bank account linked**: Settings → Payouts in the live Paddle account. Paddle remits net proceeds in PHP via SWIFT. Without a linked account, payouts accumulate and are not disbursed.
- [ ] **Paddle MoR coverage confirmed**: verify Paddle's Merchant of Record service covers the Philippines (PH — RA 12023 / 12% VAT on digital services) and UAE (5% VAT) before marketing in those markets. Paddle handles these taxes automatically as MoR.
- [ ] **Live Starter checkout**: run one real-card Starter checkout end-to-end — plan upgrades → `subscription.activated` webhook fires → workflow run completes → `/onboarding/done` shows Starter plan. Confirm via Paddle dashboard that the subscription is active and `Workspace.paddleSubscriptionStatus === "active"`.
- [ ] **Cancellation tested**: run `pnpm paddle:sim subscription-canceled <workspaceId>` (or cancel via the live dashboard) → confirm `Workspace.plan` drops to `free` and `paddleSubscriptionStatus` = `"canceled"`.
- [ ] **Per-country price overrides configured** (optional but recommended before Gulf launch): add `unit_price_overrides` for AE/SA/QA/KW/OM/BH on the live Starter and Pro prices. See `docs/paddle-integration/paddle-setup.md` Step 2 for instructions. No code change required — this is dashboard-only config.
- [ ] **Arabic/RTL locale shipped** (see `docs/paddle-integration/deferred-scope/arabic-rtl.md`) before marketing Gallurio in Arabic-primary Gulf markets. Gulf countries currently receive English chrome as an interim measure.

When everything in this file is checked, ship it.
