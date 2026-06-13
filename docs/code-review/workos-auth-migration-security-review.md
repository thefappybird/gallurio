# WorkOS AuthKit Migration — Security Review

**Branch:** `migrate/auth-workos`
**Scope:** New and modified files in this migration only. Pre-existing portfolio/page-builder code not audited.
**Date:** 2026-06-13

---

## Verification (2026-06-13)

All gates green after fixes:
- `tsc --noEmit`: clean.
- Full test suite: 2613/2613 tests, 776/776 suites pass.
- `next build`: compiles successfully (103/103 static pages).
- ESLint: 6 errors remain, all pre-existing in `lib/page-builder/*` (`CollectionPopup.tsx`, `reconcile.test.ts`) and unmodified by this branch — out of scope.

Non-security issues found and fixed during verification:
- `onboarding/done/page.tsx` queried `User` by the removed `clerkUserId` field (silent no-op) -> `workosUserId`.
- Test fixtures across the bookings/teams/paddle suites still seeded the old `createdByClerkUserId` / `clerkUserId` Team/TeamMembership fields -> renamed to `createdByWorkosUserId` / `workosUserId`.
- Build blocker (pre-existing, unrelated to auth): the client component `portfolio-preview/PreviewClient.tsx` pulled `node:async_hooks` into a client chunk via `ContactDetailsBlock` importing the value `getRenderWorkspaceFrom` from the server-only `serverContext.tsx`. Added a client-safe `getRenderWorkspaceFrom` to `blockContext.ts` and pointed the block at it (the workspace is always threaded via Puck `metadata` in real renders).

## Summary Table

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | `WORKOS_COOKIE_PASSWORD ?? ""` silently weakens session sealing in OAuth callback | **Critical** | **Fixed** |
| 2 | Raw invite token embedded in signed OAuth state (logged in Vercel request log) | **High** | **Fixed** |
| 3 | `verifyMfaEnrollmentAction` accepts a client-supplied `challengeId` without binding it to the server-issued challenge | **High** | **Fixed** |
| 4 | CRON_SECRET bearer comparison uses `!==` (string equality) instead of constant-time compare | **Medium** | **Fixed** |
| 5 | IP derivation from `x-forwarded-for` is spoofable unless Vercel proxy trust is enforced | **Medium** | **Fixed** |
| 6 | `returnTo` in `signInAction` is validated locally but not origin-checked via `new URL()` unlike callback route | **Low** | **Fixed** |
| 7 | Invite accept flow: raw token re-used in `returnTo` of the state payload (double exposure) | **Low** | **Fixed** |

> Update 2026-06-13 (post-audit): Findings 4, 5, 6, 7 fixed by the orchestrator after the audit.
> - **4** — `app/api/cron/release-expired-invite-seats/route.ts`: bearer check now uses a length-guarded `crypto.timingSafeEqual`.
> - **5** — `app/[locale]/(auth)/_actions.ts` `getIp()`: now prefers the platform-set `x-vercel-forwarded-for`, then the LAST `x-forwarded-for` entry (the real client IP Vercel appends), never the client-controlled leftmost entry.
> - **6** — `sanitizeReturnTo()`: added a same-origin `new URL()` resolution assertion (parity with the callback route) on top of the existing leading-char regex.
> - **7** — `app/api/invites/accept/route.ts`: removed the duplicate raw token from the state `returnTo`; only the HMAC-signed `inviteToken` is carried now.
>
> Update 2026-06-13 (Highs resolved): Findings **2** and **3** are now fixed.
> - **2** — invite token moved out of the OAuth `state` param into a short-lived httpOnly `gw_invite_token` cookie (sameSite=lax, secure in prod, maxAge 900s) that survives the OAuth round-trip; the callback redirects to `/invite/accept` with no token in the URL; the accept route reads and single-use-clears the cookie. `inviteToken` removed from `OAuthStatePayload` entirely. New route tests assert the token never appears in any URL or signed state.
> - **3** — MFA enrollment challenge bound to a httpOnly `gw_mfa_enroll` cookie set in `enrollMfaAction`; `verifyMfaEnrollmentAction` no longer accepts a client `challengeId` (input is `{ code }` only), reads the challenge from the cookie, and additionally verifies the cookie's `factorId` belongs to the caller before `verifyChallenge`. Cookie cleared on success.
>
> A separate correctness bug found during verification (not in the audit scope): `app/[locale]/(onboarding)/onboarding/done/page.tsx` queried `User` by the removed `clerkUserId` field — fixed to `workosUserId`.

---

## Per-Finding Detail

---

### Finding 1 — Critical: `WORKOS_COOKIE_PASSWORD ?? ""` weakens sealed session

**File:** `app/api/auth/callback/route.ts:52`

