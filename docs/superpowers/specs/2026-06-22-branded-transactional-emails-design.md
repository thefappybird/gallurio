# Branded Transactional Emails — Design

**Date:** 2026-06-22
**Branch:** `enhance/branded-transactional-emails`
**Worktree:** `.claude/worktrees/branded-emails`

## Problem

Gallurio's outgoing emails are visually inconsistent and unbranded. Each send
site hand-rolls its own inline HTML (black `#111` buttons, ad-hoc widths,
duplicated `escapeHtml`), and only the team-invite is translated. Auth emails
sent by WorkOS use WorkOS's own template, so mail does not look like it comes
from one product. And there is no booking-lifecycle email layer at all.

Goal: one shared, accessible, localized email template that renders **two brand
contexts**, plus the full booking-lifecycle email set:

- **Platform emails** (Gallurio → the workspace owner/user): auth, owner
  notifications, in-app notifications. **Gallurio-branded.**
- **Partner emails** (the owner's business → their end-clients or invited
  teammates): inquiry/booking-lifecycle mail and team invites. Branded with the
  **owner's logo + business name**, co-branded **"Powered by Gallurio"**.

## Current state (evidence)

Transport: `lib/email/send.ts` — raw `fetch` to `https://api.resend.com/emails`
(no SDK), `sendEmail()` helper, best-effort (never throws), dev fallback logs to
console when `RESEND_API_KEY` unset. Sender from `EMAIL_FROM`
(`Gallurio <onboarding@resend.dev>` default), optional `EMAIL_REPLY_TO`.

Existing send sites, all inline HTML strings, no shared wrapper:

| Email | Builder | Audience | i18n |
|---|---|---|---|
| Team invite | `lib/email/teamInvite.ts` | invitee (partner) | en/fil/ms/id (inline map) |
| Inquiry owner notification | `lib/email/inquiryNotification.ts` | owner (platform) | en only |
| Inquiry client confirmation | `lib/email/inquiryClientConfirmation.ts` | client (partner) | en only |
| Password reset (forgot) | `app/[locale]/(auth)/_actions.ts:~411` (inline) | user (platform) | en only |
| Password reset / set-password | `lib/email/sendPasswordResetEmail.ts` | user (platform) | en only |
| Generic in-app notification | `lib/email/notifications.ts` | owner/member (platform) | en only |

`escapeHtml`/`htmlEscape` is re-implemented per file. `lib/email/resend.ts`
imports the unused SDK.

**WorkOS email reality** (verified against WorkOS docs + code):
- WorkOS sends exactly one email today: the email-verification code at signup /
  via `resendVerificationEmailAction` (`workos.userManagement.sendVerificationEmail`).
- Password reset: WorkOS mints the token only; Gallurio sends via Resend.
- Team/org invites: fully Gallurio (own `Invitation` model + Resend).
- MFA: TOTP authenticator app — no email. Magic auth: dormant.

**Booking lifecycle** (`Booking.status`: `draft | booked | completed | cancelled`):
- inquiry submit → `draft` (`lib/server/inquirySubmission.ts`); already emails
  owner (notification) + client (confirmation).
- `approveInquiryBookingAction` (`app/[locale]/(app)/inquiries/_actions.ts:118`)
  draft → `booked`. **No email today.**
- PATCH `app/api/bookings/[id]/route.ts:396` → `completed` / `cancelled`; fires a
  `booking.status_changed` in-app notification (generic email only, not
  domain-aware).
- `archiveInquiryAction` cancels a draft booking. The **quote-negotiation** emails
  in `docs/paddle-integration/deferred-scope/resend-email.md` (quote / counter /
  requote / declined) have **no trigger in code** — there is no quote workflow,
  and CLAUDE.md states none is in MVP. They are **excluded** here (see Excluded).

**Owner branding model** (all fields exist — partner branding is feasible today):
- Business name: `Workspace.name`.
- Logo: `Workspace.publicPage.header.logoUrl` (Cloudflare-hosted full URL — usable
  directly in an email `<img>`). Asset id field naming is inconsistent in the
  model (`logoAssetId`) vs the validator/types (`logoPublicId`) — **verify during
  impl**; emails only need `logoUrl`.
- Accent color: `Workspace.publicPage.brandKit.accentColor` (6-digit hex).
- Contact: `Workspace.contact.{email,phone,address,socials}`.

## Two brand contexts

A single `Brand` object is passed into the template; only its source differs.

```
type Brand = {
  kind: 'platform' | 'partner';
  name: string;          // 'Gallurio'  |  workspace.name
  logoUrl?: string;      // /brand/email-mark.png  |  publicPage.header.logoUrl
  accentHex: string;     // '#0d8fa1'  |  brandKit.accentColor (fallback teal)
  replyTo?: string;      // support@gallurio.com  |  workspace.contact.email
  poweredByGallurio: boolean; // false | true
}
```

