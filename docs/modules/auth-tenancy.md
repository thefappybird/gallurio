# Module: Auth & Tenancy

## Identity (WorkOS AuthKit)

WorkOS is identity-only: sign-in/up, password auth, Google OAuth, MFA (TOTP), email verification. **WorkOS Organizations are never used** — all workspace/membership/role/team state is MongoDB-owned.

- `getAuthUser()` (`lib/auth/session.ts`) is the single authoritative identity reader. It wraps `withAuth()` — never call `withAuth()` anywhere else.
- `ensureUser()` JIT-provisions a `User` doc (upsert on `workosUserId`) at every authenticated entry point.
- `proxy.ts` (this repo's `middleware.ts` equivalent) runs `authkitMiddleware` with an explicit public-path allowlist, then next-intl. It merges both libraries' response headers (union `x-middleware-override-headers`) so next-intl's locale header survives a hard reload.
- OAuth callback `/api/auth/callback` verifies signed state + a CSRF nonce. `signOutAction()` clears the active-workspace cookie then calls WorkOS `signOut()`. User-facing copy never names the auth provider.
- Env setup: `WORKOS_API_KEY` (secret key, server-only), `WORKOS_CLIENT_ID`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI` (register in WorkOS Dashboard → Redirects; local `http://localhost:3000/api/auth/callback`, prod adds the HTTPS equivalent as a second redirect), `WORKOS_COOKIE_PASSWORD` (≥32 chars, `openssl rand -base64 32`, encrypts the `wos-session` cookie), `ACTIVE_WORKSPACE_COOKIE_SECRET` (separate secret, signs `gw_active_ws`). Google OAuth uses WorkOS's shared dev credentials locally; production needs a real Google Cloud OAuth client. Webhooks stay disabled (JIT provisioning is primary).
- Cloudflare Turnstile (bot challenge on public/abusable endpoints): `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public) + `TURNSTILE_SECRET_KEY` (server-only) from the Cloudflare dashboard. Always-pass dev test keys: site `1x00000000000000000000AA`, secret `1x0000000000000000000AA`.

## Tenancy model

- A `Workspace` is the tenant boundary — never trust a client-supplied `workspaceId`; resolve it from session + the re-validated active-workspace cookie + MongoDB memberships.
- `User.memberships[]`: `{ workspaceId, role: "owner"|"staff", lastAccessedAt }`. A user owns at most one workspace; onboarding upserts on `ownerUserId`.
- Team-level membership is the separate `TeamMembership` collection: `{ workspaceId, teamId, workosUserId, role: "member"|"lead" }`, unique on `(workspaceId, teamId, workosUserId)`.
- `Team`: workspace-scoped department/group — `name` (unique per workspace), `color`, `isDefault` (unique partial index, exactly one default team per workspace), `isActive`/`deactivatedAt`, `memberCount`, `pendingReleaseAcks[]` (ref `Invitation`, for seat-release flows).
- `Invitation`: email-bound, single-use SHA-256 token hash, `role`, `teamIds[]`/`leadOnTeamIds[]`, `status: pending|accepted|revoked|expired`, unique partial index on `(workspaceId, email)` while `status="pending"`. Acceptance is a transactional multi-doc write. Expired invite seats are released by the hourly `release-expired-invite-seats` cron.
- Active workspace = signed HMAC cookie `gw_active_ws` (`lib/auth/activeWorkspace.ts`) — **always re-validated against DB memberships**, never authorization on its own. Resolution order: valid cookie → most-recent `lastAccessedAt` membership → sole membership → null (routes to onboarding).
- **Subdomain cookie posture**: session cookies (`gw_active_ws` and WorkOS `wos-session`) are **host-only** (no `domain` attribute) so tenant `{slug}.gallurio.com` subdomains never receive them — a domain-scoped cookie would leak an authenticated session to a public page. Never set `WORKOS_COOKIE_DOMAIN` to `.gallurio.com`. Reserved subdomain labels (`www,auth,api,admin,…`, `lib/portfolio/reservedSlugs.ts`) can't be claimed as workspace slugs. See `docs/modules/hosting-ops.md`.
- Request-context helpers: `requireOrg()` for pages (redirects on failure), `ownerContext()` for server actions (returns `{ error }`), `requireRole("owner")` to hard-gate owner-only work. Both derive "is owner" as `workspace.ownerUserId === workosUserId` OR `membership.role === "owner"`. Route handlers do their own explicit identity/signature check — middleware/proxy is never sufficient authorization by itself.

## Enforcement checklist

Every tenant-scoped query includes `workspaceId`; every mutation by `_id` also filters by `workspaceId`. Every new compound index starts with `workspaceId`. Public routes resolve `orgSlug -> workspaceId` before any tenant read. Mongo has no row-level security — this code path is the only enforcement layer. See `docs/modules/hosting-ops.md` for the full endpoint-hardening checklist these rules feed into.