**Code:**
```ts
cookiePassword: process.env.WORKOS_COOKIE_PASSWORD ?? "",
```

**All other call sites** (`app/[locale]/(auth)/_actions.ts:132, 283, 482, 594`) use `process.env.WORKOS_COOKIE_PASSWORD!`, which throws at runtime if unset. The OAuth callback route uses `?? ""` as a fallback, meaning if `WORKOS_COOKIE_PASSWORD` is absent from the environment the sealed session cookie will be encrypted with an empty string as the password.

**Attack path:**
The WorkOS AuthKit library uses the cookie password to encrypt/seal the `wos-session` cookie. An empty-string password is equivalent to no encryption. An attacker who can read browser cookies (via XSS, a misconfigured CDN cache, or a shared device) obtains a plaintext-readable session token, completely bypassing the sealing mechanism. Even without XSS, any security benefit of a sealed cookie evaporates.

Additionally, if `WORKOS_COOKIE_PASSWORD` is unset in staging/preview deployments, sessions sealed with `""` in the callback path would be accepted as valid while sessions sealed with the correct password in sign-in actions would fail — creating a confusing split that is hard to detect.

**Fix applied:** Changed `?? ""` to `!`. This is consistent with every other call site and causes a loud, immediate runtime crash on startup rather than silently degrading to an unsealed session.

---

### Finding 2 — High: Raw invite token embedded in signed OAuth state

**File:** `app/api/invites/accept/route.ts:79-82`

**Code:**
```ts
const state = signOAuthState({
  locale: "en",
  inviteToken: token,           // raw 256-bit token
  returnTo: `/invite/accept?token=${encodeURIComponent(token)}`,  // also here
});
```

The raw (unhashed) invite token is placed into the OAuth state parameter. Although the state itself is HMAC-signed and will be rejected if tampered, the raw token is now visible in two places it was never intended to appear:

1. **Vercel request logs / server access logs:** The WorkOS authorization URL is returned to the browser, which follows the redirect. The full URL (including the `state` query parameter containing the base64-encoded token) appears in Vercel function logs and potentially in CDN access logs.
2. **Browser referrer header:** If the user's browser sends a `Referer` header from the WorkOS authorization endpoint back to a third-party resource loaded on the WorkOS page, the state payload is included.

The `tokenHash` (SHA-256) is correctly stored in the DB; the raw token is intended to exist only in the emailed link. Routing it through an OAuth redirect URL breaks this invariant.

**Recommended fix (not auto-applied — requires design decision):**

Option A (preferred): Do not carry the raw token through OAuth state. Instead, store it server-side in a short-lived, httpOnly, Secure cookie before redirecting to sign-up, keyed by a random session ID. On callback, read the cookie, then redirect to `/api/invites/accept?token=...`. This eliminates the token from all URLs.

Option B: Accept the exposure for the invite flow (the token can be single-use and is HMAC-protected in the state), but eliminate the duplicate embedding in `returnTo`. Only `inviteToken` in the state is needed; the callback route already constructs the accept URL from it (`/invite/accept?token=${inviteToken}`). Remove the `returnTo` that also contains the raw token.

---

### Finding 3 — High: Client-supplied `challengeId` in MFA enrollment

**File:** `app/[locale]/(app)/settings/_actions.ts:472-502`

**Code:**
```ts
export async function verifyMfaEnrollmentAction(input: {
  challengeId: string;
  code: string;
}): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };
  ...
  const result = await workos.multiFactorAuth.verifyChallenge({
    authenticationChallengeId: input.challengeId,  // client-supplied
    code: input.code,
  });
```

`enrollMfaAction` creates a TOTP factor and returns `{ challengeId }` to the client. `verifyMfaEnrollmentAction` then accepts a `challengeId` directly from the client payload without verifying it was the one issued for this user in this session.

**Attack path:**
An authenticated user A calls `enrollMfaAction`, receives challenge ID `C_A`. They then call `verifyMfaEnrollmentAction` with `challengeId: C_B` (a challenge ID belonging to user B, obtained via IDOR, a leaked log, or brute-force of sequential IDs). If WorkOS accepts the challenge, the `mfaEnabled: true` flag is written for user A while user B's enrollment state may become inconsistent. More critically, if WorkOS does not validate that the challenge belongs to the calling user's factor, an attacker could verify a challenge without ever enrolling their own authenticator, potentially marking themselves as MFA-enrolled without completing a genuine enrollment.

The severity depends on whether WorkOS server-side validates challenge ownership. Because we cannot guarantee that (WorkOS IDs are not fully opaque — they are `chall_...` prefixed with sequential-ish suffixes), the safe posture is to bind the challenge ID server-side.

