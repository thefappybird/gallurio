# Gallurio Release Checklist

Run through this list before promoting to production. It covers the parts of the codebase that are easy to miss in a feature-review pass and the dev-mode shortcuts that must be removed or replaced with real flows.

Last updated: 2026-06-22 (provider audit: Clerk→WorkOS, Cloudinary→Cloudflare Images; added branded-email + auth-email branding section)

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
- [ ] **Real prices** in `lib/paddle/plans.ts` match the live Paddle dashboard (free 0, Starter ₱250, Pro ₱500). The `priceId` fields must reference live `pri_…` IDs, not sandbox ones. See §14 for the full Paddle pre-launch checklist.

## 3. Pending-invite seat lifecycle

These checks belong on the production deploy, not just code review. The atomicity story relies on Mongo indexes existing, so a fresh database needs the indexes built.

- [ ] **Indexes built** — connect to the production Mongo and confirm:
  - `Team` has the partial-unique index `{ workspaceId: 1 }` where `isDefault: true`.
  - `TeamMembership` has the compound unique index `{ workspaceId: 1, teamId: 1, workosUserId: 1 }`.
  - `PendingTeamAssignment` has `{ workspaceId: 1, email: 1 }` unique and `{ createdAt: 1, claimedAt: 1 }`.
  - `PendingTeamAssignment` does NOT have a TTL on `createdAt` (the cleanup cron owns deletion so seats get refunded; a TTL would skip the refund).
  - Mongoose calls `syncIndexes()` on boot via the model setup, but verify post-deploy.
- [ ] **Cron registered** — confirm `/api/cron/release-expired-invite-seats` is scheduled (`vercel.json` on Vercel, or the systemd/pm2 timer if on Hetzner) and that `CRON_SECRET` is set as a production env var. Hit the endpoint manually with the bearer token once to confirm it returns 200 with a JSON report.

## 4. Phase 2 deferrals

These are documented gaps from Phase 2 that are intentionally deferred to Phase 4:

- [ ] **Team deletion guard for bookings** — `deleteTeamAction` does not yet refuse to delete a team that has bookings tied to it because `Booking.teamId` is Phase 4. When Phase 4 lands, lift the `TODO(phase-4)` comment in `app/[locale]/(app)/teams/_actions.ts` and add a `Booking.countDocuments({ teamId, workspaceId })` guard that returns a `TEAM_HAS_BOOKINGS` error.
- [ ] **Teams table booking columns** — the standalone `/teams` table intentionally omits per-team "bookings completed" / "confirmed bookings" columns because `Booking.teamId` does not exist until Phase 4. When Phase 4 lands, add a per-team status-count aggregation and surface the two columns in `app/[locale]/(app)/teams/_components/teams-table.tsx`.

## 4b. Inquiry email notifications (Portfolio maker Phase 6)

The public inquiry form sends a best-effort notification email to the workspace owner on every submission. Transport is **Resend** over its plain HTTPS API (`lib/email/send.ts`). It never blocks or rolls back a submission — a mail failure is logged and swallowed.

- [ ] **`RESEND_API_KEY`** set in production env (Resend dashboard → API Keys). Without it, the transport logs the email to the server console and reports `skipped: true` — fine for dev, NOT acceptable for production.
- [ ] **`EMAIL_FROM`** set to a sender on a **Resend-verified domain** (e.g. `Gallurio <hello@gallurio.com>`). The dev default `onboarding@resend.dev` only delivers to the Resend account owner and must not ship to prod.
- [ ] **`EMAIL_REPLY_TO`** (optional) — global reply-to override. By default each notification's reply-to is set to the inquiring client's email so the owner can reply directly.
- [ ] **`NEXT_PUBLIC_APP_URL`** set (e.g. `https://app.gallurio.com`) so the notification's "Review & approve" button deep-links to `/inquiries/[id]`. Without it the email omits the link and tells the owner to open the lead inbox manually.
- [ ] Recipient resolution order is `Workspace.publicPage.inquiryRecipientEmail` → `Workspace.contact.email`. Confirm at least one is populated for live workspaces (set in Settings → Public page → Inquiry routing).

## 4c. Public inquiry endpoint hardening (Portfolio maker Phase 6)

`POST /api/inquiries` is public and unauthenticated. It ships with a honeypot, Zod validation, and an in-process per-IP rate limiter (`lib/server/rateLimit.ts`, 5 / 10 min). The limiter is **best-effort** — it holds only within a warm instance and keys on the client IP.