- **Platform** → fixed Gallurio brand (teal, camera mark, support link).
- **Partner** → `resolveWorkspaceBrand(workspace)`: business name + uploaded logo
  (fallback: business-name text if `logoUrl` empty) + accent (fallback Gallurio
  teal if empty) + reply-to = owner contact email + **"Powered by Gallurio"**
  footer linking to the marketing site.

Partner header is a **light/neutral strip** (owner logo + business name), and the
accent color is used **only for the CTA button** — this avoids doing contrast math
on an arbitrary owner-chosen header background. Button text color is chosen from
the accent's luminance (one small helper) so a light accent still yields readable
text. Gallurio platform emails keep the teal header treatment.

## Brand tokens (Gallurio platform — hex; no CSS vars/Tailwind in mail)

Light: bg `#f8f8f8`, text `#424242`, muted `#858a8f`, border `#e6e6e6`, teal
`#0d8fa1` (white text on teal). Dark (`prefers-color-scheme: dark`): bg `#353535`,
text `#eaeaea`, teal `#2fb3d9`. Font stack: `'Plus Jakarta Sans', system-ui,
-apple-system, Segoe UI, Roboto, sans-serif`.

**Logo (interim assets supplied 2026-06-22):** brand mark is a camera glyph.
- `app/icon.svg` + `app/favicon.ico` — app favicon/icon (Next.js auto-served).
- `public/brand/gallurio-mark.svg`, `public/brand/gallurio-wordmark.svg` — sources.
- `public/brand/email-mark.png` (360×251 raster) — emails can't render SVG. The
  mark is **dark `#4d4d4d` on transparent**, so it can't sit on the teal band
  as-is; resolved at the render step (light strip or white-mark variant). Header
  pairs the mark with styled **"Gallurio"** text. Placeholders; final logo swap is
  a one-line `LOGO_URL` change.

## Target architecture

### 1. Shared template — `lib/email/layout.ts`
Export `renderBrandedEmail(opts): { html; text }`. Hand-rolled, table-based, 600px
max width, fully inline styles. **No new dependency** (no `@react-email`).

- **Header**: brand logo (or wordmark text) + business name; right = title +
  optional subtitle. Treatment depends on `brand.kind`.
- **Preheader** hidden preview text.
- **Body**: ordered blocks — paragraphs, optional section heading, optional
  key/value rows (booking/inquiry details), CTA(s).
- **CTAs**: `primary` (filled, brand accent) + optional `secondary` (outline).
  Bulletproof button markup.
- **Divider** + optional support line.
- **Footer**: platform → Gallurio wordmark, tagline "Bookings, simplified.",
  `support@gallurio.com`, `© <year> Gallurio. All rights reserved.` (minimal — no
  address/social/unsubscribe). Partner → owner business name + **"Powered by
  Gallurio"** link.

```
opts = { brand: Brand, locale, preheader, title, subtitle?,
         blocks: Array<{ type:'p'|'heading'|'rows'|'spacer', ... }>,
         cta?: { label, url }, secondaryCta?: { label, url }, supportLine? }
```
Returns matching plain-text `text`.

### 2. Shared `escapeHtml` — `lib/email/escapeHtml.ts`
One implementation; delete per-file copies.

### 3. Brand resolver — `lib/email/brand.ts`
`gallurioBrand()` and `resolveWorkspaceBrand(workspace)` returning `Brand`, plus
the accent→text-color luminance helper.

### 4. Refactor existing senders
Each builder calls `renderBrandedEmail` with the right `Brand`. Owner-facing →
platform brand; client/invitee-facing → partner brand. `lib/email/resend.ts`
deleted.

### 5. i18n all emails — `en/fil/ms/id`
Dedicated `lib/email/messages.ts` map keyed by email + locale (mirrors the
`teamInvite` inline-map pattern; keeps email copy out of UI `messages/*.json` and
avoids `getTranslations` coupling in best-effort senders). Locale from workspace
country (`ph→fil, my→ms, id→id, else en`). Auth emails with no request locale
(webhook verification) resolve the user's workspace country, else `en`.

### 6. Booking-lifecycle senders (new) — `lib/email/booking/*`
Best-effort, post-transaction (never roll back on mail failure), mirroring the
inquiry-email pattern:
- `bookingConfirmedClient` (partner) + `bookingConfirmedOwner` (platform) — hook
  after `approveInquiryBookingAction` commits.
- `bookingCompletedClient` (partner, thank-you) — hook at PATCH → `completed`.
- `bookingCancelledClient` (partner) — hook at PATCH → `cancelled` / archive.
  (Owner already gets the in-app `booking.status_changed` notification; enrich
  that generic email to be status-aware rather than adding a second owner email.)
- Client email + name resolved from the booking's `Client`; recipient guarded
  (skip if no client email).

### 7. WorkOS verification takeover — event-driven custom email
- New `app/api/webhooks/workos/route.ts`, **Node runtime**. Verify the WorkOS
  signature against the **raw body** (HMAC + timestamp tolerance) before parsing —
  same raw-body discipline as Paddle.
