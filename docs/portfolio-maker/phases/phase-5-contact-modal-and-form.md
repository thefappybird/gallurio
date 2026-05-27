# Phase 5 — Contact modal + fixed two-tab inquiry form

> Parent: `../master-plan.md`
> Branch: `feat/page-builder-contact-modal` cut from `dev` (post-Phase-4).
> Implements the third "page" — the prebuilt contact modal that opens from any portfolio CTA.

---

## Context

The locked product scope is: Contact is **not a configurable page** — it's a prebuilt modal launched by any CTA (`HeroBlock`, `CTABannerBlock`, `PortfolioHeader`'s Contact button). The form is fixed: two tabs.

1. **Client info** — name, email, phone, preferred contact method.
2. **Booking request** — calendar date picker, time, duration, event type, guest count, location, description.

Submissions in Phase 5 hit a stub API that records the payload to the browser console (or a no-op endpoint). The real `POST /api/inquiries` + draft-booking creation lands in Phase 6 — separating the UI from the API surface keeps Phase 5 focused and reviewable.

---

## Acceptance criteria

- `ContactModal.tsx` (client component) mounted once in `app/(public)/w/[orgSlug]/layout.tsx`. Exposes `window.__gallurioOpenContact()` to open from anywhere in the public subtree.
- Modal traps focus, closes on `Esc`, closes on backdrop click, restores scroll, restores focus to the trigger element.
- Two tabs implemented with shadcn `Tabs` primitive. Tab order: Client info → Booking request.
- Calendar date picker uses an existing project component (likely `react-day-picker` or shadcn's `Calendar` if already added). If neither is installed, install `react-day-picker` — already commonly used in the Gallurio booking module so check first.
- All form fields validated with a Zod schema (`inquirySubmissionSchema`) shared between client (`react-hook-form` + `zodResolver`) and server (Phase 6 API).
- Honeypot field (`<input name="company_name" tabIndex={-1} aria-hidden />`) included.
- Submit button disabled while submitting; shows spinner; on success swaps modal content to a "Thanks, we'll be in touch" confirmation panel.
- Mobile (375px) fits without page scroll: modal is full-screen on mobile, centered card on ≥640px.
- Keyboard-accessible: every field reachable by Tab, errors announced via `aria-live="polite"`.
- Header "Contact" button (added in Phase 4) and any block CTA with `ctaAction === "open-contact"` correctly opens the modal.
- Tests:
  - `inquirySubmissionSchema.test.ts` — rejects invalid email, missing required fields, past dates, future dates beyond a reasonable horizon (e.g. >5 years).
  - `ContactModal.test.tsx` — opens via global handler, traps focus, tab switch works, honeypot field hidden, submit calls `onSubmit` with normalized payload.
- `pnpm test --run public/w/contact public/w/_components/ContactModal validators/inquiry` passes.

---

## Form schema

```ts
// lib/validators/inquiry.ts
import { z } from "zod";

export const PREFERRED_CONTACT_METHODS = ["email", "phone", "either"] as const;
export const EVENT_TYPES = [
  "wedding",
  "engagement",
  "corporate",
  "birthday",
  "anniversary",
  "graduation",
  "other",
] as const;

export const inquirySubmissionSchema = z.object({
  // Tab 1
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().trim().toLowerCase(),
  phone: z.string().trim().min(7).max(30).optional().or(z.literal("")),
  preferredContact: z.enum(PREFERRED_CONTACT_METHODS).default("email"),

  // Tab 2
  eventDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  eventTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  eventDuration: z.coerce.number().min(0.5).max(72).optional(),
  eventType: z.enum(EVENT_TYPES),
  guestCount: z.coerce.number().int().min(0).max(10000).optional(),
  location: z.string().max(200).optional().or(z.literal("")),
  description: z.string().min(10).max(2000),

  // Anti-bot
  company_name: z.literal("").optional(),  // honeypot — must be empty

  // Tracking (passed by client from URL/document.referrer)
  utm_source: z.string().max(120).optional(),
  utm_medium: z.string().max(120).optional(),
  utm_campaign: z.string().max(120).optional(),
  referrer: z.string().max(500).optional(),
});

export type InquirySubmissionInput = z.infer<typeof inquirySubmissionSchema>;
```

UTM and referrer are read from `window.location.search` and `document.referrer` and attached to the submission automatically. No user-facing field.

---

## File map

```
app/(public)/w/[orgSlug]/
  layout.tsx                              # mount <ContactModal /> + window.__gallurioOpenContact
  _components/
    ContactModal.tsx                      # client component
    ContactModal.test.tsx
    ContactForm.tsx                       # client form using rhf + zod
    ContactForm.test.tsx
    ContactConfirmation.tsx               # success panel

lib/validators/inquiry.ts                 # inquirySubmissionSchema (extend existing if any)
lib/validators/inquiry.test.ts

lib/hooks/useGlobalContactTrigger.ts      # registers window.__gallurioOpenContact, returns helpers
```

---

## Modal trigger pattern

The global `window.__gallurioOpenContact` is the simplest pattern that works across server-rendered blocks (HeroBlock, CTABannerBlock are server) and client header buttons. It is set up once in `ContactModal.tsx`:

```tsx
useEffect(() => {
  window.__gallurioOpenContact = () => setOpen(true);
  return () => { delete window.__gallurioOpenContact; };
}, []);
```

Server-rendered blocks emit `<button data-cta="contact">` and a tiny client island in the layout attaches a single click delegate that calls the trigger. This avoids hydrating every block.

Add a `lib/page-builder/contactTrigger.client.tsx` that does:

```tsx
"use client";
import { useEffect } from "react";
export default function ContactTriggerDelegate() {
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = (e.target as HTMLElement)?.closest('[data-cta="contact"]');
      if (target) {
        e.preventDefault();
        window.__gallurioOpenContact?.();
      }
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
  return null;
}
```

Mount once in the public layout. Every HeroBlock/CTABanner button just outputs `<button data-cta="contact">…</button>` — no client component required.

---

## Submission flow (stubbed in this phase)

Phase 5's `onSubmit` POSTs to `/api/inquiries` (the route exists from Phase 6's perspective). In Phase 5 specifically, if Phase 6 has not yet landed, the form should POST to `/api/inquiries` and gracefully handle a 404 by showing a "Could not submit — please try again later" error. **Do not** stub the API — write the form against the real endpoint, accept that it may 404 until Phase 6 ships.