- [ ] **Trusted client IP** — `getClientIp` in `app/api/inquiries/route.ts` prefers `x-vercel-forwarded-for` (platform-set, tamper-resistant) and only falls back to the client-controllable `X-Forwarded-For`. Confirm the production proxy actually sets a trusted header; if the deployment topology differs (e.g. Hetzner behind Caddy/Nginx), update `getClientIp` to read the proxy's trusted header. Without this, an attacker rotating `X-Forwarded-For` bypasses the per-IP limiter.
- [ ] **Edge/WAF rate limit** — add a platform-level rate limit on `/api/inquiries` for real abuse protection; the in-process limiter is only a first line against accidental double-submits and casual spam. Note prod runs on Hetzner with no edge WAF, so plan a reverse-proxy (Caddy/Nginx) or app-level distributed limiter.
- [ ] **Referrer field** — `lib/validators/inquiry.ts` accepts `referrer` as a freeform string (not URL-validated) so non-URL referrers survive. It is HTML-escaped before email rendering and stored verbatim; decide whether to tighten to `z.string().url()` if analytics hygiene matters more than capturing odd referrers.

## 4d. Page-builder editor (Portfolio maker Phases 8–9)

The wizard was removed: first visit seeds the closest starter template inline (`lib/page-builder/seedPortfolio.ts`) and the editor opens directly. Starter photos are now added through the **Photos → Add new collection** dialog (`CreateCollectionDialog`), which uploads to **Cloudflare Images** (direct creator upload) before the create POST runs.

- [ ] **Orphaned Cloudflare Images assets** — photos are uploaded to Cloudflare Images *before* the create-collection POST runs. If the owner uploads then cancels the dialog (or removes a photo from the staging grid), those images are never written to a `GalleryItem` and leak in Cloudflare Images. Add a pre-prod cleanup job (sweep CF images whose `metadata.workspaceId` matches but have no corresponding `GalleryItem`), or call `deleteImage(imageId)` client-side on remove/cancel. Tracked, not blocking MVP.
- [ ] **Cloudflare Images upload constraints** — Cloudflare Images has no Cloudinary-style upload presets; format and size are enforced **app-side** (`lib/page-builder/photoSpec.ts`: JPEG/PNG/WebP/AVIF, ≤10 MB, ≥600 px shorter side). Cross-tenant isolation is by metadata, not folders: each direct upload stamps `metadata.workspaceId` and every create route calls `verifyImageOwnership(imageId, workspaceId)` (`lib/storage/cloudflareImages.ts`) to reject any `imageId` whose CF metadata workspace ≠ caller's. Before prod, confirm the Cloudflare Images plan's per-image size limit accommodates the 10 MB app cap, and that `requireSignedURLs: false` (public `imagedelivery.net` delivery) is the intended posture.
- [ ] **Template preview assets** — `lib/page-builder/templates/*` reference `/template-previews/*.svg`; the in-editor template switcher renders a CSS palette preview instead, so these files are optional. Add real preview thumbnails under `public/template-previews/` if/when the picker switches to image previews.

## 4e. Page-builder editor (Portfolio maker Phase 9)

- [ ] **`socials.website` settings-side validation** — the public ContactCardBlock now sanitizes the website href at render (rejects `javascript:`/`data:`, https-prefixes bare domains), so a stored bad value can't become a clickable XSS link. Belt-and-suspenders: also validate `website` with `z.string().url()` (or empty) in the settings action that writes `workspace.contact.socials`, mirroring the handle validation already there.
- [ ] **Block image-URL fields bypass Cloudflare Images** — `HeroBlock.backgroundImageUrl` and `CTABannerBlock.backgroundImageUrl` accept any URL (designed fallback for non-uploaded images). No script execution risk (`<img src>`), but a public visitor's browser will fetch the third-party origin (IP/UA leak). Before prod, decide whether to drop the raw-URL fallback now that Cloudflare Images upload is the standard path, or constrain to `imagedelivery.net` / Next `images.remotePatterns`.
- [ ] **Puck zone payload cap** — `savePortfolioDraftAction` rejects a single-zone Puck payload over 512 KB to keep the embedded Workspace doc well under MongoDB's 16 MB limit. Confirm the cap is comfortable for the largest real portfolios before launch.

## 4f. Page-builder editor follow-ups (Portfolio maker phases 6–9 review round)

