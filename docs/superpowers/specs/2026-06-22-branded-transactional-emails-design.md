# Branded Transactional Emails + Booking-Lifecycle Notifications — Design

**Date:** 2026-06-22
**Branch:** `enhance/branded-transactional-emails`
**Worktree:** `.claude/worktrees/branded-emails`

## Problem

Gallurio's outgoing emails are visually inconsistent and unbranded (each send site
hand-rolls inline HTML, black `#111` buttons, duplicated `escapeHtml`; only the
team-invite is translated). WorkOS sends auth mail on its own template. And the
booking lifecycle has **no email layer and incomplete notifications** — approving
an inquiry into a booking tells no one, and there is no client-facing email when a
booking is confirmed, cancelled, or an inquiry is declined.

Goal:
1. One shared, accessible, localized email template rendering **two brand
   contexts** — **platform** (Gallurio → owner/user) and **partner** (owner's
   business → their clients/teammates, co-branded "Powered by Gallurio").
2. The booking-lifecycle email + notification layer on top of the **existing**
   status transitions.

There is **no quote/negotiation back-and-forth** in Gallurio (first contact →
inquiry, then approve/decline/cancel). Any prior doc describing a quote
negotiation flow is obsolete and removed.

## Current state (evidence)

**Transport:** `lib/email/send.ts` — raw `fetch` to Resend (no SDK), `sendEmail()`
best-effort (never throws), dev fallback logs to console when `RESEND_API_KEY`
unset. Sender `EMAIL_FROM` (`Gallurio <onboarding@resend.dev>` default), optional
`EMAIL_REPLY_TO`. `escapeHtml` re-implemented per file. `lib/email/resend.ts` is an
unused SDK import.

| Existing email | Builder | Audience | i18n |
|---|---|---|---|
| Team invite | `lib/email/teamInvite.ts` | invitee (partner) | en/fil/ms/id |
| Inquiry notification | `lib/email/inquiryNotification.ts` | owner (platform) | en |
| Inquiry client confirmation | `lib/email/inquiryClientConfirmation.ts` | client (partner) | en |
| Password reset (2×) | `_actions.ts`, `sendPasswordResetEmail.ts` | user (platform) | en |
| Generic in-app notification | `lib/email/notifications.ts` | owner/member (platform) | en |

**WorkOS mail:** WorkOS sends exactly one email — the email-verification code
(signup / `resendVerificationEmailAction`). Password reset = WorkOS mints token,
Gallurio sends. Invites = fully Gallurio. MFA = TOTP (no email). Magic auth dormant.

**Booking transitions (already implemented):**
- `Booking.status`: `draft | booked | completed | cancelled`. Inquiry status:
  `new | booked | converted | archived`.
- inquiry submit → `draft` (`lib/server/inquirySubmission.ts`); emails owner +
  client today.
- **inquiry → booked**: `approveInquiryBookingAction` (`inquiries/_actions.ts:55`)
  promotes draft → booked, assigns a team. **Fires NO notification, sends no email.**
- **booked → cancelled** (+ restore): `applyStatusChange` in
  `booking-detail-modal.tsx:1105` → PATCH `app/api/bookings/[id]/route.ts`. The
  PATCH route **already fans `booking.status_changed` out to all team members +
  owner** (in-app + a *generic* email) — `route.ts:472–519`.
- inquiry dismiss: `archiveInquiryAction` → inquiry `archived` (silent, no email).
  **Bug:** it does not cancel the orphan `draft` booking (left as `draft`).

**Notification infra:** `sendNotification({ recipients[] , … })`
(`lib/notifications/send.ts`) already fans out in-app (socket + DB) **and** email
to every recipient, skipping the actor. The PATCH route resolves recipients via
`TeamMembership.find({teamId}) → User` (duplicated twice in `route.ts`).

**Owner branding (exists — partner branding feasible today):** business name
`Workspace.name`; logo `publicPage.header.logoUrl` (Cloudflare URL, usable in
`<img>`); accent `publicPage.brandKit.accentColor` (hex); contact
`Workspace.contact.{email,phone,socials}`. (Logo asset-id field naming is
inconsistent — `logoAssetId` model vs `logoPublicId` validator — verify; emails
use `logoUrl`.)

## Two brand contexts

One `Brand` passed into the template; only its source differs.

