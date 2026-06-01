# Deferred: Transactional Emails (Resend)

## What it is

Transactional emails for the booking inquiry and quote negotiation lifecycle, sent via **Resend**. Resend is already a dependency in the project — it is used today for data export emails. This task wires up the remaining booking-lifecycle templates.

## Why it's deferred

Email templates depend on the quote negotiation workflow (see `quote-negotiation.md`). The booking-confirmed and booking-declined templates also depend on the booking model changes in that task. There is no point building the email layer before the underlying workflow exists.

---

## Templates

| Template key | Trigger | Recipient |
|---|---|---|
| `inquiry-new` | Client submits inquiry form | Owner (at `publicPage.inquiryRecipientEmail` or `workspace.contact.email`) |
| `booking-quote` | Owner sends a quote | Client (at `inquiry.email`) |
| `booking-confirmed-owner` | Client confirms (any round) | Owner |
| `booking-confirmed-client` | Owner accepts client's counter | Client |
| `booking-countered-owner` | Client submits a counter offer | Owner |
| `booking-requote` | Owner sends a re-quote | Client |
| `booking-declined` | Owner declines | Client |

---

## `booking-quote` — the most important template

This email is the entry point into the portal. It must include:
- Event details (date, time, location, type)
- Quote details (description, total, deposit, payment terms, owner's note)
- Two CTAs (rendered as styled `<a>` buttons):
  - **[Confirm Booking]** → `GET /api/bookings/respond?token=booking-client-{id}-r{n}&action=confirm`
  - **[Make Counter Offer]** → `https://[domain]/w/[orgSlug]/quote/{bookingId}?token=booking-client-{id}-r{n}`

The confirm CTA is a direct API link — clicking it requires no page load. The counter CTA opens the client portal (see `client-portal.md`).

---

## Setup steps

### 1. Resend account and sender domain

1. Sign up at [resend.com](https://resend.com).
2. **Domains** → Add your domain (e.g. `mail.gallurio.com`). Add the three DNS records Resend generates (SPF, DKIM, DMARC).
3. **API keys** → Create a key → copy to `RESEND_API_KEY`.
4. Set `RESEND_FROM_EMAIL=noreply@mail.gallurio.com` (or whichever verified address).

### 2. Env vars to add

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@mail.gallurio.com
```

Both already appear in the release checklist under §8b. Verify they are set in the Vercel project before going live.

### 3. Template location

Email templates live in `lib/email/templates/` as React components (using `@react-email/components` or plain HTML strings). The send helper at `lib/email/send.ts` wraps the Resend client:

```typescript
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ to, subject, react }: SendEmailOptions) {
  await resend.emails.send({ from: process.env.RESEND_FROM_EMAIL!, to, subject, react });
}
```

### 4. Files to create

| File | Purpose |
|---|---|
| `lib/email/send.ts` | Resend client + `sendEmail` helper |
| `lib/email/templates/inquiry-new.tsx` | Owner notification on new inquiry |
| `lib/email/templates/booking-quote.tsx` | Quote email to client with CTAs |
| `lib/email/templates/booking-confirmed-owner.tsx` | Owner confirmation |
| `lib/email/templates/booking-confirmed-client.tsx` | Client confirmation (after owner accepts counter) |
| `lib/email/templates/booking-countered-owner.tsx` | Owner notification of counter offer |
| `lib/email/templates/booking-requote.tsx` | Client re-quote notification |
| `lib/email/templates/booking-declined.tsx` | Client decline notification |

---

## Notes

- Emails are sent as **best-effort post-transaction** (not inside the Mongo session). If the email send fails, log and continue — do not roll back the booking state.
- The `inquiry-new` email already has an informal implementation in the inquiry route. Migrate it to the proper template system when this task lands.
- All templates must respect the workspace's language (derive from `localeForCountry(workspace.country)` — use `getTranslations()` server-side to pick the right message catalog if multi-locale templates are desired, or ship English-only for MVP).
- The `RESEND_API_KEY` and `RESEND_FROM_EMAIL` vars already appear in `docs/RELEASE-CHECKLIST.md` §8b — no new checklist items needed.
