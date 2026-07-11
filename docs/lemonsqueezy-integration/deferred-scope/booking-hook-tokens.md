# Deferred: Booking Hook Tokens

## What they are

Hook tokens are short deterministic strings passed to the Vercel Workflow DevKit's `createHook` and `resumeHook` functions to correlate an external event (a client clicking a link in an email, or an owner clicking a button in the UI) with a suspended workflow run.

They are **deterministic** — the same token can be reconstructed from the booking ID and round number at any time without querying the workflow runtime. This is the key property that makes the system robust: a Vercel cold start, a deploy, or a server restart cannot lose the correlation.

---

## Token format

| Token | Used by | Format |
|---|---|---|
| Client response token | Client clicking quote email link or using the portal | `booking-client-{bookingId}-r{round}` |
| Owner decision token | Owner clicking Accept / Re-quote / Decline in Lead Inbox | `booking-owner-{bookingId}-r{round}` |
| Lemon Squeezy checkout token | `subscriptionCheckoutWorkflow` (already built) | `ls-checkout-{workspaceId}` |

Examples:
```
booking-client-682f3c1a2b4d5e6f7a8b9c0d-r1
booking-owner-682f3c1a2b4d5e6f7a8b9c0d-r1
booking-client-682f3c1a2b4d5e6f7a8b9c0d-r2   ← after a re-quote, round increments
```

---

## How `createHook` / `resumeHook` work

Inside a workflow function (`"use workflow"`):

```typescript
const hook = createHook<ResponseType>({ token: "booking-client-{id}-r{n}" });
const response = await hook;  // workflow suspends here — the run is durable
```

The workflow DevKit persists the suspended run. When the token is used to resume:

```typescript
// In a route handler or server action:
await resumeHook("booking-client-{id}-r{n}", { action: "confirm" });
```

The workflow run wakes up and `response` resolves to the value passed to `resumeHook`.

The Lemon Squeezy checkout workflow uses the same pattern:

```typescript
const hook = createHook<CheckoutPayload>({ token: `ls-checkout-${workspaceId}` });
const event = await hook;  // suspends until the subscription_created webhook calls resumeHook
```

---

## Why deterministic tokens survive cold starts

The workflow runtime persists suspended runs in its own durable store (not in-process memory). When a route handler calls `resumeHook(token, data)`, it sends the token + data to the workflow runtime API, which looks up the suspended run by token and delivers the data. The route handler does not need to know the workflow run ID — the token is the key.

Because the token is derived from a booking ID that is stored in MongoDB (`Booking.activeQuoteHookToken`), the system can reconstruct the token from the database record at any time. The workflow DevKit does not need to be queried to know which token to use.

---

## `Booking.activeQuoteHookToken`

The `Booking` document stores the currently active **client-facing** token in `activeQuoteHookToken`. This field:

- Is set when the owner sends a quote: `"booking-client-{id}-r{round}"`.
- Is cleared (set to `null`) when the workflow completes (booking confirmed or cancelled).
- Is replaced (new round token) when the owner re-quotes.

The client portal page (`/w/[orgSlug]/quote/[bookingId]?token=…`) loads the booking and compares `query.token === booking.activeQuoteHookToken`. If they don't match, the portal shows the "quote no longer active" state. This comparison happens server-side — the page never exposes the stored token in rendered HTML.

**The owner-facing token** (`booking-owner-{id}-r{round}`) is not stored on the booking document — it is only used internally by the workflow when the client has countered. The Lead Inbox knows to construct the correct owner token from `booking._id` and `booking.currentQuoteRound`.

---

## Round increments

Each re-quote bumps the round number. Both the client and owner tokens change because each round is a fresh negotiation cycle with a fresh pair of hooks:

```
Round 1: booking-client-{id}-r1 / booking-owner-{id}-r1
Round 2: booking-client-{id}-r2 / booking-owner-{id}-r2
```

Old round tokens become invalid automatically — calling `resumeHook` on a token whose workflow hook has already been resolved (or was never created in the first round run) is a no-op or error from the DevKit, which is the correct behavior. The `activeQuoteHookToken` on the booking is the single source of truth for which round's client token is live.

---

## Security considerations

- Tokens are not cryptographically signed — they are opaque identifiers whose validity comes from the workflow runtime's own lookup. Guessing a valid token requires knowing the MongoDB `_id` (24 hex chars) and the round number. This is sufficient for MVP; a counter-party with a valid booking `_id` can only call `resumeHook` for a round that is currently suspended.
- The workflow DevKit processes each `resumeHook` call exactly once per token — subsequent calls are ignored after the hook is resolved. This provides implicit idempotency.
- Token exposure: the client-facing token appears in the quote email URL and in the `?token=` query param. It is single-use per round. After the client responds, `activeQuoteHookToken` changes (cleared or replaced), so the old link in the email becomes inert.