```
type Brand = {
  kind: 'platform' | 'partner';
  name: string;          // 'Gallurio'  |  workspace.name
  logoUrl?: string;      // /brand/email-mark.png  |  publicPage.header.logoUrl
  accentHex: string;     // '#0d8fa1'  |  brandKit.accentColor (fallback teal)
  replyTo?: string;      // support@gallurio.com  |  workspace.contact.email
  poweredByGallurio: boolean;
};
```
- **Platform** → fixed Gallurio brand (teal header, camera mark, support link).
- **Partner** → `resolveWorkspaceBrand(workspace)`: business name + uploaded logo
  (fallback: name text) + accent (fallback teal) + reply-to = owner contact +
  **"Powered by Gallurio"** footer. Partner header is a **neutral/light strip**;
  the accent is used **only on the CTA button** (button text color chosen by the
  accent's luminance) to avoid contrast math on arbitrary owner colors.

## Brand tokens (Gallurio platform — hex)

Light: bg `#f8f8f8`, text `#424242`, muted `#858a8f`, border `#e6e6e6`, teal
`#0d8fa1`. Dark (`prefers-color-scheme`): bg `#353535`, text `#eaeaea`, teal
`#2fb3d9`. Font stack `'Plus Jakarta Sans', system-ui, -apple-system, Segoe UI,
Roboto, sans-serif`.

**Logo (interim, supplied 2026-06-22):** camera glyph. `app/icon.svg` +
`app/favicon.ico` (Next.js auto-served); `public/brand/gallurio-{mark,wordmark}.svg`
sources; `public/brand/email-mark.png` (360×251 raster — emails can't render SVG).
Mark is dark `#4d4d4d` on transparent → can't sit on teal as-is; resolved at the
render step (light strip / white-mark variant). `LOGO_URL` defaults to
`${NEXT_PUBLIC_APP_URL}/brand/email-mark.png`; final-logo swap is one line.

## Architecture

1. **`lib/email/layout.ts`** — `renderBrandedEmail(opts): { html; text }`.
   Hand-rolled, table-based, 600px, inline styles, **no new dependency**. Header
   (brand-aware) · hidden preheader · body blocks (`p` / `heading` / `rows` /
   `spacer`) · CTAs (filled primary + optional outline secondary, bulletproof) ·
   divider · footer (platform: Gallurio minimal; partner: business name + "Powered
   by Gallurio"). `prefers-color-scheme: dark` block + dark-safe inline fallbacks.
   `opts = { brand, locale, preheader, title, subtitle?, blocks, cta?,
   secondaryCta?, supportLine? }`.
2. **`lib/email/escapeHtml.ts`** — one shared impl; delete per-file copies.
3. **`lib/email/brand.ts`** — `gallurioBrand()`, `resolveWorkspaceBrand(ws)`,
   accent→text-color luminance helper.
4. **`lib/email/messages.ts`** — per-email locale copy (en/fil/ms/id), keyed by
   email + locale (mirrors `teamInvite`'s inline map; keeps copy out of UI
   `messages/*.json`, avoids `getTranslations` coupling in best-effort senders).
   Locale from workspace country (`ph→fil, my→ms, id→id, else en`); webhook
   verification resolves the user's workspace country, else `en`.
5. **Refactor existing senders** onto `renderBrandedEmail` with the right `Brand`.
   Delete `lib/email/resend.ts`.
6. **`lib/notifications/recipients.ts`** — extract `resolveTeamRecipients(
   workspaceId, teamId)` (TeamMembership → User) from the duplicated PATCH-route
   logic; register in `REUSABLE_CODE.md` (DRY).
7. **WorkOS verification takeover** — `app/api/webhooks/workos/route.ts` (Node):
   raw-body HMAC verify (Paddle-style) → handle `email_verification.created` →
   Get-API for `code` → render (platform brand) → Resend. Ack 200 after verify
   even on send failure. Disable WorkOS default verification email (dashboard);
   fix `resendVerificationEmailAction`. Add `WORKOS_WEBHOOK_SECRET`.
8. **Dashboard config (no code; release checklist §4g):** WorkOS Branding (logo +
   colors) for un-takeover-able mail; **own Google OAuth credentials** (chooser
   shows "Gallurio"); optional custom sending domain.

## Notification delivery (actor-silent)

`sendNotification` currently **drops the actor** entirely
(`recipients.filter(r => r.workosUserId !== triggeredByWorkosUserId)`). Change it
so the actor still gets an in-app record, but **silently**:

- **Actor** → notification is inserted **pre-read / non-counting** (`read: true`
  + a `silent: true` flag on `Notification`) and is **not** delivered loud: no
  unread-badge increment and no bell animation. It either isn't socket-emitted or
  is emitted with `silent: true` so the client adds it to the list without
  animating/incrementing.
- **Everyone else** → unchanged loud path: `read: false`, `notification:new`
  socket emit → bell animation + unread counter.
- Applies to **all** notification types (single chokepoint), not just booking.
- **Email** is unchanged from the decisions below and continues to **skip the
  actor** (no self-email); client emails always send (a client is never the actor).

Touches: `Notification` model (`silent` flag), `lib/notifications/send.ts`
(stop excluding the actor; branch loud vs silent), and the client bell/unread
logic (ignore `silent`/already-read items for the animation + counter).

## Booking-lifecycle layer (emails + notifications)

Hooked best-effort, post-transaction (never roll back on failure), recipient-guarded.

- **inquiry → booked** (`approveInquiryBookingAction`):
  - NEW: fan a `booking.team_assigned` notification out to **all members of the
    assigned team** (in-app + email) via `resolveTeamRecipients` — closes the
    "team isn't told" gap.
  - NEW email: **booking confirmed → client** (partner) + **→ owner** (platform).
- **booked → cancelled** (PATCH route):
  - Team + owner already get the `booking.status_changed` notification — **enrich
    that email to be status-aware** (cancelled vs other) instead of the generic body.
  - NEW email: **booking cancelled → client** (partner) + **→ owner** (platform,
    in addition to the in-app notification).
- **inquiry decline (NEW action `declineInquiryAction`)**: sets inquiry `archived`
  + **cancels the orphan draft booking** + sends **client a polite decline email**
  (partner). The existing silent `archiveInquiryAction` (dismiss) stays for
  spam/junk (no email) but is **fixed to also cancel the orphan draft booking**.
- Client name/email resolved from the booking's `Client`; skip if no client email.

## Email + notification inventory (target)

| Event | Email(s) | In-app notification |
|---|---|---|
| Email verification | platform → user (webhook) | — |
| Password reset / set-password | platform → user | — |
| Inquiry submitted | platform → owner; partner → client (confirmation) | existing `inquiry.created` |
| **Inquiry → booked** | partner → client; platform → owner | **NEW: team fan-out** (`booking.team_assigned`) |
| **Booked → cancelled** | partner → client; platform → owner | existing team+owner fan-out (email enriched) |
| **Inquiry declined** (new action) | partner → client (decline) | — |
| Inquiry dismissed (existing) | none (silent) | — |
| Team / member invite | partner → invitee | existing `team.invitation` |

## Excluded
Quote/negotiation emails (no negotiation flow exists in Gallurio). Booking
"completed" client email (not requested). Marketing/broadcast, unsubscribe center.
Custom sending-domain DNS (documented, not coded). MFA email take-over (WorkOS
doesn't support it).

## Files
New: `lib/email/{layout,escapeHtml,brand,messages}.ts`, `lib/email/booking/*`
(confirmed/cancelled/decline senders), `lib/notifications/recipients.ts`,
`app/api/webhooks/workos/route.ts`, `declineInquiryAction` in
`inquiries/_actions.ts`, tests alongside each.
Modified: existing email builders; `app/[locale]/(auth)/_actions.ts`;
`app/[locale]/(app)/inquiries/_actions.ts` (approve notification + decline +
archive orphan fix); `app/api/bookings/[id]/route.ts` (status-aware email + client
cancel email, using the extracted recipients helper); `lib/notifications/send.ts`
(actor-silent delivery); `lib/db/models/Notification.ts` (`silent` flag); the
client notification bell/unread component (ignore silent/read items for animation
+ counter); `.env.example`; `REUSABLE_CODE.md`.
Deleted: `lib/email/resend.ts`; per-file `escapeHtml`; obsolete quote-negotiation
content in `docs/paddle-integration/deferred-scope/resend-email.md`.

## Acceptance criteria
- One template renders every email in both brand contexts; partner mail shows
  owner logo/name (+ fallbacks) + "Powered by Gallurio"; platform mail = Gallurio.
- Lifecycle emails fire at the right transitions, best-effort, recipient-guarded.
- Approve fans the notification out to all assigned-team members; cancellation
  continues to; decline emails the client and cancels the orphan draft.
- The actor gets a silent in-app record (no bell animation, no unread-count bump);
  every other recipient gets the loud notification. Actor is not self-emailed.
- CTA variants render; partner CTA text readable on any accent (luminance); 375px
  tap-friendly; color never the sole signal; light + dark legible; all locales.
- `escapeHtml` once; XSS escaping preserved. WorkOS verification via our
  webhook+template; default disabled; resend works; raw-body signature verified;
  acks 200 on handler failure. Google chooser shows "Gallurio".
- Tests pass (template both brands, escaping, brand resolver, `resolveTeamRecipients`,
  webhook, each sender, lifecycle triggers + notification fan-out). `pnpm
  typecheck` + `pnpm lint` pass. HTML render + screenshot desktop & 375px (each
  email, both brands, both CTAs, light/dark) as artifact.

## Open items to verify during implementation
1. `sendVerificationEmail` re-emits `email_verification.created` after defaults
   disabled, or must `resendVerificationEmailAction` render+send directly? (live)
2. Exact WorkOS webhook signature scheme + headers (`@workos-inc/node` `Webhooks`).
3. `email_verification.created` payload omits `code` (Get-API round-trip). (live)
4. Logo asset field naming `logoAssetId` vs `logoPublicId` (emails use `logoUrl`).
5. Whether `approveInquiryBookingAction` always assigns a team at approval (if a
   booking can be approved team-less, fall back to notifying the owner).