- Handle `email_verification.created` (payload carries only `id`): call **Get
  Email Verification** for the `code`, render via `renderBrandedEmail` (platform
  brand), send via Resend. Ack 200 after signature verify even on send failure
  (log/dead-letter; never 500 into WorkOS retries).
- **Disable WorkOS default verification email** (dashboard) so users don't get two.
- Fix `resendVerificationEmailAction` so it still triggers our send once defaults
  are off (re-emit event vs direct render+send — **verify live**).
- `WORKOS_WEBHOOK_SECRET` env var added.

### 8. Dashboard / external config (no code; documented + release checklist §4g)
- **WorkOS Branding** (logo + 4 colors) for WorkOS-composed mail we can't take over.
- **Own Google OAuth credentials** so the Google chooser shows "Gallurio".
- **Optional** custom sending domain via Resend/WorkOS — DNS only.

## Email inventory (target)

| Email | Brand | Recipient | Trigger | State |
|---|---|---|---|---|
| Email verification | platform | user | WorkOS webhook | new (takeover) |
| Password reset / set-password | platform | user | forgot/set-password actions | refactor |
| Inquiry notification | platform | owner | inquiry submit | refactor |
| In-app notification (incl. status-aware booking.status_changed) | platform | owner/member | notification create | refactor + enrich |
| Booking confirmed (owner) | platform | owner | approve → booked | new |
| Inquiry confirmation | partner | client | inquiry submit | refactor + i18n |
| Booking confirmed (client) | partner | client | approve → booked | new |
| Booking completed (client) | partner | client | PATCH → completed | new |
| Booking cancelled (client) | partner | client | PATCH → cancelled / archive | new (confirm desired) |
| Team / member invite | partner | invitee | inviteMemberAction | refactor |

## Excluded (with reason)
- **Quote-negotiation emails** (quote / counter / requote / declined from the
  deferred doc): no quote-negotiation workflow exists in code or MVP, so there is
  no trigger to hook. Build the workflow first; the template already supports them.
- Marketing/broadcast email, unsubscribe center.
- Custom sending-domain DNS setup (documented, not coded).
- MFA email take-over (not supported by WorkOS).

## Files

New: `lib/email/layout.ts`, `lib/email/escapeHtml.ts`, `lib/email/brand.ts`,
`lib/email/messages.ts`, `lib/email/booking/*` (lifecycle senders),
`app/api/webhooks/workos/route.ts`. Tests alongside each.

Modified: `lib/email/teamInvite.ts`, `inquiryNotification.ts`,
`inquiryClientConfirmation.ts`, `sendPasswordResetEmail.ts`, `notifications.ts`;
`app/[locale]/(auth)/_actions.ts` (reset email + resend-verification fix);
`app/[locale]/(app)/inquiries/_actions.ts` and `app/api/bookings/[id]/route.ts`
(lifecycle hooks); `.env.example` (`WORKOS_WEBHOOK_SECRET`).

Deleted: `lib/email/resend.ts`; per-file `escapeHtml` copies.

## Acceptance criteria
- One template renders every email in both brand contexts; no bespoke per-email
  HTML remains. Partner emails show the owner's logo/name (fallbacks when absent)
  + "Powered by Gallurio"; platform emails show Gallurio branding.
- Booking-lifecycle emails fire at the correct transitions, best-effort
  (never roll back), recipient-guarded.
- Filled + outline CTA variants render; partner CTA text stays readable on any
  owner accent (luminance check); tap-friendly at 375px; color never the sole signal.
- Light + dark both legible. All emails localized en/fil/ms/id (workspace country).
- `escapeHtml` exists once; user-supplied values escaped (XSS preserved).
- WorkOS verification arrives via our webhook+template; default disabled; resend
  works; webhook verifies raw-body signature and acks 200 on handler failure.
- Google OAuth chooser shows "Gallurio" (dashboard task).
- Tests pass for template (both brands), escaping, brand resolver, webhook, each
  sender, and lifecycle triggers. `pnpm typecheck` + `pnpm lint` pass.
- HTML rendered to file + screenshot desktop & 375px (each email, both brands,
  both CTA variants, light/dark) as verification artifact.

## Open items to verify during implementation
1. `sendVerificationEmail` re-emits `email_verification.created` after defaults
   disabled, or must `resendVerificationEmailAction` render+send directly? (live)
2. Exact WorkOS webhook signature scheme + headers (`@workos-inc/node` `Webhooks`).
3. `email_verification.created` payload omits `code` (Get-API round-trip). (live)
4. Logo asset field naming: `logoAssetId` (model) vs `logoPublicId` (validator/
   types) — confirm which persists; emails use `logoUrl` regardless.
5. Confirm whether owners want an auto **cancelled-to-client** email or whether
   that should be gated by a preference.
