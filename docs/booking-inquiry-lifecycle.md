# Booking Inquiry Lifecycle

How a public inquiry becomes a confirmed booking. The flow is deliberately **simple and two-step**: an inquiry lands in the owner's Lead Inbox as a new-lead booking, and the owner approves it into a confirmed booking — filling in pricing, deposit, and any other commercial terms themselves.

Gallurio does **not** broker the conversation between the owner and the client. There is no in-app quoting, no counter-offer loop, no client-facing portal, and no durable workflow. The owner and client negotiate however they already do — email, chat, phone, in person. Gallurio's job is to capture the lead and record the **final result**: the booking.

---

## Overview

```
Client submits inquiry form  (public site /w/[orgSlug])
       │
       ▼
[Stage 1] Inquiry + Booking (status: "inquiry") created
          Owner gets a notification email
       │
       ▼
   Owner & client talk off-platform
   (email / chat / phone — Gallurio is not involved)
       │
       ▼
[Stage 2] Owner opens the inquiry in the Lead Inbox and clicks "Approve".
          The Create-Booking modal opens, pre-filled with the inquiry's
          details. Owner adds price, deposit, and any final terms, then saves.
       │
       ▼
   Booking status flips "inquiry" → "booked" (confirmed in the calendar).
   Inquiry is marked "converted".
```

There is no automated back-and-forth. Either the owner approves the inquiry into a booking, or they archive it.

---

## Stage 1 — Inquiry Submission

**Trigger:** Client submits the inquiry form at `/w/[orgSlug]` (contact modal).

**Route:** `POST /api/inquiries`

**Transaction (Mongoose session — all-or-nothing):**
1. Validate the workspace exists and is published.
2. Rate-limit by IP (5 per 10 min) and run the honeypot check.
3. Match-or-create `Client` by `{ workspaceId, email }`.
   - If new: insert with `source: "form"`.
   - If existing: backfill `phone` if missing.
4. Create `Inquiry` (`status: "new"`, UTM/referrer captured, linked to the client).
5. Create `Booking` with:
   - `status: "inquiry"` (a new-lead booking, not yet confirmed)
   - `createdFromInquiryId: inquiry._id` (back-link added for this flow)
   - Event details (date, time, duration, type, guest count, location, description) copied from the form
   - Sessions converted to UTC via the workspace timezone
6. Set `inquiry.convertedClientId` to the matched client.

**Post-transaction (best-effort):**
- One notification email to the owner at `publicPage.inquiryRecipientEmail` (falling back to `contact.email`). This is the **only** automated email in the lifecycle.

The new booking carries `status: "inquiry"`, so it reads as a distinct **new-lead** event in the calendar (its own colour) and appears in the Lead Inbox. Default booking lists hide only `cancelled`; an inquiry-stage booking is visible but visually marked as unconfirmed until the owner approves it.

---

## Stage 2 — Owner Approves the Inquiry

**Trigger:** Owner opens the Lead Inbox (`/inquiries`), reviews the lead, opens it (`/inquiries/[id]`), and clicks **"Approve booking"**.

**UI — reuse the Create-Booking modal:**
Approving opens the existing booking-creation modal (`booking-wizard-modal.tsx`) in a pre-filled state. Every field the client supplied in the inquiry form is populated for the owner:

- Client — name, email, phone (the matched-or-created `Client`)
- Event — date, time, duration, event type, guest count, location, description

The owner fills in everything the inquiry could not contain — the commercial terms they decided on with the client off-platform:

- Package / service and total price (PHP)
- Deposit required (PHP)
- Any notes, sessions, or scheduling adjustments

**On save (server action):**
1. Validate the owner belongs to the workspace.
2. Update the existing `Booking` (`{ _id, workspaceId }`) with the owner-supplied pricing/terms and set `status: "booked"`.
3. Set `Inquiry.status = "converted"` and `Inquiry.convertedBookingId = booking._id`.

The booking now reads as a confirmed event in the calendar and booking lists, exactly like any manually-created booking. From here it follows the standard booking lifecycle.

> The same `Booking` document is **promoted, not duplicated** — its status flips from `inquiry` to `booked`, so there are never two records for the same lead.

**Other outcomes:**
- **Mark contacted** — owner has reached out and is in discussion. `Inquiry.status = "contacted"`. Purely informational; the booking is untouched.
- **Archive** — owner dismisses the lead. `Inquiry.status = "archived"`. The inquiry-stage booking is cancelled (`status: "cancelled"`) so it never lingers as an unconfirmed event.

---

## Data Model

### Inquiry

| Field | Meaning |
|---|---|
| `status` | `new` → `contacted` → `converted`, or `archived` |
| `convertedClientId` | The matched-or-created `Client` (set in Stage 1) |
| `convertedBookingId` | The booking, set when approved in Stage 2 |

### Booking (inquiry-related fields)

| Field | Meaning |
|---|---|
| `status` | `inquiry` while it belongs to an unapproved lead; flips to `booked` on approval |
| `createdFromInquiryId` | Back-link to the originating `Inquiry` (added for this flow) |

There are **no** quote/negotiation fields. `quotes[]`, `currentQuoteRound`, and `activeQuoteHookToken` are **not** part of this design.

### Booking status values

| Status | Meaning |
|---|---|
| `inquiry` | Created from an inquiry; a new, unconfirmed lead |
| `booked` | Owner approved/confirmed it; a real booking |
| `completed` | Event occurred and marked done |
| `cancelled` | Archived inquiry or cancelled booking |

There is **no** `quoted` status — it only existed for the removed negotiation flow.

### Inquiry status values

| Status | Meaning |
|---|---|
| `new` | Just submitted; owner hasn't actioned it |
| `contacted` | Owner has reached out / is in discussion off-platform |
| `converted` | Approved into a booking; `convertedBookingId` is set |
| `archived` | Dismissed by the owner |

---

## Explicitly NOT in this scope

These were part of an earlier over-engineered design and have been removed to keep the inquiry flow simple:

- **In-app quoting / counter-offers / re-quote loop** — owners and clients negotiate off-platform.
- **A `quoted` booking status** — removed; bookings go straight from `inquiry` to `booked`.
- **Client-facing quote portal** (`/w/[orgSlug]/quote/[bookingId]`) — does not exist.
- **Vercel Workflow DevKit for inquiries** — no durable workflow, no hooks, no `createHook`/`resumeHook`.
- **Negotiation emails** (`booking-quote`, `booking-countered-owner`, `booking-requote`, `booking-declined`, etc.) — the only inquiry email is the owner notification in Stage 1.
- **Automated deposit collection / payment links** — the owner records the agreed deposit manually; collecting it is a future feature.

---

## Email

| Trigger | Recipient | Purpose |
|---|---|---|
| Inquiry submitted | Owner | Notify of a new lead (the only automated lifecycle email) |

A "booking confirmed" email to the client is intentionally out of scope — the owner confirms with the client through their own channel.