This keeps Phase 5 PR small (UI only) without creating a fake-API tech-debt path.

---

## Accessibility checklist

- `<dialog>` or `role="dialog"` with `aria-modal="true"`.
- Initial focus on the first tab's first input.
- `Tab` cycles within modal.
- `aria-labelledby` references the modal heading.
- Errors: `aria-invalid="true"` on the field, `aria-describedby` linking to error text, error text wrapped in `<p role="alert">`.
- Reduced-motion respect: no transition animations if `prefers-reduced-motion: reduce`.

---

## Tests

- `inquirySubmissionSchema.test.ts` — required fields, email format, date parse, description min length, honeypot must be empty.
- `ContactModal.test.tsx`:
  - opens via `window.__gallurioOpenContact()`
  - closes on Esc, on backdrop click, on explicit Close button
  - returns focus to trigger
- `ContactForm.test.tsx`:
  - tab switch carries state
  - submit blocked while pending
  - errors announced via `aria-live`
  - submits expected payload to `/api/inquiries`

---

## Verification

```bash
pnpm test --run public/w/_components inquiry
pnpm typecheck
pnpm dev
# Visit /w/<slug>, click Contact in header — modal opens.
# Click any HeroBlock primary CTA on Home — modal opens.
# Fill form, submit. With Phase 6 not yet merged, expect 404 + visible error.
```

---

## Out of scope

- API endpoint, `Inquiry` doc creation, draft `Booking` creation — Phase 6.
- Rate limiting + Turnstile — Phase 6.
- Email notifications to owner — Phase 6 if simple, otherwise Phase 7.
- Lead inbox UI — Phase 7.

---

## Branch & merge

```
git checkout dev
git checkout -b feat/page-builder-contact-modal
```
