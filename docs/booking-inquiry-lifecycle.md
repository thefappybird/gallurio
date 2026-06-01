# Booking Inquiry Lifecycle

Full specification for the 3-stage inquiry → negotiation → booking confirmation flow. Stages 2–3 use the **Vercel Workflow DevKit** (`workflow` package) for durable, resumable state that survives server restarts, Vercel cold starts, and deploys.

---

## Overview

```
Client submits form
       │
       ▼
[Stage 1] Draft Booking created (invisible to calendar)
       │
       ▼
[Stage 2] Owner reviews → sends quote → workflow suspends
       │
       ▼
[Stage 3] Client responds via branded portal (no auth)
       │
    ┌──┴──────────────┐
    │                 │
 Confirm           Counter offer
    │                 │
Booking = booked   Owner notified
                      │
               ┌──────┴──────────┐
               │                 │
           Accept          Re-quote / Decline
               │                 │
          booked ✓      Loop Stage 2 / cancelled
```

No timeout at any stage. The workflow waits indefinitely for each party.

---

## Stage 1 — Inquiry Submission

**Trigger:** Client submits the inquiry form at `/w/[orgSlug]` (contact modal).

**Route:** `POST /api/inquiries`

**Transaction (Mongoose session — all-or-nothing):**
1. Validate workspace exists and is published
2. Rate-limit by IP (5 per 10 min), honeypot check
3. Match-or-create `Client` by `{ workspaceId, email }`
   - If new: insert with `source: "form"`
   - If exists: backfill phone if missing
4. Create `Inquiry` (status: `"new"`, UTM/referrer captured)
5. Create `Booking` with:
   - `status: "draft"`
   - `createdFromInquiryId: inquiry._id`
   - `currentQuoteRound: 0`
   - `activeQuoteHookToken: null`
   - Sessions converted to UTC via workspace timezone
6. Link `inquiry.draftBookingId = booking._id`

**Post-transaction (best-effort):**
- Notification email to owner at `publicPage.inquiryRecipientEmail` or `contact.email`

---

## Stage 2 — Owner Sends Quote

**Trigger:** Owner opens Lead Inbox (`/inquiries/[id]`) and clicks **"Send Quote"**.

**UI:** Quotation modal/drawer with fields:
- Package / service description (text)
- Total amount (PHP)
- Deposit required (PHP)
- Payment terms (e.g. "50% deposit secures the date")
- Personal note to client (optional)

**Server Action on submit:**
1. Validate owner belongs to workspace
2. Append to `Booking.quotes[]`:
   ```
   { round, ownerAmount, ownerNotes, sentAt: now, clientResponse: null, ... }
   ```
3. Set `Booking.currentQuoteRound` = new round number
4. Set `Booking.status` = `"quoted"`, `Inquiry.status` = `"contacted"`
5. Call `POST /api/bookings/[id]/start-quote-workflow` to start (or resume) the Vercel Workflow

**Workflow (`lib/workflows/quoteNegotiation.ts`):**
```typescript
export async function quoteNegotiationWorkflow(bookingId: string, round: number) {
  "use workflow";

  const clientHook = createHook<{
    action: "confirm" | "counter";
    counterAmount?: number;
    counterNotes?: string;
  }>({ token: `booking-client-${bookingId}-r${round}` });

  // Email already sent before workflow started — suspend and wait
  const clientResponse = await clientHook;

  if (clientResponse.action === "confirm") {
    await confirmBooking(bookingId);
    return { outcome: "booked" };
  }

  // Counter — save and notify owner; wait for owner decision
  await saveClientCounter(bookingId, round, clientResponse);
  await notifyOwnerOfCounter(bookingId, round);

  const ownerHook = createHook<{
    action: "accept" | "requote" | "decline";
    newAmount?: number;
    newNotes?: string;
  }>({ token: `booking-owner-${bookingId}-r${round}` });

  const ownerDecision = await ownerHook;

  if (ownerDecision.action === "accept") {
    await confirmBooking(bookingId, ownerDecision.newAmount);
    return { outcome: "booked" };
  }

  if (ownerDecision.action === "decline") {
    await cancelBooking(bookingId);
    return { outcome: "cancelled" };
  }

  // Re-quote: send new email, bump round, caller re-invokes workflow for next round
  await sendQuoteEmail(bookingId, ownerDecision, round + 1);
  return { outcome: "requote", nextRound: round + 1 };
}
```

**Email sent to client:**
- Subject: `"Your booking quote from [Workspace Name]"`
- Body: event details, package description, total, deposit, personal note
- Two CTAs:
  - **[Confirm Booking]** → `GET /api/bookings/respond?token=booking-client-{id}-r{n}&action=confirm`
  - **[Counter Offer]** → `https://[domain]/w/[orgSlug]/quote/{bookingId}?token=booking-client-{id}-r{n}`

