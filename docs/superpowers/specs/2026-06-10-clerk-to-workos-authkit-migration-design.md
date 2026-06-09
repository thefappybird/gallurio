# Clerk → WorkOS AuthKit Migration — Design Spec

**Date:** 2026-06-10
**Branch context:** `feat/portfolio-enhancements` (migration will get its own branch off `dev`)
**Status:** Approved design — ready for implementation planning

---

## 1. Summary

Replace Clerk entirely. WorkOS AuthKit becomes a **pure user-level identity provider**
(authentication only: email+password, Google social login, Magic Auth/OTP capability, MFA/TOTP).
**MongoDB becomes the single source of truth** for organizations (Workspaces), teams,
memberships, roles, and invites — none of which touch WorkOS.

We build **our own Gallurio-branded auth UI** (sign-in, sign-up, password reset, MFA enrol /
challenge, Google button) on top of the free WorkOS User Management API, and keep
`@workos-inc/authkit-nextjs` only for sealed-session cookie management and middleware.

This is a **pre-launch, big-bang cutover**. No production users exist, so we drop Clerk-linked
records and re-key the schema cleanly — no data migration.

---

## 2. Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Existing data | **Pre-launch / disposable.** Drop Clerk-keyed records; re-key schema. No migration. |
| 2 | WorkOS Organizations | **None.** User-level auth only. (Lazy per-tenant org mirror is a *future* item, introduced only if a tenant buys enterprise SAML/OIDC SSO.) |
| 3 | Roles / RBAC | **MongoDB owns all roles & permissions** (`owner`/`staff`, team `lead`/`member`, seat caps). WorkOS never sees roles. |
| 4 | Auth methods at cutover | **Email+password, Google social login, MFA/TOTP.** (Magic Auth/OTP wired but can stay dormant; enterprise SSO out of scope.) |
| 5 | Auth UI | **First-party custom forms** calling the WorkOS User Management API. No hosted redirect, no embedded widgets. |
| 6 | MFA | **User-optional setting**, suggested at registration. **Not enforced** at cutover. Owner-enforced MFA is a future item. |

### 2.1 Pricing rationale (why this is correct and cheap)

