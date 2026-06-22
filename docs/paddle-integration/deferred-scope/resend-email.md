# Transactional Emails (Resend) — superseded

> **Status (2026-06-22): superseded.** This is now active work, designed in
> `docs/superpowers/specs/2026-06-22-branded-transactional-emails-design.md`.
>
> The earlier draft of this file described a **quote-negotiation back-and-forth**
> (quote / counter / requote / decline rounds, a client quote portal, and a
> `booking-quote` portal email). **Gallurio has no such flow** — first contact
> creates an inquiry; the owner approves it into a booking, cancels a booking, or
> declines/dismisses an inquiry. That negotiation content has been removed because
> nothing triggers it.

## What is actually built (see the spec for detail)

- One shared branded email template with **two brand contexts**: platform
  (Gallurio → owner/user) and partner (owner's business → clients/teammates,
  "Powered by Gallurio").
- Lifecycle emails at the real transitions: inquiry confirmation, **inquiry →
  booked** (client + owner), **booked → cancelled** (client + owner), and a new
  **inquiry decline** (client). Team members are notified in-app + email when an
  inquiry is approved onto their team and when a booking is cancelled.
- WorkOS email-verification taken over via a signed webhook so it uses our template.

## Notes (still accurate)

- Emails are **best-effort, post-transaction** — a send failure logs and continues;
  it never rolls back booking state.
- Resend env vars (`RESEND_API_KEY`, `EMAIL_FROM`, optional `EMAIL_REPLY_TO`) and
  the WorkOS webhook secret are tracked in `docs/RELEASE-CHECKLIST.md` (§4b, §4g).
