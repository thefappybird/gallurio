# Branded Transactional Emails — Design

**Date:** 2026-06-22
**Branch:** `enhance/branded-transactional-emails`
**Worktree:** `.claude/worktrees/branded-emails`

## Problem

Gallurio's outgoing emails are visually inconsistent and unbranded. Each of the
six send sites hand-rolls its own inline HTML (black `#111` buttons, ad-hoc
widths, duplicated `escapeHtml`), and only the team-invite is translated. Auth
emails sent by WorkOS use WorkOS's own template, so mail does not look like it
comes from one product. Goal: every email Gallurio is responsible for shares one
branded, accessible, localized template, and the one email WorkOS sends today is
brought under that same template.

## Current state (evidence)

Transport: `lib/email/send.ts` — raw `fetch` to `https://api.resend.com/emails`
(no SDK), `sendEmail()` helper, best-effort (never throws), dev fallback logs to
console when `RESEND_API_KEY` unset. Sender from `EMAIL_FROM`
(`Gallurio <onboarding@resend.dev>` default), optional `EMAIL_REPLY_TO`.

Six send sites, all inline HTML strings, no shared wrapper:

| Email | Builder | i18n |
|---|---|---|
| Team invite | `lib/email/teamInvite.ts` | en/fil/ms/id (inline map) |
| Inquiry owner notification | `lib/email/inquiryNotification.ts` | en only |
| Inquiry client confirmation | `lib/email/inquiryClientConfirmation.ts` | en only |
| Password reset (forgot) | `app/[locale]/(auth)/_actions.ts:~411` (inline) | en only |
| Password reset / set-password | `lib/email/sendPasswordResetEmail.ts` | en only |
| Generic in-app notification | `lib/email/notifications.ts` | en only |

`escapeHtml`/`htmlEscape` is re-implemented per file. `lib/email/resend.ts`
imports the unused SDK. `lib/email/templates/data-export.ts` builds a text body
but is not wired to any send.

WorkOS email reality for Gallurio (verified against WorkOS docs + code):
- **WorkOS sends exactly one email today:** the email-verification code at
  signup / via `resendVerificationEmailAction`
  (`workos.userManagement.sendVerificationEmail`, `app/[locale]/(auth)/_actions.ts:~559`).
- Password reset: WorkOS only mints the token (`createPasswordReset`); **Gallurio
  sends** the email via Resend.
- Team/org invites: fully Gallurio (own `Invitation` model + Resend); no WorkOS
  invitation API used.
- MFA: TOTP authenticator app — **no email**.
- Magic auth: dormant (not implemented).

## Brand tokens (resolved to hex for email — no CSS vars/Tailwind in mail)

Light: bg `#f8f8f8`, text `#424242`, muted text `#858a8f`, border `#e6e6e6`,
teal accent `#0d8fa1`, teal-on-dark surfaces use `#ffffff` text.
Dark (`prefers-color-scheme: dark`): bg `#353535`, text `#eaeaea`, teal `#2fb3d9`.
Font stack: `'Plus Jakarta Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
(web fonts don't load in most mail clients; the stack degrades gracefully).
No logo asset exists yet → header/footer render a **text wordmark "Gallurio"**.

## Target architecture

### 1. Shared template — `lib/email/layout.ts`
Export `renderBrandedEmail(opts): { html; text }`. Hand-rolled, table-based,
600px max width, fully inline styles (email-client safe). **No new dependency**
(do not add `@react-email`); keep the existing string-builder pattern, just
centralized. Structure mirrors the reference design:
- **Header band** (teal `#0d8fa1`): left = "Gallurio" wordmark; right = title +
  optional subtitle.
- **Preheader** (hidden preview text) from `opts.preheader`.
- **Body**: ordered blocks — paragraphs, an optional section heading, optional
  key/value rows (for inquiry details), CTA(s).
- **CTAs**: `primary` (filled teal) and optional `secondary` (outline). Bulletproof
  button markup (table + VML-free fallback acceptable for MVP; documented).
- **Divider** + optional support line.
- **Footer** (charcoal `#353535`): wordmark, tagline "Bookings, simplified.",
  support link (`support@gallurio.com`), `© <year> Gallurio. All rights reserved.`
  **Minimal** — no address, no social icons, no unsubscribe (transactional).
- `LOGO_URL` constant (empty/undefined → wordmark). Swapping to a real logo later
  is a one-line change: set `LOGO_URL` and the header renders `<img>`.
- `prefers-color-scheme: dark` block in a `<style>` head + dark-safe inline
  fallbacks.

`opts` shape (informal):
```
{ locale, preheader, title, subtitle?,
  blocks: Array<{ type:'p'|'heading'|'rows'|'spacer', ... }>,
  cta?: { label, url }, secondaryCta?: { label, url },
  supportLine?: string }
```
Returns matching `text` (plain-text fallback) derived from the same blocks.

### 2. Shared `escapeHtml` — `lib/email/escapeHtml.ts`
One implementation; delete the per-file copies. Template and all senders import it.

### 3. Refactor the six senders
Each builder calls `renderBrandedEmail` with its content blocks instead of
emitting bespoke HTML. Behavior (recipients, subjects, links, best-effort
semantics) unchanged. `lib/email/resend.ts` (unused SDK import) deleted.