- AuthKit is free to **1M MAU**, including email+password, **social login (Google)**,
  Magic Auth, **MFA/TOTP**, and RBAC. ([workos.com/pricing](https://workos.com/pricing))
- **Organizations are not metered** — no "100 org" cap exists. The only paid items are
  **enterprise SSO (SAML/OIDC) and Directory Sync (SCIM) *connections*** at $125/connection/mo.
- **"Google login" is social login, not enterprise SSO** — it needs no WorkOS Organization.
  Since we ship no SAML/OIDC SSO, we provision zero WorkOS Organizations and stay fully on the
  free tier regardless of tenant count.

---

## 3. Non-goals

- Migrating existing users (none exist).
- WorkOS Organizations, Directory Sync (SCIM), or enterprise SAML/OIDC SSO.
- WorkOS Roles / FGA (roles live in Mongo).
- Owner-enforced MFA, magic-link-only login as default, passkeys (all future-optional).
- Any change to public portfolio routing (`/w/[orgSlug]`), billing logic, or tenant-isolation rules
  beyond re-keying user/owner identifiers.

---

## 4. Architecture overview

```
Browser (our branded forms)
   │  POST credentials / TOTP / OAuth code
   ▼
Next.js server action / route handler
   │  WorkOS User Management API (@workos-inc/node)
   │    authenticateWithPassword / createUser / authenticateWithCode /
   │    authenticateWithTotp / enrollAuthFactor / sendPasswordResetEmail ...
   │  → returns { user, sealedSession }
   ▼
Set `wos-session` httpOnly cookie (sealed, cookiePassword)
   │
   ▼
authkitMiddleware (proxy.ts) + withAuth()  ← read/verify/refresh session
   │  { workosUserId, email }
   ▼
JIT-provision User (Mongo) ── activeWorkspaceId cookie (signed, validated vs memberships)
   ▼
requireOrg() / ownerContext() → { user, workspace, role }  ← all tenant data from Mongo
```

**Identity boundary:** WorkOS answers only "who is this authenticated user (id + email), and has
their session/MFA been verified?" Everything else — which workspaces they belong to, their role,
their teams, their invites — is resolved from MongoDB and never trusts client input.

---

## 5. Identity model & schema changes

Pre-launch, so we **drop all existing User / Workspace / Team / TeamMembership /
PendingTeamAssignment documents** and re-key. No back-compat shims.

### 5.1 Field re-key

| Model / file | Today (Clerk) | After (WorkOS) | Notes |
|---|---|---|---|
| `User` (`lib/db/models/User.ts`) | `clerkUserId` (unique, indexed) | `workosUserId` (unique, indexed) | Canonical identity record. JIT-provisioned. |
| `Workspace` (`lib/db/models/Workspace.ts`) | `clerkOrgId` (required, unique, indexed) | **removed** | No org concept in WorkOS. |
| `Workspace` | `ownerUserId` (Clerk id string) | `ownerUserId` (WorkOS id string) | Same field, value source changes. |
| `TeamMembership` (`teamMembership.ts`) | `clerkUserId` (indexed) | `workosUserId` (indexed) | Update both compound indexes. |
| `Team` (`team.ts`) | `createdByClerkUserId` | `createdByWorkosUserId` | |
| `PendingTeamAssignment` (`pendingTeamAssignment.ts`) | superseded — see §9 | folded into new `Invitation` model | Replaced entirely. |

All compound indexes that referenced `clerkUserId` are recreated with `workosUserId`, still
`workspaceId`-first per project rule:
- `TeamMembership`: `{ workspaceId, workosUserId }` and unique `{ workspaceId, teamId, workosUserId }`.

### 5.2 `User` model additions

```ts
workosUserId: { type: String, required: true, unique: true, index: true },
email:        { type: String, required: true, lowercase: true, trim: true, index: true },
name:         { type: String, default: "" },
avatarUrl:    { type: String, default: null },
mfaEnabled:   { type: Boolean, default: false },   // mirror of WorkOS factor state, for UI/badges
memberships:  [{ workspaceId, role: "owner"|"staff" }],  // unchanged — source of truth for tenancy
onboardingStep / onboardingCompletedAt / timeFormat   // unchanged
```

`mfaEnabled` is a convenience mirror written when the user enrols/removes a TOTP factor; WorkOS
remains authoritative for the actual factor.

### 5.3 Active-workspace identifier

There is **no `session.orgId` anymore**. The active workspace is tracked in a separate signed
cookie (§6.3) and always validated against `User.memberships` server-side.

---

## 6. Session, middleware & active-workspace resolution

### 6.1 Dependencies & session plumbing

- Add `@workos-inc/authkit-nextjs` (Next-aware session: middleware, `withAuth`, refresh) and
  `@workos-inc/node` (User Management API for our custom forms).
- Our custom forms call `@workos-inc/node` methods with
  `session: { sealSession: true, cookiePassword: WORKOS_COOKIE_PASSWORD }`, then set the
  resulting sealed `wos-session` httpOnly cookie. `authkit-nextjs` `withAuth()` and middleware
  read and refresh that exact cookie — so we own the UI but reuse all session plumbing.

### 6.2 `proxy.ts`

Replace `clerkMiddleware` with `authkitMiddleware`:
- Protected app routes require a valid session; unauthenticated → redirect to localized `/sign-in`.
- **Public bypass unchanged:** `/w/...` portfolio routes and `/api/webhooks/...` stay
  unauthenticated and skip intl middleware exactly as today.
- Middleware refreshes the sealed session when near expiry (handled by authkit-nextjs).

### 6.3 New `lib/auth/session.ts`

```ts
// Thin wrapper around authkit-nextjs withAuth(); the ONLY place we read WorkOS identity.
export async function getAuthUser(): Promise<{ workosUserId: string; email: string } | null>
```

### 6.4 Active-workspace cookie

- New httpOnly, signed cookie `gw_active_ws` holding a `workspaceId`.
- New `lib/auth/activeWorkspace.ts`:
  - `getActiveWorkspaceId()` — read + verify signature.
  - `setActiveWorkspace(workspaceId)` — set after onboarding / switcher selection.
  - **Resolution rule:** the cookie value is *never trusted alone*. The workspace is loaded via
    `Workspace.findById(cookieWsId)` **and** confirmed to appear in `User.memberships`. If the
    cookie is missing/invalid/not-a-membership, fall back to the user's sole membership (or
    most-recent), and redirect to `/onboarding` if they have none.
- Signed with a dedicated `ACTIVE_WORKSPACE_COOKIE_SECRET` (HMAC), `SameSite=Lax`, `Secure`,
  `HttpOnly`.

### 6.5 Tenant-resolution helpers (signatures preserved)

`requireOrg()`, `requireRole()`, `ownerContext()`, `loadOnboardingContext()` keep their external
behavior (return shapes, redirects) so call sites barely change. Internals swap:
- `auth()` (Clerk) → `getAuthUser()` (WorkOS).
- `Workspace.findOne({ clerkOrgId: session.orgId })` → active-workspace resolution (§6.4).
- Role derivation: `session.orgRole === "org:admin"` is **gone**. Role comes solely from
  `User.memberships[].role` for the active workspace (with `ownerUserId === workosUserId` as the
  owner backstop). This is stricter and fully Mongo-owned.

`lib/auth/teamContext.ts`: `getTeamsForUser(workspaceId, workosUserId)` — param rename only.

---

## 7. Auth ceremony UI (first-party, branded)

All screens are our own components under `app/[locale]/(auth)/...`, mobile-first at 375px, with
idle/hover/focus/active/disabled states, loading/error states, and **all 5 locales** (`en`, `fil`,
`ms`, `id`, `th`). Sharp corners, Merriweather, semantic tokens only.

### 7.1 Screens & backing actions

| Screen | Route | Server action / handler → WorkOS SDK |
|---|---|---|
| Sign in | `/sign-in` | `authenticateWithPassword` → seal session, set cookie. If MFA → §7.3. |
| Sign up | `/sign-up` | `createUser` + `authenticateWithPassword` (or email-verify flow) → JIT User → onboarding. Offer "Enable MFA" suggestion. |
| Continue with Google | button on both | `getAuthorizationUrl({ provider: "GoogleOAuth", redirectUri })` → `/api/auth/callback` runs `authenticateWithCode` → seal session. |
| Forgot password | `/forgot-password` | `sendPasswordResetEmail`. Generic success message (no enumeration). |
| Reset password | `/reset-password?token=` | `resetPassword({ token, newPassword })`. |
| Email verification (if enabled) | `/verify-email` | WorkOS email-verification code flow. |
| MFA challenge (login) | `/sign-in/mfa` | `authenticateWithTotp({ code, pendingAuthenticationToken })`. |

### 7.2 Google OAuth callback

`app/api/auth/callback/route.ts` (Node runtime, unauthenticated): receives `code` + `state`,
calls `authenticateWithCode`, seals the session, JIT-provisions the User, then redirects to the
post-auth destination. **`state` carries an optional invite token** (§9) and the intended locale.

### 7.3 MFA challenge on login

When a user with an enrolled TOTP factor signs in, `authenticateWithPassword` returns a
**`pendingAuthenticationToken`** (instead of a session). We render our `/sign-in/mfa` 6-digit
input and complete with `authenticateWithTotp({ code, pendingAuthenticationToken })`, then seal
the session. Exact SDK method names pinned against `@workos-inc/node` during implementation.

### 7.4 SDK method inventory (to verify against installed SDK)

`authenticateWithPassword`, `createUser`, `getUser`, `updateUser`, `getAuthorizationUrl`,
`authenticateWithCode`, `sendPasswordResetEmail`, `resetPassword`, `sendMagicAuthCode`,
`authenticateWithMagicAuth`, `enrollAuthFactor`, `challengeFactor`, `verifyChallenge` /
`authenticateWithTotp`, `listAuthFactors`, `deleteAuthFactor`.

---

## 8. MFA as a user setting

- New **Security** section in `settings` (first-party, replaces Clerk `<UserProfile>` security tab).
- **Enrol:** `enrollAuthFactor({ type: "totp" })` → render returned QR + secret → user enters code
  → `verifyChallenge` → on success set `User.mfaEnabled = true`.
- **Disable:** `deleteAuthFactor` → set `User.mfaEnabled = false`.
- **Suggestion at registration:** post-sign-up screen invites the user to enable MFA now; skippable.
- No enforcement logic at cutover. (Owner-enforced-per-workspace MFA = documented future item.)

---

## 9. Invites & teams (the intricate part — simplified by first-party accept)

### 9.1 Why it simplifies

Today's lease-based `PendingTeamAssignment` + `Team.pendingReleaseAcks` exactly-once journal exists
**only because Clerk owns invite acceptance out-of-band via webhook**, racing the owner's revoke.
With a **first-party, authenticated, transactional accept endpoint**, that cross-process race is
gone: acceptance is synchronous and runs inside a Mongo transaction. We retire most of the lease
machinery and keep only a single-use token guard.

### 9.2 New `Invitation` model (replaces `PendingTeamAssignment`)

```ts
{
  workspaceId: ObjectId (ref Workspace, indexed),
  email: string (lowercase, trim),
  role: "owner" | "staff",            // workspace-level role granted on accept
  teamIds: ObjectId[],                // team memberships to create
  leadOnTeamIds: ObjectId[],          // subset granted team "lead"
  tokenHash: string,                  // SHA-256 of high-entropy token; raw token only in the email link
  invitedByWorkosUserId: string,
  status: "pending" | "accepted" | "revoked" | "expired",
  expiresAt: Date,                    // e.g. 30 days
  acceptedAt / revokedAt: Date | null,
}
```

Indexes: `{ workspaceId, email }` unique on `status: "pending"` (partial), `{ tokenHash }` unique,
`{ expiresAt }` for the sweep. Creating the pending invite **reserves team seats** (the role
`PendingTeamAssignment` played), via the existing `assertCanAddTeamMember` / seat-count path.

### 9.3 Invite flow (owner)

`inviteMemberAction` (rewritten, `app/[locale]/(app)/teams/_invite-action.ts`):
1. `ownerContext()` guard; validate input with Zod; validate `teamIds` belong to the workspace.
2. Reserve seats per team (`assertCanAddTeamMember`), rolling back on partial cap failure (kept).
3. Generate high-entropy token; store **hash**; write one `Invitation` (status `pending`).
4. Send branded invite email via **Resend** (`lib/email/teamInvite.ts`, all 5 locales) with link
   `/invite/accept?token=<raw>`.
5. Re-invite over an existing pending invite: revoke the old invite + release its seats first
   (idempotent), then create the new one. No Clerk invite to revoke anymore.

All Clerk SDK calls (`createOrganizationInvitation`, `getOrganizationInvitationList`,
`revokeOrganizationInvitation`) are **deleted**.

### 9.4 Accept flow (invitee) — transactional

Route `app/api/invites/accept/route.ts` (or a server action behind `/invite/accept`):
1. Look up invite by `tokenHash`; assert `status === "pending"`, not expired.
2. If the visitor is unauthenticated, send them through sign-in/sign-up with the **token carried in
   OAuth/redirect `state`**; return here authenticated.
3. Assert the authenticated user's verified email matches the invite email (case-insensitive).
   Mismatch → reject (prevents token theft granting access to a different account).
4. **In a single Mongo transaction:** JIT-provision/lookup the `User`, add the workspace membership
   to `User.memberships`, create `TeamMembership` rows (with `lead` where applicable), convert the
   reserved seats to committed (no double counting), set `Invitation.status = "accepted"`.
5. Set the active-workspace cookie to the joined workspace; redirect to dashboard.

Because step 4 is transactional and single-use (token consumed), concurrent double-accepts and
accept-vs-revoke races resolve deterministically — no lease/ack journal required.

### 9.5 Revoke / expire / cleanup

- `revokeInviteAction`: set `status = "revoked"`, release reserved seats (idempotent decrement).
- A small cron (reuse existing job infra under `lib/db/jobs/`) sweeps `status: pending,
  expiresAt < now` → mark `expired` + release seats. Replaces `release-pending-invite-seats.ts`
  cron with a simpler equivalent.
- Seat release stays idempotent (guard so a double-run can't over-refund), but the multi-worker
  lease/`pendingReleaseAcks` complexity is removed.

### 9.6 Files retired/rewritten in this area

- **Delete:** `lib/db/models/pendingTeamAssignment.ts`,
  `lib/db/jobs/release-pending-invite-seats.ts` (replaced by simpler invite-sweep).
- **Rewrite:** `_invite-action.ts`, `_member-action.ts` (remove
  `deleteOrganizationMembership`; member removal now just deletes `User.memberships` entry +
  `TeamMembership` rows + releases seats in a transaction).
- **Add:** `lib/db/models/Invitation.ts`, `lib/email/teamInvite.ts`, accept route.

---

## 10. JIT provisioning & webhooks

### 10.1 JIT provisioning

On the first authenticated request after login (in the session wrapper or a small
`ensureUser(workosUser)` helper), upsert the Mongo `User` by `workosUserId`, syncing `email` /
`name` / `avatarUrl` from the WorkOS profile. Replaces Clerk's `user.created`/`user.updated`
webhook entirely.

### 10.2 Webhooks (minimal)

- **Delete** `app/api/webhooks/clerk/route.ts` and `CLERK_WEBHOOK_SECRET`.
- Add **one optional** WorkOS webhook `app/api/webhooks/workos/route.ts` (Node runtime), verifying
  the WorkOS signature on the **raw body before parsing**, handling only:
  - `user.deleted` → delete Mongo `User` + cascade membership cleanup.
  - `user.updated` → refresh email/name (defensive; JIT covers most cases).
- **No** org/membership/dsync webhooks (none exist in WorkOS for us).
- `svix` dependency: remove if Clerk was its only consumer (verify no other usage first).

---

## 11. Environment & dependency changes

### 11.1 Remove
`@clerk/nextjs`, `@clerk/themes`. Env: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
`CLERK_WEBHOOK_SECRET`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`,
`NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`.

### 11.2 Add
`@workos-inc/authkit-nextjs`, `@workos-inc/node`. Env:
- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_COOKIE_PASSWORD` (≥32 chars; seals `wos-session`)
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` (Google OAuth callback)
- `WORKOS_WEBHOOK_SECRET` (if webhook enabled)
- `ACTIVE_WORKSPACE_COOKIE_SECRET` (HMAC for `gw_active_ws`)

### 11.3 Delete files
`lib/auth/clerkAppearance.ts`, `lib/auth/userProfileAppearance.ts`,
`components/app/clerk-themed.tsx`, `app/api/webhooks/clerk/route.ts`,
`lib/db/models/pendingTeamAssignment.ts`, `lib/db/jobs/release-pending-invite-seats.ts`,
the Clerk-component sign-in/sign-up page bodies (replaced by custom forms).

---

## 12. File-by-file impact map

(Derived from the codebase audit; 25 Clerk-touching files.)

**Models:** `User.ts`, `Workspace.ts`, `teamMembership.ts`, `team.ts` re-keyed;
`pendingTeamAssignment.ts` deleted; `Invitation.ts` added.

**Auth lib:** `requireOrg.ts`, `ownerContext.ts`, `onboardingStep.ts`, `teamContext.ts` rewired to
WorkOS + active-workspace; `session.ts`, `activeWorkspace.ts`, `ensureUser.ts` added;
`clerkAppearance.ts`, `userProfileAppearance.ts` deleted; `assertCanAddTeamMember.ts` kept (seat
logic reused by Invitation).

**Middleware:** `proxy.ts` → `authkitMiddleware`.

**Server actions:** `lib/actions/onboarding.ts` (no Clerk org creation; create Workspace + default
team in Mongo, set active-workspace cookie), `lib/actions/dev.ts` (seed via Mongo/WorkOS API, not
`clerkClient`), `teams/_invite-action.ts` + `teams/_member-action.ts` rewritten.

**Pages/components:** `(auth)/sign-in`, `(auth)/sign-up` → custom forms; `(onboarding)/layout.tsx`
+ `business/page.tsx` + `business-form.tsx` (no `useOrganizationList`/`currentUser`); settings
`settings-org-switcher.tsx` → first-party workspace switcher (rewrites cookie),
`settings-user-profile.tsx` → first-party profile + Security/MFA, `settings/[[...catchall]]/page.tsx`
nav; `client-user-button.tsx` + `app-sidebar.tsx` → first-party avatar menu + sign-out (clears
session cookie via WorkOS `signOut`).

**API:** `webhooks/clerk` deleted; `webhooks/workos` (optional) + `auth/callback` +
`invites/accept` added; `billing/checkout/route.ts` reads email from session/User doc, not
`clerkClient().users.getUser()`.

---

## 13. Security posture (the "utmost security" requirement)

- **Tenant isolation unchanged & reinforced:** every tenant query/mutation stays `workspaceId`-
  scoped; the active-workspace cookie is **always validated against `User.memberships`**, never
  trusted as an authorization input. Role derived solely from Mongo.
- **Session cookie:** `wos-session` is sealed (encrypted) by WorkOS with `WORKOS_COOKIE_PASSWORD`,
  `HttpOnly`, `Secure`, `SameSite=Lax`; refreshed by middleware; cleared on sign-out.
- **Invite tokens:** high-entropy, **stored hashed (SHA-256)**, single-use, time-expiring, and
  **bound to the invited email** (verified against the authenticated user's verified email on
  accept). Raw token only ever in the emailed link.
- **Brute-force / bot protection (the custom-UI tradeoff):** hosted AuthKit's built-in Radar/
  throttling does **not** cover our custom forms, so we add **per-IP + per-email rate limiting /
  temporary lockout** on sign-in, sign-up, password-reset, MFA-verify, and invite-accept endpoints,
  plus a **bot check/CAPTCHA** on sign-up and password-reset. WorkOS still enforces baseline API
  rate limits and never exposes credential hashes.
- **No user enumeration:** sign-in, forgot-password, and sign-up errors are generic and timing-
  insensitive.
- **CSRF:** state-changing auth POSTs use Next server actions / same-site cookies; OAuth uses a
  signed `state` param validated on callback.
- **Webhooks:** raw-body signature verification before parsing; Node runtime.
- **Secrets:** all WorkOS keys server-only; only `NEXT_PUBLIC_WORKOS_REDIRECT_URI` is public.
- **MFA available immediately** as a self-serve hardening option.

---

## 14. Testing strategy

Per project rule, every change ships with tests; mock only external services (WorkOS SDK,
Resend). Use in-memory Mongo; never mock Mongoose.

- **Unit:** active-workspace resolution (valid/invalid/forged cookie, non-member workspace,
  fallback, no-membership redirect); role derivation from memberships; invite token hashing &
  expiry; seat reservation/release idempotency.
- **Auth actions:** sign-in success / wrong-password / MFA-required branch (mock WorkOS returning
  `pendingAuthenticationToken`); sign-up + JIT user creation; Google callback `authenticateWithCode`
  + state handling; password reset.
- **Invites (integration):** invite → email enqueued → accept (transactional membership +
  TeamMembership creation, seat conversion) → re-accept rejected (single-use); email-mismatch
  rejected; revoke releases seats; expiry sweep releases seats; concurrent accept/revoke determinism.
- **Tenant isolation:** member of workspace A cannot resolve/act on workspace B by swapping the
  active-workspace cookie; mutations by `_id` still filter `workspaceId`.
- **Security:** rate-limit lockout triggers; no user-enumeration in responses; webhook signature
  rejection on tampered body.
- **Locales:** all auth + invite copy present in `en`, `fil`, `ms`, `id`, `th`.

Gate before done: affected tests, `pnpm typecheck`, `pnpm lint`, `pnpm build`, 375px check on every
new screen.

---

## 15. Cutover sequence (big-bang, pre-launch)

1. Provision WorkOS: API key, client id, redirect URI, Google connection, cookie password.
2. Land schema re-key + new `Invitation` model + drop Clerk-keyed collections (dev DB).
3. Session/middleware/active-workspace layer + helpers.
4. Custom auth UI + actions (sign-in/up, Google, reset, MFA).
5. Onboarding rewrite (Mongo-only workspace + default team).
6. Invite/team rewrite (Invitation model, accept route, email, revoke, sweep).
7. Settings: profile + Security/MFA + workspace switcher.
8. Remove all Clerk deps/env/files; optional WorkOS webhook.
9. Full test + typecheck + lint + build; manual smoke of every flow at 375px.
10. Strict code review (security-focused) → fix → merge to `dev` after approval.

---

## 16. Future / out-of-scope (documented, not built now)

- **Enterprise SAML/OIDC SSO** for a tenant: introduce a **lazy WorkOS Organization mirror** for
  that one workspace (store `workosOrganizationId`), pay per connection. Org membership still
  shadowed by our Mongo membership.
- **Directory Sync (SCIM)** for enterprise tenants (org-scoped, paid).
- **Owner-enforced MFA** per workspace.
- **Magic Auth / passkeys** as primary login options (wiring already present).