- [x] **In-editor gallery picker strings are English** — DONE (Phase D). `CollectionsManagerDialog`, `createEditorConfig` block/field/option labels, and the draft-saved toast are now fully localized via `useTranslations("app.pageBuilder.editor.*")`. The remaining un-localized strings are Puck's own built-in chrome (drag handles, Insert drawer header, empty-slot placeholder text) — Puck 0.20.x provides no i18n API for these; they stay English-only. `CollectionPicker` and `FeaturedItemsPicker` picker labels are also still English (they are non-owner-facing overlays with no locale context available at render).
- [ ] **`/portfolio-preview` is an authenticated draft preview** — owner-only (`requireOrg` + `role === "owner"`, `notFound` otherwise), `robots: noindex`, `dynamic = "force-dynamic"`. It renders the unpublished draft. Confirm it stays out of sitemaps/indexing and is never linked publicly.
- [ ] **FeaturedItemsPicker uploads create uncollected `GalleryItem`s** (`collectionId: null`). If the owner later deletes such an item from the Gallery module, FeaturedWork Puck props referencing it are silently dropped by `getItemsByIds` (expected). Revisit if a "manage uncollected photos" surface is added.
- [ ] **Photo spec** — uploads enforce JPEG/PNG/WebP/AVIF · ≤10 MB · ≥600 px shorter side (`lib/page-builder/photoSpec.ts`). Confirm these limits suit launch (esp. the 10 MB cap vs. Cloudflare Images plan limits).

## 4g. Branded transactional emails + auth-email branding (enhance/branded-transactional-emails)

All transactional mail renders through one shared branded template (`lib/email/layout.ts` → `renderBrandedEmail`). The only email WorkOS sends today (signup verification) is taken over via a signed webhook so it matches our template; everything else (password reset, team invites, inquiries, notifications) is already sent by us via Resend. See `docs/superpowers/specs/2026-06-22-branded-transactional-emails-design.md`.

- [ ] **`WORKOS_WEBHOOK_SECRET`** set; the WorkOS webhook destination `https://[domain]/api/webhooks/workos` is registered in the WorkOS dashboard subscribed to `email_verification.created`. Confirm signature verification rejects unsigned/tampered bodies and the handler acks 200 even when the Resend send fails (no 500 into WorkOS retries).
- [ ] **Disable WorkOS default verification email** (WorkOS Dashboard → Emails → Configuration) so users don't receive both the WorkOS template and ours. Re-test signup + the in-app "resend verification" path end-to-end after disabling.
- [ ] **WorkOS Branding configured** (Dashboard → Branding): upload the Gallurio logo + set the 4 colors for light & dark, so any mail WorkOS still composes (MFA factor emails, Admin Portal) stays on-brand. This is the fallback for the emails we cannot take over.
- [ ] **Own Google OAuth credentials**: a Gallurio-branded Google Cloud OAuth client (OAuth consent screen name + logo) is configured in WorkOS → Authentication → Google OAuth, so the Google account chooser shows "Gallurio", not "WorkOS". Repeat for Microsoft/Apple if/when those providers are enabled.
- [ ] **Custom sending domain** (optional but recommended): verify `gallurio.com` (or a `mail.` subdomain) in Resend, set `EMAIL_FROM` to it, and add SPF/DKIM/DMARC. Optionally configure the matching WorkOS custom email domain for any WorkOS-composed mail.
- [ ] **Logo swap** — once a real logo asset exists, set `LOGO_URL` in `lib/email/layout.ts` (renders `<img>` instead of the interim text wordmark). One-line change; no template rework.

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

- [ ] All four active locales (`en, fil, ms, id`) have every `app.teams.*` key (the block moved out of `app.settings.teams` when Teams became a standalone page) and the `app.sidebar.teams` nav label. The dev-plan strings intentionally remain English in all locales because the panel is dev-only.
- [ ] Email copy parity: every transactional email's strings exist in all four locales (`lib/email/messages.ts`); locale is derived from workspace country.
- [ ] When a new locale is added, copy the entire `app` block first, then translate values.

## 8. Routing / proxy

- [ ] `proxy.ts` redirects members away from `/dashboard`, `/clients`, `/inquiries`, `/gallery`, `/teams`, and `/settings` (except `/settings/account` for the account/profile area). Verify manually by signing in as a member.
- [ ] AppSidebar shows `[Bookings]` only for members and hides the footer Settings link. The `/teams` link only appears for owners.

## 8a. Invitation email delivery (Resend)

The invite flow (`inviteMemberAction`) creates the `PendingTeamAssignment` / `Invitation` row and sends the invite email itself via **Resend** (`lib/email/teamInvite.ts`, localized en/fil/ms/id). There is no Clerk/WorkOS org-invitation — invitations are fully Gallurio-owned (single-use SHA-256 token hash).

- [ ] **`RESEND_API_KEY` + `EMAIL_FROM`** set (see §4b) so the invite email actually delivers. Without a key the transport logs to console and the invitee receives nothing.
- [ ] Confirm a real invite email lands in a staging inbox and the accept link resolves to the in-app accept page, then re-test the full accept → transactional `TeamMembership` + `User.memberships` write end-to-end.
- [ ] The invite email uses the shared branded template (§4g); spot-check it renders in a real client (light + dark) before launch.

