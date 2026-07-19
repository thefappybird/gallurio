# Transactional Emails — Branded + Bilingual

Status: **complete, merge-approved** (branch `enhance/branded-transactional-emails`,
PR #39). This folder is the single source of truth for the email work; it
replaces the earlier scattered plan/spec/review docs.

For the living "how it works / how to add one" reference, see the skills:
- `.claude/skills/emails/SKILL.md` — email system
- `.claude/skills/notifications/SKILL.md` — in-app notifications

---

## What was built

A single hand-rolled, table-based, inline-styled HTML email template that renders
every transactional email in two brand contexts and (for partner→client mail)
two languages stacked behind a divider.

No email library was added (`@react-email`, `mjml`, the Resend SDK) — plain
`fetch` to Resend's HTTPS API, hand-written tables, hex tokens. Zero new runtime
deps.

### Core template (`lib/email/`)
- `layout.ts` — `renderBrandedEmail(opts)` builds `{ html, text }` from a brand,
  locale, preheader, title, `EmailBlock[]` (`p` / `heading` / `rows` / `spacer`
  / `divider`), and up to two CTAs. 600px card, header strip, body, charcoal
  footer, `@media (prefers-color-scheme: dark)` block.
  - `renderBilingualEmail({ brand, preheader, secondaryLocale, build })` — calls
    `build("en")` for the primary, and when `secondaryLocale !== "en"` stacks the
    localized copy under a labelled `divider` + heading. One English CTA by
    design.
  - `bilingualSubject(en, localized, locale)` → `en` when locale is `en` or the
    strings match, else `"<en> · <localized>"` (middot).
- `brand.ts` — `gallurioBrand()` (platform: teal `#0d8fa1`, no "Powered by"),
  `resolveWorkspaceBrand(ws)` (partner: workspace name/logo/accent, `HEX6`-
  validated, "Powered by Gallurio" footer), `ctaTextColor(hex)` (relative-
  luminance pick of `#ffffff`/`#1a1a1a` so CTAs stay readable on any accent).
- `messages.ts` — `EMAIL_COPY` map keyed `[emailType][locale]`, plain text only
  (the template escapes every interpolation). `emailLocale = localeForCountry`.
- `send.ts` — `sendEmail(input)`; Resend over `fetch`; **never throws**; no-key
  dev fallback logs and returns `{ ok: true, skipped: true }`; PII only logged in
  `NODE_ENV === "development"`.
- `escapeHtml.ts` — single shared escape boundary (`e()` in the template).
- Senders: `teamInvite.ts`, `inquiryNotification.ts`,
  `inquiryClientConfirmation.ts`, `sendPasswordResetEmail.ts`, `notifications.ts`,
  `booking/{bookingConfirmed,bookingCancelled,inquiryDecline}.ts`.

### Notifications (companion work)
- Actor-silent delivery: the user who triggered an event gets a pre-read, silent
  in-app record (no bell, no unread bump, no email); everyone else gets a loud
  notification. `lib/notifications/{send,types,messages,recipients}.ts`,
  `lib/db/models/Notification.ts`, `components/notifications/NotificationProvider.tsx`.
- WorkOS `email_verification.created` webhook takeover: `app/api/webhooks/workos/route.ts`
  (Node runtime, raw-body HMAC verify, ack 200 even on handler failure).

### Deep links (WorkOS migration fix)
Email CTAs (review/approve, team invite, etc.) now land on the right page and
open the right modal after sign-in:
- `lib/inquiries/links.ts` → `buildInquiryModalPath` (`/inquiries?inquiryId=…`);
  the dead Clerk `?redirect_url=` builder was removed.
- `proxy.ts` preserves the original path+query into a `returnTo` param and
  intercepts the WorkOS-hosted-auth redirect (`api.workos.com` / `*.authkit.app`)
  so the round-trip returns to the deep link instead of `/dashboard`.
- Verified end to end in `e2e/email-deep-links.spec.ts` (booking modal, inquiry
  modal, logged-out returnTo round-trip).

## Key decisions
- One template, two brands (platform Gallurio vs partner "Powered by Gallurio").
- Client-facing partner mail is bilingual (English primary + workspace locale);
  platform/owner mail stays English (`en`) — no reliable locale signal at send.
- Best-effort, post-transaction: email/notification failure never rolls back a DB
  write.
- Tenant isolation everywhere; client-supplied `workspaceId` never trusted.
- Locales `en` / `fil` / `id` / `th` (never `ms`); workspace country → locale.

## Env
- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` (optional), `NEXT_PUBLIC_APP_URL`
- `WORKOS_WEBHOOK_SECRET` (verification webhook)

## Review verdict
Whole-branch merge gate: **APPROVE FOR MERGE** — zero Critical/Important; single
escape boundary, `HEX6` accent defense-in-depth, uniform best-effort + concurrency
flags, consistent tenant scoping, brand routing correct, all four locales, dead
`resend.ts` removed.
