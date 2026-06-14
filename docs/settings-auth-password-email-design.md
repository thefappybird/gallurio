# Design: In-app Password (change / set)

Status: **Approved design — not yet executed**
Date: 2026-06-13
Branch: `fix/settings-page`
Complements: `docs/settings-auth-ui-enhancements-plan.md` (refines Task 6)

## Goal

In the Settings → Account panel, let users manage their password with our own UI (matching sign-in/sign-up) backed by WorkOS AuthKit:

1. **Password users**: change their password (verify current → set new).
2. **Google/OAuth-only users**: set a password (so they can also sign in with email), via the existing reset-email flow.

User-facing copy must never name the auth provider ("WorkOS").

## Confirmed decisions

- Password feature: **change + set**.
- Resend is already configured. **No new env vars required.**
- Email change is **out of scope** (intentionally not built).

## Relevant existing building blocks (from the index)

- `app/[locale]/(auth)/_actions.ts`
  - `forgotPasswordAction` → `workos.userManagement.createPasswordReset({ email })`, then sends the reset link via Resend (`RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`). Pattern to reuse for "set a password".
  - `resetPasswordAction` → `workos.userManagement.resetPassword({ token, newPassword })`. The existing `reset-password` page already sets a password from a token; we reuse it verbatim for the "set a password" path.
- `app/[locale]/(app)/settings/_actions.ts`
  - `updateProfileNameAction` → guard with `getAuthUser()`, call `workos.userManagement.updateUser(...)`, then sync Mongo `User` + `revalidatePath("/settings","layout")`. Template for the new action. `ActionResult = { ok: true } | { error: string }`.
- `lib/server/authRateLimit.ts` → `checkAuthRateLimit({ email?, ip })`.
- `lib/auth/session.ts` → `getAuthUser()` returns `{ workosUserId, email, name, avatarUrl } | null`.
- Form UI conventions (`app/[locale]/(auth)/sign-in/_sign-in-form.tsx`): `useActionState`, `Label`/`Input`/`Button` primitives, show/hide password toggle (`Eye`/`EyeOff`), `role="alert"` error text, sharp-cornered `border border-border bg-background` cards, `useTranslations("auth")`.

## WorkOS SDK facts (v10.2.0) that constrain the design

- `updateUser({ userId, password? })` → `User`. Supports setting `password`.
- `getUser`/`User` exposes **no** "has password" indicator.
- `getUserIdentities(userId)` → `Identity[]` of OAuth links (`GoogleOAuth`, etc.). In this app the only auth methods are email+password and Google, so:
  - `identities.length === 0` ⟹ password user (reliable).
  - `identities.length > 0` ⟹ signed up via Google; no password initially.
- `authenticateWithPassword({ email, password })` throws `AuthenticationException` on bad credentials; there is **no** distinct "no password set" error code. We therefore drive UI from `getUserIdentities`, not from catching this error.
- `createPasswordReset({ email })` → `{ passwordResetToken, passwordResetUrl, expiresAt, ... }`. `resetPassword({ token, newPassword })`.

## Architecture

### Server: identity resolution helper

`getAuthMethods(workosUserId)` (settings server module): returns `{ hasOAuth: boolean, oauthProviders: string[] }` from `workos.userManagement.getUserIdentities(workosUserId)`. The Account panel (Server Component) calls this and passes `hasOAuth` to the client form. Failure is non-fatal: default `hasOAuth: false` and log.

### Password user (`!hasOAuth`): change password

- Client form: `current`, `new`, `confirm` (show/hide toggles; `autoComplete="current-password"` / `"new-password"`).
- Zod (client + server): `new` min 8 / max 128, `confirm === new`.
- `updatePasswordAction(input)` in `settings/_actions.ts`:
  1. `getAuthUser()` guard.
  2. Validate input; reject mismatch/constraints with generic field-agnostic messages.
  3. `checkAuthRateLimit({ email: authUser.email, ip })` (reuse `getIp()`); on limit → "Too many attempts" message.
  4. `authenticateWithPassword({ email: authUser.email, password: current })`; catch `AuthenticationException` → return `{ error: "Current password is incorrect." }` (no enumeration).
  5. `updateUser({ userId: workosUserId, password: newPassword })`.
  6. Return `{ ok: true }`. No DB write needed (password lives in WorkOS).

### Google user (`hasOAuth`): set a password

- Card explains they sign in with Google and can set a password to also sign in with email. No current-password field.
- Button → `sendSetPasswordEmailAction()`:
  1. `getAuthUser()` guard + `checkAuthRateLimit({ email, ip })`.
  2. `createPasswordReset({ email })` → send link to the user's email via the existing Resend helper (extract the send logic from `forgotPasswordAction` into a small shared `sendPasswordResetEmail(email, token)` util so both call sites share it).
  3. Return `{ ok: true }` with an in-UI "Check your email" confirmation.
- The link reuses the existing `reset-password` page → `resetPasswordAction`. No new reset UI.
- Accepted edge: a user who linked Google *and* already set a password still sees this path; clicking it simply resets. Not worth extra detection.

## Shared utilities

- `sendPasswordResetEmail(email, rawToken)` — extracted from `forgotPasswordAction`; used by both forgot-password and set-a-password.

## i18n

New keys in `messages/{en,fil,ms,id}.json` under the `auth`/`account` namespace:
- change-password: title, labels, submit, current-incorrect, too-many-attempts.
- set-password: title, body, button, sent confirmation.
All four locales updated together. No `th`.

## Testing

- `updatePasswordAction`: success; wrong current (AuthenticationException); validation (mismatch/length); rate-limit.
- `sendSetPasswordEmailAction`: success path (createPasswordReset called, email sent), rate-limit.
- Panel gating: `hasOAuth` true → renders set-password card; false → renders change-password form.
- Identity safety: the action guards on `getAuthUser()` and only ever acts on the caller's own `workosUserId`.

Mock WorkOS and Resend; use in-memory Mongo where DB assertions are needed.

## Out of scope

- **Email change — not built.**
- Avatar upload, tab merge, logout button, danger-zone removal, switcher hiding — those remain in `settings-auth-ui-enhancements-plan.md`.
- Changing the Google account itself; multi-identity linking UI.
- Enforcing one-owner-workspace.

## Env

None new. Confirmed present: `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, and all WorkOS vars.