---

## Stage 3 — Client Response

### Client Portal Page

**Route:** `/w/[orgSlug]/quote/[bookingId]?token={hookToken}`

**Auth:** Token validates against `Booking.activeQuoteHookToken`. No Clerk session required. If token is invalid or expired (booking already booked/cancelled), show a polite "This quote is no longer active" message.

**Page content:**
- Workspace branding (brand kit applied)
- Event details: date, time, location, type
- Quote details: description, total, deposit, payment terms, owner's note
- Round indicator if `currentQuoteRound > 1`: "Updated quote — round {n}"
- Two actions:
  - **Confirm Booking** (primary CTA) → one-click POST
  - **Make Counter Offer** → reveals inline form

**Counter offer form:**
- Proposed budget (number, required)
- Notes (textarea, "what would you like to adjust?")
- Optional date preference (date picker)

### API Routes

`GET /api/bookings/respond?token={t}&action=confirm`
- Validates token matches `Booking.activeQuoteHookToken`
- Calls `resumeHook(token, { action: "confirm" })`
- Redirects to `/w/[orgSlug]/quote/{bookingId}?confirmed=1`

`POST /api/bookings/respond`
- Body: `{ token, counterAmount, counterNotes, counterDate? }`
- Validates token
- Calls `resumeHook(token, { action: "counter", counterAmount, counterNotes })`
- Returns `{ success: true }`

### Owner Decision (Lead Inbox)

When client counters, owner sees a **"Client Countered"** banner in the booking detail view with:
- Client's proposed budget
- Client's notes
- Three buttons: **Accept Counter** / **Re-quote** / **Decline**

These trigger server actions that call `resumeHook` on the owner hook token:
- Accept: `{ action: "accept" }` → workflow books it
- Re-quote: `{ action: "requote", newAmount, newNotes }` → workflow sends new email, owner fills new quote modal
- Decline: `{ action: "decline" }` → workflow cancels, sends polite email to client

---

## Data Model

### Additions to `BookingDoc`

```typescript
quotes: [{
  round: number;
  ownerAmount: number;
  ownerNotes: string;
  sentAt: Date;
  clientResponse: "confirmed" | "countered" | null;
  clientCounterAmount: number | null;
  clientCounterNotes: string | null;
  clientCounterDate: Date | null;
  clientResponseAt: Date | null;
}];
currentQuoteRound: number;        // 0 = no quote sent
activeQuoteHookToken: string | null;
```

### Booking Status Values

| Status | Meaning |
|--------|---------|
| `draft` | Created from inquiry; invisible to calendar |
| `quoted` | Active negotiation (any round, any party's turn) |
| `booked` | Client confirmed; appears in calendar |
| `completed` | Event occurred and marked done |
| `cancelled` | Declined by owner or abandoned |

### Inquiry Status Values (unchanged)

| Status | Meaning |
|--------|---------|
| `new` | Just submitted, owner hasn't seen it |
| `contacted` | Owner sent a quote (Stage 2 entered) |
| `converted` | Client confirmed; `convertedBookingId` is set |
| `archived` | Manually archived by owner |

---

## Hook Token Scheme

All tokens are deterministic — they survive Vercel cold starts, deploys, and server restarts without any special persistence:

| Token | Used by | Format |
|-------|---------|--------|
| Client response | Vercel Workflow `createHook` | `booking-client-{bookingId}-r{round}` |
| Owner decision | Vercel Workflow `createHook` | `booking-owner-{bookingId}-r{round}` |

The `activeQuoteHookToken` field on the `Booking` doc stores the currently active client-facing token so the portal page can validate it without querying the Workflow DevKit.

---

## Workflow Package

The Vercel Workflow DevKit (`workflow` package from [useworkflow.dev](https://useworkflow.dev)) is **not yet installed**. It must be added before implementing Stages 2–3.

```bash
pnpm add workflow @workflow/next
```

All workflow files live under `lib/workflows/`. Step functions (DB calls, email sends) use `"use step"` for full Node.js access; the orchestration function uses `"use workflow"`.

---

## Email Templates (Resend)

| Trigger | Recipient | Template |
|---------|-----------|----------|
| Inquiry submitted | Owner | `inquiry-new` |
| Quote sent | Client | `booking-quote` |
| Client confirmed | Owner | `booking-confirmed-owner` |
| Client countered | Owner | `booking-countered-owner` |
| Owner accepted counter | Client | `booking-confirmed-client` |
| Owner re-quoted | Client | `booking-requote` |
| Owner declined | Client | `booking-declined` |

---

## Out of Scope (deferred)

- **Deposit collection** — payment link in the confirmation email is a v1.1 feature
- **Contract / e-signature** — not in MVP
- **Quote expiry** — no timeout; workflows wait indefinitely by design
- **Client account** — client portal is token-only; no persistent login
