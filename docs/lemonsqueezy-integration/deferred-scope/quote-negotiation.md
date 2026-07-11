# Deferred: Quote Negotiation Workflow

## What it is

A 3-stage durable negotiation flow between a workspace owner and their end client, triggered when the owner reviews an inquiry and chooses to send a price quote rather than directly booking. The flow uses the Vercel Workflow DevKit (`workflow` package) — the same package installed for the Lemon Squeezy billing checkout workflow — for durable, resumable state that survives Vercel cold starts, deploys, and server restarts.

## Why it's deferred

The Lemon Squeezy billing PR installs the Workflow DevKit and proves the pattern with `subscriptionCheckoutWorkflow`. Quote negotiation is the next natural consumer but is a significant feature in its own right (new UI surfaces, email templates, data model changes). Splitting it avoids conflating billing migration with a complex booking-lifecycle feature.

## The 3-stage flow

### Stage 1 — Draft booking (exists today)

When a client submits the inquiry form at `/w/[orgSlug]`, the `POST /api/inquiries` route creates, inside a Mongo transaction:
- An `Inquiry` (status: `"new"`)
- A `Client` (match-or-create by `{ workspaceId, email }`)
- A `Booking` with `status: "draft"`, `createdFromInquiryId`, `currentQuoteRound: 0`, `activeQuoteHookToken: null`

Draft bookings are invisible to the calendar (default queries filter `status: { $ne: "draft" }`). This stage is fully implemented.

### Stage 2 — Owner sends a quote

**Trigger:** Owner opens Lead Inbox (`/inquiries/[id]`) and clicks "Send Quote".

**UI:** A modal/drawer with fields:
- Package / service description
- Total amount (PHP)
- Deposit required (PHP)
- Payment terms
- Personal note (optional)

**Server action on submit:**
1. Validate owner belongs to workspace.
2. Append a quote entry to `Booking.quotes[]`:
   ```typescript
   { round, ownerAmount, ownerNotes, sentAt, clientResponse: null, ... }
   ```
3. Set `Booking.currentQuoteRound` = new round, `Booking.status` = `"quoted"`, `Inquiry.status` = `"contacted"`.
4. Store `activeQuoteHookToken = "booking-client-{bookingId}-r{round}"`.
5. Call `POST /api/bookings/[id]/start-quote-workflow` → `start(quoteNegotiationWorkflow, [bookingId, round])`.
6. Send quote email to client (Resend — see `resend-email.md`).

**Workflow** (`lib/workflows/quoteNegotiation.ts`):

```typescript
export async function quoteNegotiationWorkflow(bookingId: string, round: number) {
  "use workflow";
  const clientHook = createHook<{ action: "confirm" | "counter"; counterAmount?: number; counterNotes?: string }>({
    token: `booking-client-${bookingId}-r${round}`,
  });
  const clientResponse = await clientHook;   // suspends here

  if (clientResponse.action === "confirm") {
    await confirmBookingStep(bookingId);
    return { outcome: "booked" };
  }
  await saveClientCounterStep(bookingId, round, clientResponse);
  await notifyOwnerOfCounterStep(bookingId, round);

  const ownerHook = createHook<{ action: "accept" | "requote" | "decline"; newAmount?: number; newNotes?: string }>({
    token: `booking-owner-${bookingId}-r${round}`,
  });
  const ownerDecision = await ownerHook;

  if (ownerDecision.action === "accept") {
    await confirmBookingStep(bookingId, ownerDecision.newAmount);
    return { outcome: "booked" };
  }
  if (ownerDecision.action === "decline") {
    await cancelBookingStep(bookingId);
    return { outcome: "cancelled" };
  }
  // Re-quote: bump round, send new email, caller re-invokes workflow
  await sendRequoteEmailStep(bookingId, ownerDecision, round + 1);
  return { outcome: "requote", nextRound: round + 1 };
}
```

Step functions (`"use step"`) go in `lib/workflows/steps/booking.ts` and have full Node.js access.

### Stage 3 — Client responds (client portal)

Covered in `client-portal.md`. The client clicks a link in their quote email and either confirms or counters via a branded no-login page at `/w/[orgSlug]/quote/[bookingId]?token=…`. The `resumeHook` call on the token unblocks the workflow.

When the client counters, the owner sees a "Client Countered" banner in the Lead Inbox with three buttons: Accept Counter / Re-quote / Decline. Each calls a server action that `resumeHook`s the owner token.

---

## Data model additions to `BookingDoc`

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
currentQuoteRound: number;          // 0 = no quote sent
activeQuoteHookToken: string | null;
```

New booking status values to add:

| Status | Meaning |
|---|---|
| `draft` | Created from inquiry; invisible to calendar (exists) |
| `quoted` | Active negotiation — any round, any party's turn |
| `booked` | Client confirmed; appears in calendar (exists) |
| `completed` | Event occurred and marked done (exists) |
| `cancelled` | Declined by owner or abandoned (exists) |

---

## Files to create / modify

| File | Change |
|---|---|
| `lib/db/models/Booking.ts` | Add `quotes`, `currentQuoteRound`, `activeQuoteHookToken` fields + `"quoted"` to status enum |
| `lib/workflows/quoteNegotiation.ts` | New workflow function |
| `lib/workflows/steps/booking.ts` | Step functions (confirm, cancel, save counter, notify, send email) |
| `app/api/bookings/[id]/start-quote-workflow/route.ts` | Route to start/resume workflow |
| `app/api/bookings/respond/route.ts` | GET + POST for client confirm/counter (token-validated) |
| `app/[locale]/(app)/inquiries/[id]/page.tsx` | "Send Quote" button → quote modal; "Client Countered" banner |
| `app/(public)/w/[orgSlug]/quote/[bookingId]/page.tsx` | Client portal (see `client-portal.md`) |
| `lib/validators/booking.ts` | Add quote-related Zod schemas |
| All 5 message catalogs | New `app.quotes.*` and `app.inquiries.quote.*` keys |

---

## Notes

- No timeout at any stage — workflows wait indefinitely for each party by design.
- The workflow DevKit is already installed (`workflow` package). Step imports (`"use step"`) and hook utilities (`createHook`, `resumeHook`) are available.
- Deposit collection (payment link in confirmation email) is a v1.1 feature — out of scope for this task too.
- Token scheme details: see `booking-hook-tokens.md`.
- Email templates: see `resend-email.md`.
