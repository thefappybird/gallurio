# Deferred: Client Portal

## What it is

The **client portal** is a **branded, no-login page** where a workspace owner's **end client** (the person who submitted the inquiry — not the owner, not a Gallurio user) can view a quote and respond to it. Think of it as a lightweight, one-page mini-site styled with the workspace's brand kit that exists purely for quote negotiation.

It lives at:

```
/w/[orgSlug]/quote/[bookingId]?token=booking-client-{bookingId}-r{round}
```

Authentication is entirely token-based — there is no Clerk session, no login form, no account required. The end client receives the URL in a quote email. The server validates the token against `Booking.activeQuoteHookToken` on every page load and API call.

## Why it's deferred

The portal requires the quote negotiation workflow (see `quote-negotiation.md`) to be built first. The portal is the UI half of Stage 3 in that workflow — building it in isolation has no value.

## Why it's under `/w/[orgSlug]/`

The public workspace routes already exist (`/w/[orgSlug]` is the portfolio). The portal sits under the same prefix because:
- The workspace's brand kit (fonts, colors, radius) applies to it — the owner's client should see a page that feels like it came from that business.
- The public segment already resolves `orgSlug → workspace` without Clerk auth, which is exactly the auth model the portal needs.

## Page content

The page renders using the workspace's `brandKit` CSS variables (same as the portfolio pages). It is **not** Puck-composed — its layout is fixed.

Sections, in order:
1. **Header**: workspace logo (if set), workspace name.
2. **Event summary**: event date, time, duration, location, event type.
3. **Quote details**:
   - Package / service description
   - Total amount (PHP, formatted)
   - Deposit required
   - Payment terms
   - Owner's personal note (if any)
   - "Updated quote — round {n}" label if `currentQuoteRound > 1`
4. **Actions** (two CTAs):
   - Primary: **Confirm Booking** — one-click POST, no form fields.
   - Secondary: **Make Counter Offer** — reveals an inline form (see below).

### Counter offer form

Revealed in-place (no navigation) when the client clicks "Make Counter Offer":
- Proposed budget (number input, PHP, required)
- Notes / what to adjust (textarea, optional)
- Preferred date (date picker, optional)
- Submit button

On submit, the form POSTs to `/api/bookings/respond` with the token and counter data. On success it shows a "Your counter offer was sent" confirmation state (no redirect needed).

### "This quote is no longer active" state

If the token does not match `Booking.activeQuoteHookToken` — because the booking was already confirmed, declined, or a new round has started — the page renders a polite dead-end state:
- Heading: "This quote link is no longer active"
- Body: "This quote has already been responded to, or a new quote has been sent. Contact [workspace name] directly if you have questions."
- No CTAs (no retry, no form).

This covers: duplicate submits, old email links after a re-quote, links that arrive after the owner declined.

---

## API routes

### `GET /api/bookings/respond?token={t}&action=confirm`

For confirm-by-email-link (the "Confirm Booking" link in the quote email that bypasses the portal entirely):

1. Read `token` and `action=confirm` from query params.
2. Load booking by `activeQuoteHookToken === token`.
3. If not found or token mismatch → redirect to the portal with `?expired=1`.
4. Call `resumeHook(token, { action: "confirm" })` → unblocks the workflow.
5. Redirect to `/w/[orgSlug]/quote/[bookingId]?confirmed=1`.

### `POST /api/bookings/respond`

For counter offers submitted from the portal form:

```typescript
// Body schema
{ token: string; counterAmount: number; counterNotes?: string; counterDate?: string }
```

1. Validate body with Zod.
2. Load booking by `activeQuoteHookToken === token` (must match).
3. If not found → `{ error: "INVALID_TOKEN" }` 400.
4. Call `resumeHook(token, { action: "counter", counterAmount, counterNotes, counterDate })`.
5. Return `{ success: true }` 200.

Both routes are public (no `requireOrg`). Security comes entirely from the token — it is a one-time-use deterministic hook token that becomes invalid once the workflow resumes.

---

## Files to create

| File | Notes |
|---|---|
| `app/(public)/w/[orgSlug]/quote/[bookingId]/page.tsx` | Server component; loads booking + workspace; renders portal or expired state |
| `app/(public)/w/[orgSlug]/quote/[bookingId]/_client.tsx` | Client component with the confirm/counter actions and form reveal |
| `app/api/bookings/respond/route.ts` | GET (confirm link) + POST (counter form) |

---

## Notes

- Token validation must happen server-side on every request — the client never receives the token value in page props, only the render result.
- The portal page must render all four states: loading (skeleton), expired/invalid, populated (with pending quote), and post-submit confirmation.
- On mobile at 375px the CTAs must be full-width and sticky at the bottom of the viewport.
- No Clerk session or `requireOrg` anywhere in this page tree.
- `proxy.ts` must NOT protect `/w/[orgSlug]/quote/...` routes — they are intentionally public.