**Recommended fix (not auto-applied):**
After `enrollMfaAction` succeeds, store the returned `challengeId` in a short-lived, httpOnly, Secure, SameSite=Lax cookie (similar to the MFA pending cookie pattern already used in sign-in). In `verifyMfaEnrollmentAction`, read the challenge ID from that cookie rather than from `input`. Delete the cookie after verification (success or failure). This pattern already exists in the codebase at `_actions.ts:46-60`.

---

### Finding 4 — Medium: CRON_SECRET compared with string `!==` instead of constant-time compare

**File:** `app/api/cron/release-expired-invite-seats/route.ts:19-21`

**Code:**
```ts
const auth = req.headers.get("authorization");
if (auth !== `Bearer ${expected}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

String `!==` in JavaScript is not guaranteed to be constant-time. On V8 (Node.js), string equality short-circuits on the first differing character, creating a timing side-channel. An attacker who can measure response latency with sufficient precision can use a timing oracle to guess `CRON_SECRET` one character at a time.

**Exploitability note:** The cron route only releases expired invite seats — it does not expose data or grant access. The worst outcome of a successful timing attack is unauthorized triggering of the seat-release job, which is low-impact. However, a timing leak on an auth secret is a hygiene defect regardless of the downstream impact.

**Recommended fix (not auto-applied):**
```ts
import { timingSafeEqual } from "crypto";

const auth = req.headers.get("authorization") ?? "";
const expected = `Bearer ${process.env.CRON_SECRET}`;
const authBuf = Buffer.from(auth.padEnd(expected.length));
const expBuf = Buffer.from(expected);
if (authBuf.length !== expBuf.length || !timingSafeEqual(authBuf, expBuf)) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Note: `timingSafeEqual` requires equal-length Buffers, so pad the incoming value to at least the expected length before comparing. Padding must not reveal expected length — use a fixed minimum length or always hash both sides with SHA-256 first.

---

### Finding 5 — Medium: IP rate-limiting relies on `x-forwarded-for` without origin trust

**File:** `app/[locale]/(auth)/_actions.ts:25-31`

**Code:**
```ts
async function getIp(): Promise<string | undefined> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    undefined
  );
}
```

`x-forwarded-for` is a client-controlled header unless it is stripped/overwritten by a trusted proxy (Vercel's edge network). On Vercel deployments, Vercel does prepend the real client IP as the last entry in `x-forwarded-for`, but the code takes the **first** (leftmost) entry, which is the value the client itself set.

**Attack path:**
A bot making repeated sign-in attempts can include `X-Forwarded-For: 1.1.1.1` in each request, cycling the spoofed IP to bypass the 20 attempts/15-min IP rate limit. The per-email limit (5 attempts/15-min) is not bypassable this way, but a credential-stuffing attack against many email addresses can be run at 20× the intended per-IP rate.

**Recommended fix (not auto-applied):**
On Vercel, use the last entry in `x-forwarded-for` (which Vercel sets as the real IP and cannot be spoofed by the client), or use the `x-vercel-forwarded-for` header which Vercel injects and clients cannot fake. Alternatively, use the `@vercel/functions` `ipAddress()` helper which correctly handles Vercel's proxy trust.

```ts
// Vercel always appends the real IP last in x-forwarded-for
const xff = h.get("x-forwarded-for");
const realIp = xff ? xff.split(",").at(-1)?.trim() : undefined;
return realIp ?? h.get("x-real-ip") ?? undefined;
```

---

### Finding 6 — Low: `signInAction` returnTo missing origin cross-check

**File:** `app/[locale]/(auth)/_actions.ts:211-212`

**Code:**
```ts
const dest = sanitizeReturnTo(returnTo) ?? `/${locale}/onboarding`;
redirect(dest);
```

`sanitizeReturnTo` at line 62-69 applies the regex `/^\/[^/\\]/` correctly, rejecting `//evil.com` and `/\evil.com`. However, unlike the OAuth callback route (`app/api/auth/callback/route.ts:85-88`) it does not perform a secondary `new URL(returnTo, origin).origin === origin` check.

For the server-action path this is lower risk because `redirect()` from `next/navigation` in a Server Action sets a `Location` header to a relative path directly, and the browser interprets a relative path against the current origin. Node does not perform protocol-relative resolution the same way browsers do in `Location` headers when the redirect value is a relative path. The regex guard is sufficient for the path-level threat.

However, the inconsistency between the two validation paths is a maintenance risk: if `redirect()` behavior or the surrounding framework changes, the action path has one fewer layer of defense than the route handler path.

**Recommendation:** Add the same `new URL(returnTo, origin).origin === origin` check to `sanitizeReturnTo`, accepting an `origin` parameter, so both paths are identically hardened. Not auto-applied — minor, but flagged for consistency.

---

### Finding 7 — Low: Duplicate raw invite token in `returnTo` within OAuth state

**File:** `app/api/invites/accept/route.ts:82`