## 9. Env-var matrix

Confirm these are set in the production environment:

- [ ] `DATABASE_URL` (MongoDB Atlas connection string)
- [ ] **WorkOS:** `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD` (≥32 chars), `ACTIVE_WORKSPACE_COOKIE_SECRET`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI`, `WORKOS_WEBHOOK_SECRET` (for the email-verification webhook, §4g)
- [ ] **Cloudflare Images:** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_IMAGES_API_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_HASH`, `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH`
- [ ] **Paddle:** `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_ENV=production`, `PADDLE_PRICE_STARTER_ID`, `PADDLE_PRICE_PRO_ID` (all live values — see §14)
- [ ] **Email (Resend):** `RESEND_API_KEY`, `EMAIL_FROM` (verified domain), `EMAIL_REPLY_TO` (optional)
- [ ] `CRON_SECRET`

`NODE_ENV=production` is set automatically by the platform (Vercel) or must be set explicitly in the process manager (Hetzner pm2/systemd).

## 10. Smoke after deploy

In production with live credentials (see §14 for Paddle-specific billing smoke tests):

- [ ] Sign up a new workspace — gets a Main team. The verification email arrives using our branded template (§4g), not the WorkOS default.
- [ ] Owner invites a teammate (from the `/teams` toolbar, a team's 3-dot menu, or its Details drawer) — they get a branded Resend email (§8a), accept, and land at `/bookings` with the reduced sidebar.
- [ ] Owner revokes a pending invite from the team's Details drawer — the row disappears and the team's member count shows the seat back.
- [ ] Owner deletes a non-default team from the `/teams` 3-dot menu — TeamMembership rows for that team disappear and team count drops; a member who was only on that team becomes teamless and can be re-added via another team's "Add existing member" dropdown.
- [ ] Sign in as a member and try to navigate to `/settings` — proxy redirects to `/bookings`.
- [ ] Sign in with Google — the account chooser shows "Gallurio" (requires the own-OAuth-credentials task in §4g).

## 11. Location pin picker — geocoding provider

The booking location picker (`components/ui/location-picker.tsx`) geocodes via OpenStreetMap **Nominatim** (`nominatim.openstreetmap.org`) directly from the browser. This is free and keyless, ideal for dev and low volume, but Nominatim's usage policy caps usage at ~1 req/sec and asks for an identifiable app.

- [ ] Confirm expected booking-creation volume stays well under Nominatim's fair-use limit, OR switch to a hosted/commercial geocoder (e.g. a self-hosted Nominatim, Mapbox, or Google Places) before scale.
- [ ] If staying on Nominatim, verify the production domain sends an identifiable `Referer` (browsers do this automatically) and consider proxying through a server route to attach a descriptive `User-Agent`.
- [ ] Map tiles load from `tile.openstreetmap.org` — same fair-use considerations apply; budget a tile provider if traffic grows.

## 12. Portfolio brand-kit fonts — expand the curated set (optional)

The portfolio brand kit supports **independent heading + body font selection** from the curated, self-hosted family list in `lib/page-builder/fonts.ts` (the 8 families already bundled as woff2: Merriweather, Playfair Display, Fraunces, Cormorant Garamond, DM Serif Display, Inter, Montserrat, DM Sans). Self-hosting keeps builds offline/reproducible and the public page fast (no runtime Google Fonts fetch).

- [ ] If owners want more variety, source a few more latin **variable** woff2 files (e.g. fontsource) into `app/fonts/`, register each with `localFont` in `lib/fonts/portfolio.ts` (append its var to `portfolioFontVariables`), and add an entry to `PORTFOLIO_FONTS` in `lib/page-builder/fonts.ts`. The brand-kit picker and per-text font selector pick up new families automatically. Do NOT switch to a runtime Google Fonts `<link>` — it breaks the offline/reproducible-build invariant and adds a third-party request on every public page.

## 13. Data migrations

- [ ] **Backfill removed `quoted` booking status.** The `quoted` booking status was removed (enum is now `inquiry | booked | completed | cancelled`). Any existing `Booking` document with `status: "quoted"` will now FAIL Mongoose enum validation on its next `.save()`. Before/at deploy, run a one-time backfill against production:
  ```js
  db.bookings.updateMany({ status: "quoted" }, { $set: { status: "inquiry" } })
  ```
  Target is **`inquiry`** (a `quoted` record was an unconfirmed deal — demoting it to an active lead is safer than fabricating a confirmed `booked`). Confirm the desired target before running. Dev/staging databases are cleaned by `pnpm seed`, so this only matters for any DB that holds real data.

## 14. Paddle billing (cannot test fully in dev)

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