### 4. i18n all emails — `en/fil/ms/id`
Move every email's copy into the locale layer. Two acceptable placements;
**decision: use a dedicated `lib/email/messages.ts` map** keyed by email +
locale (mirrors the existing `teamInvite` inline-map pattern, keeps email copy
out of the UI `messages/*.json` and avoids `getTranslations` server-context
coupling inside best-effort senders). Locale resolved from workspace country via
the existing helper (`ph→fil, my→ms, id→id, else en`). Team-invite's inline map
folds into this shared map.

### 5. WorkOS verification takeover — event-driven custom email
- New route handler `app/api/webhooks/workos/route.ts`, **Node runtime**.
  Verify the WorkOS webhook signature against the **raw body** (HMAC, timestamp
  tolerance) before parsing — reuse the same raw-body discipline as Paddle.
- Handle `email_verification.created`: payload carries only an `id` (+ user/email);
  call **Get Email Verification** to fetch the `code`, then render via
  `renderBrandedEmail` and send through Resend. Ack 200 after signature verify
  even if send fails (log/dead-letter; never 500 into WorkOS retries).
- **Disable WorkOS default verification email** in the dashboard (documented
  task) so users don't get two.
- Fix `resendVerificationEmailAction`: once WorkOS defaults are off, calling
  `sendVerificationEmail` must still cause our email to go out. Confirm whether
  `sendVerificationEmail` re-emits `email_verification.created` (preferred) or
  whether we must call our own render+send directly. **Verify live during impl.**
- `WORKOS_WEBHOOK_SECRET` env var added.

### 6. Dashboard / external config (no code; documented in spec + README note)
- **WorkOS Branding**: upload Gallurio logo + set the 4 colors (light/dark) so
  any WorkOS-composed mail (MFA, anything not taken over) is on-brand.
- **Own Google OAuth credentials**: create a Gallurio-branded Google Cloud OAuth
  client (consent screen name + logo) and set it in WorkOS → Authentication →
  Google OAuth. Fixes the account chooser showing "Sign in to … WorkOS".
  (Optionally the equivalent for Microsoft if/when enabled.)
- **Optional** custom sending domain (`no-reply@gallurio.com`) via WorkOS custom
  domain CNAMEs and/or Resend domain verification — out of scope for code, noted.

## What stays WorkOS-templated (accepted)
MFA emails (none today anyway) and any future Radar/Admin-portal mail: covered by
dashboard branding only. Documented as a known boundary.

## Files

New:
- `lib/email/layout.ts` — `renderBrandedEmail`
- `lib/email/escapeHtml.ts` — shared util
- `lib/email/messages.ts` — per-email locale copy map
- `app/api/webhooks/workos/route.ts` — verification webhook
- Tests: `lib/email/layout.test.ts`, `lib/email/escapeHtml.test.ts`,
  `app/api/webhooks/workos/route.test.ts`, updates to existing email tests.

Modified:
- `lib/email/teamInvite.ts`, `inquiryNotification.ts`,
  `inquiryClientConfirmation.ts`, `sendPasswordResetEmail.ts`, `notifications.ts`
- `app/[locale]/(auth)/_actions.ts` (inline reset email → shared template; resend
  verification fix)
- `.env.example` / env docs: `WORKOS_WEBHOOK_SECRET`

Deleted:
- `lib/email/resend.ts` (unused SDK import)
- per-file `escapeHtml`/`htmlEscape` copies

## Acceptance criteria
- One template renders all six app emails; no bespoke per-email HTML remains.
- Filled + outline CTA variants render correctly; buttons are tap-friendly at
  375px; color is never the sole signal.
- Light and dark (`prefers-color-scheme`) both legible.
- All six emails localized in en/fil/ms/id; locale from workspace country.
- `escapeHtml` exists once; user-supplied values still escaped (XSS preserved).
- WorkOS verification email arrives via our webhook + template; WorkOS default
  disabled; resend path works; webhook verifies signature on raw body and acks
  200 on handler failure.
- Google OAuth consent screen shows "Gallurio" (dashboard task done).
- Tests pass for template, escaping, webhook signature/handler, and each sender's
  key content. `pnpm typecheck` + `pnpm lint` pass.
- HTML rendered to file and screenshotted desktop + 375px (states: each email
  type, both CTA variants, light/dark) as verification artifact.

## Open items to verify during implementation
1. Does `workos.userManagement.sendVerificationEmail` re-emit
   `email_verification.created` after defaults are disabled, or must
   `resendVerificationEmailAction` call our render+send directly? (live check)
2. Exact WorkOS webhook signature scheme + header names (confirm against the
   `@workos-inc/node` `Webhooks` helper).
3. Confirm `email_verification.created` payload truly omits the `code` (Get-API
   round-trip mandatory) against a real event.

## Out of scope
- Booking-lifecycle emails (deferred per `docs/paddle-integration/...`).
- Marketing/broadcast email, unsubscribe center.
- Custom sending domain DNS setup (documented, not coded).
- MFA email take-over (not supported by WorkOS).
