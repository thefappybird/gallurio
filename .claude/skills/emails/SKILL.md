---
name: emails
description: How Gallurio sends transactional email — the shared branded template, the two brand contexts (platform vs partner), bilingual rendering, locales, styling tokens, the Resend transport, and every send trigger. Use when adding, editing, or debugging any email, or when touching lib/email/*.
---

# Emails

Gallurio sends transactional email through **one** hand-rolled, table-based,
inline-styled HTML template. No email library (no `@react-email`, `mjml`, or the
Resend SDK) — plain `fetch` to Resend's HTTPS API. All code lives in `lib/email/`.

## The flow (how an email is sent)

1. A sender module (e.g. `lib/email/teamInvite.ts`) builds `{ html, text }` via
   `renderBilingualEmail()` or `renderBrandedEmail()` and a subject via
   `bilingualSubject()`.
2. It calls `sendEmail({ to, subject, html, text, replyTo })` from
   `lib/email/send.ts`.
3. `sendEmail` POSTs to `https://api.resend.com/emails` with `Bearer
   RESEND_API_KEY`. It **never throws**:
   - returns `{ ok: true, id }` on success,
   - `{ ok: false, error }` on a Resend/transport error (logged, not thrown),
   - `{ ok: true, id: null, skipped: true }` when `RESEND_API_KEY` is unset (dev
     fallback — logs the message instead of sending).
4. Call sites treat email as **best-effort, post-transaction**: send *after* the
   DB write commits and swallow failures (`.catch(() => {})`). A mail failure must
   never roll back booking/inquiry state.

Env: `RESEND_API_KEY`, `EMAIL_FROM` (defaults to `Gallurio <onboarding@resend.dev>`),
`EMAIL_REPLY_TO` (optional global override). Server-only (`import "server-only"`),
Node runtime. PII (full body) is logged only when `NODE_ENV === "development"`.

## Two brand contexts (`lib/email/brand.ts`)

Every email is either **platform** or **partner**:

- `gallurioBrand()` → platform. Gallurio name, teal accent `#0d8fa1`, teal header
  strip, support footer (`support@gallurio.com`), **no** "Powered by". Used for
  owner/platform mail (inquiry owner notification, booking-owner mail, password
  reset, email verification).
- `resolveWorkspaceBrand(ws)` → partner. Workspace `name`, optional `logoUrl`
  (`publicPage.header.logoUrl`), accent from `publicPage.brandKit.accentColor`
  (validated by `HEX6 = /^#[0-9a-fA-F]{6}$/`, falls back to teal), `replyTo` from
  `contact.email`, **"Powered by Gallurio"** footer. Used for client-facing mail.
- `ctaTextColor(hex)` picks `#ffffff` or `#1a1a1a` by relative luminance so the
  CTA label stays readable on any accent. Never hardcode CTA text color.

The `Brand` type: `{ kind: "platform" | "partner"; name; logoUrl?; accentHex;
replyTo?; poweredByGallurio }`.

## Styling (`lib/email/layout.ts`)

`renderBrandedEmail(opts): { html, text }` where `opts` is:
`{ brand, locale, preheader, title, subtitle?, blocks, cta?, secondaryCta?, supportLine? }`.

- **Layout:** 600px centered card on an off-white body (`#f8f8f8`), header strip
  (teal for platform / white with a 3px accent bottom-border for partner), body,
  charcoal footer (`#353535`). Tables + inline styles only (email-client safe).
- **Blocks** (`EmailBlock[]`): `{ type: "p" }`, `{ type: "heading" }`,
  `{ type: "rows", rows: [{label, value}] }`, `{ type: "spacer" }`,
  `{ type: "divider", label? }`. Add new content as blocks, not raw HTML.
- **CTAs:** bulletproof table-button, `min-height:44px` (tap-friendly at 375px).
  `cta` is primary (accent fill), `secondaryCta` is outlined.
- **Color tokens** (light): bg `#f8f8f8`, text `#424242`, border `#e6e6e6`,
  footer `#353535`, card `#ffffff`. (dark, via `@media (prefers-color-scheme:
  dark)`): bg/footer `#353535`, card `#2a2a2a`, text `#eaeaea`, border `#4a4a4a`,
  links/teal `#2fb3d9`. Use the named consts in `layout.ts`; do not invent hexes.
- **Escaping:** every interpolated value goes through `e()` → `escapeHtml`. This
  is the single XSS boundary. `EMAIL_COPY` is plain text and must never contain
  HTML — the template escapes it.
- Dark-mode swaps are driven by the `email-body`/`email-card`/`email-text`/
  `email-label`/`email-footer`/`email-divider` classes; keep them on new markup.

## Bilingual (client-facing mail)

`renderBilingualEmail({ brand, preheader, secondaryLocale, build })`:
- `build(locale)` returns `LocaleContent` (`{ title, subtitle?, blocks, cta?,
  secondaryCta?, supportLine? }`).
- Primary is always `build("en")`. If `secondaryLocale === "en"` it renders once.
  Otherwise it stacks the localized copy under a `{ type: "divider", label:
  LANGUAGE_NAME[secondaryLocale] }` + a heading of the secondary title.
- The single action **CTA stays English** by design (`// ponytail:` in source).
  Re-localize per-section only if a real need appears.
- Subject: `bilingualSubject(enSubject, localizedSubject, locale)` →
  `"<en> · <localized>"` (middot), or just `en` when locale is `en`.

`LANGUAGE_NAME`: `en→English, fil→Filipino, ms→Bahasa Melayu, id→Bahasa Indonesia`.

## Locales (`lib/email/messages.ts`)

- Locales: `en`, `fil`, `ms`, `id`. **Never `th`.**
- `emailLocale = localeForCountry` maps workspace country → locale (the
  `secondaryLocale` for client mail).
- `EMAIL_COPY[emailType][locale]` holds all copy as **plain text** (functions for
  interpolated strings, e.g. `subject(ws)`, `greeting(name)`). The `build(loc)`
  callback selects `EMAIL_COPY[key][loc]`.
- When you add/change copy, update **all four** locales together.

## When emails are sent (triggers → sender)

| Trigger | Sender | Brand | Bilingual |
|---|---|---|---|
| Team invite | `teamInvite.ts` | partner | yes |
| Inquiry submitted → client | `inquiryClientConfirmation.ts` | partner | yes |
| Inquiry submitted → owner | `inquiryNotification.ts` | platform | en |
| Booking confirmed → client | `booking/bookingConfirmed.ts` | partner | yes |
| Booking cancelled → client | `booking/bookingCancelled.ts` | partner | yes |
| Inquiry declined → client | `booking/inquiryDecline.ts` | partner | yes |
| Password reset | `sendPasswordResetEmail.ts` | platform | en |
| Generic in-app notification | `notifications.ts` (`sendNotificationEmail`) | platform | en |
| Email verification (WorkOS webhook) | `app/api/webhooks/workos/route.ts` | platform | en |

Actor-silent rule: the user who triggered an event does **not** get the
notification email (see the notifications skill).

## Adding a new email — checklist

1. Add copy to `EMAIL_COPY` in `messages.ts` for **all four** locales (plain text).
2. Write a sender in `lib/email/` that resolves a brand, builds `LocaleContent`
   via a `build(loc)` callback, calls `renderBilingualEmail`/`renderBrandedEmail`
   and `bilingualSubject`, then `sendEmail`.
3. Call it **after** the DB transaction commits, best-effort (`.catch`).
4. Never name the auth provider ("WorkOS") in user-facing copy.
5. Add a test (senders have `*.test.ts` peers); confirm `pnpm typecheck`/`pnpm lint`.
6. Verify render at 375px and in light + dark (`scripts/render-emails.ts` harness).