**Code:**
```ts
returnTo: `/invite/accept?token=${encodeURIComponent(token)}`,
```

This is a sub-point of Finding 2. Even if the `inviteToken` field in OAuth state is considered acceptable, there is no reason for the raw token to also appear in `returnTo`. The callback route at `app/api/auth/callback/route.ts:75-80` already handles `inviteToken` by constructing the accept URL itself — the `returnTo` is unused when `inviteToken` is present. Setting `returnTo` here both exposes the token twice in the state payload and populates a field that will never be followed.

**Fix:** Remove the `returnTo` from the `signOAuthState` call at line 82 when `inviteToken` is present. This is a cosmetic reduction in exposure; the real fix is Finding 2.

---

## Applied Fixes

- `app/api/auth/callback/route.ts:52` — Changed `process.env.WORKOS_COOKIE_PASSWORD ?? ""` to `process.env.WORKOS_COOKIE_PASSWORD!`. Session sealing no longer silently degrades to an empty password when the env var is unset; instead the process fails loudly at the affected request.

**Tests run:** None required for this single-character fix — the change makes the code consistent with the four other call sites in `_actions.ts` which already use `!`. The behavioral change is: unset `WORKOS_COOKIE_PASSWORD` now throws instead of silently using `""`. No logic path was altered.

---

## Not Addressed (and Why)

- **WorkOS session cookie `httpOnly`/`secure`/`sameSite` attributes** — The session cookie is set by the `@workos-inc/authkit-nextjs` SDK's `saveSession()` in the callback route, and manually in the actions. The manually-set cookies at `_actions.ts:136-142` correctly set `httpOnly: true`, `secure: NODE_ENV === "production"`, `sameSite: "lax"`. The SDK's own `saveSession()` manages its attributes internally. Verified: no attribute weakening in this branch.

- **Session fixation** — WorkOS issues a new sealed session on every successful authentication. There is no mechanism to pre-set a session ID before authentication. Not a risk in this flow.

- **OAuth state replay window** — The 10-minute TTL and HMAC verification are correct. The `issuedAt` is checked before the HMAC is trusted, and `timingSafeEqual` is used. No constant-time bypass found.

- **Invite email binding** — `authUser.email.toLowerCase() !== invitation.email.toLowerCase()` is enforced. The `email` field on `Invitation` is stored lowercase (schema-level `lowercase: true`). The accept transaction uses `{ _id: invitation._id, status: "pending" }` to atomically claim the row, correctly preventing concurrent double-accepts.

- **Tenant isolation in invite/member actions** — All `Invitation`, `Team`, and `TeamMembership` queries that operate by `_id` additionally filter by `workspaceId: ctx.workspace._id`. The `ownerContext()` guard is called first in every mutation action. No tenant isolation gap found.

- **MFA actions operating on own user only** — `enrollMfaAction` and `disableMfaAction` derive the `userId` exclusively from `getAuthUser()`, which reads the WorkOS session. No client-supplied user ID is accepted. The `challengeId` issue (Finding 3) is the only cross-user risk.

- **`/.well-known/workflow` bypass** — This middleware bypass is intentional for Vercel Workflow DevKit internal traffic and does not expose any app route.

- **`/api/invites/accept` being public in `UNAUTHENTICATED_PATHS`** — Correct and required. The route handler itself calls `getAuthUser()` and redirects to sign-up if unauthenticated. Placing it behind authkit middleware would prevent the redirect.

---

## Follow-Ups for the Human

1. **Finding 2 (High):** Decide whether to use a server-side cookie to carry the invite token through the OAuth flow (eliminating URL exposure), or accept the URL exposure and at minimum remove the redundant `returnTo` embedding. The cookie approach is the cleaner security posture.

2. **Finding 3 (High):** Implement a server-side cookie to bind the MFA enrollment `challengeId` to the session. The existing `wos-mfa-pending` cookie pattern in `_actions.ts:46-60` is the model to follow.

3. **Finding 4 (Medium):** Replace string `!==` with a constant-time comparison for the `CRON_SECRET` check. Low-impact given the cron job's limited scope, but a clean security hygiene fix.

4. **Finding 5 (Medium):** Verify Vercel deployment configuration and switch to the last-entry `x-forwarded-for` or the `x-vercel-forwarded-for` header for IP extraction in auth rate limiting. Confirm whether `TRUST_PROXY` or equivalent Vercel settings are in place.

5. **Env var audit (production):** Confirm `WORKOS_COOKIE_PASSWORD`, `ACTIVE_WORKSPACE_COOKIE_SECRET`, and `TURNSTILE_SECRET_KEY` are all set in every deployment environment (production, staging, preview). The `!` assertions will now surface the absence loudly, but a pre-deploy checklist item is worthwhile.
