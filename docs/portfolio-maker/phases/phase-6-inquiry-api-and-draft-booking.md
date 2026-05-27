# Phase 6 — Inquiry API + draft booking creation

> Parent: `../master-plan.md`
> Branch: `feat/page-builder-inquiry-api` cut from `dev` (post-Phase-5).
> Implements the public inquiry endpoint and the auto-create-draft-booking flow.

---

## Context

Phase 5 shipped the contact modal that POSTs to `/api/inquiries`. Phase 6 makes that endpoint real and adds the **key product mechanic**: every inquiry submission creates a `Client` (match-or-create by email) and a **draft `Booking`** (`status: "draft"`, `createdFromInquiryId` set). The owner sees the submission in the lead inbox (Phase 7) and approves it with one click — at which point the draft promotes to `pending` and shows up in the bookings calendar.

This phase deliberately keeps the API surface tiny: **one POST endpoint, one happy path, well-tested failure modes**.

---

## Acceptance criteria

- `POST /api/inquiries` accepts the schema from Phase 5 plus a `workspaceSlug` field.
- Resolves `workspaceSlug → workspaceId` server-side via `findPublishedWorkspaceBySlug`; rejects 404 if unpublished or missing.
- Validates payload with `inquirySubmissionSchema` from `lib/validators/inquiry.ts`.
- Rejects (400) when honeypot `company_name` is non-empty.
- Rate-limits per IP: max 5 submissions per 10 minutes → 429.
- On success:
  1. Match-or-create `Client` by `{ workspaceId, email }`. Existing client: update `phone` if not set. New client: create with `source: "form"`.
  2. Create `Inquiry` with all submitted fields + UTM/referrer + `workspaceId` + `status: "new"` + `clientId` link.
  3. Create draft `Booking` with `{ workspaceId, clientId, status: "draft", createdFromInquiryId, eventDate, eventTime, eventDuration, eventType, guestCount, location, description }`.
  4. Set `inquiry.draftBookingId = booking._id`.
  5. Return `200 { ok: true, inquiryId, draftBookingId }`.
- **Transactionality**: all four writes happen in a Mongoose session/transaction. If any step fails, no orphan records. (MongoDB Atlas M0 supports transactions.)
- Existing bookings list queries (`lib/db/queries/bookings.ts`, dashboard cards, calendar API) filter `status !== "draft"` by default. Add an explicit `includeDrafts: boolean` flag on the few helpers that need it for the inbox view.
- Tests:
  - Happy path: submission creates one `Inquiry`, one `Client`, one draft `Booking`, all linked.
  - Existing client (same email + same workspace) is reused, not duplicated.
  - **Cross-workspace email**: two workspaces with the same client email get separate `Client` records (correct per multi-tenant rule).
  - Honeypot non-empty → 400, no DB writes.
  - Unpublished workspace → 404, no DB writes.
  - Rate-limit triggers 429 after 5 submissions.
  - Transaction rollback: simulate a failure in step 3 (Booking create) and verify the Inquiry and Client (if newly created) are rolled back.
  - Existing bookings query excludes drafts by default; passes through with `includeDrafts: true`.
- `pnpm test --run api/inquiries inquiries draft-bookings` passes.

---

## File map

```
app/api/inquiries/
  route.ts
  route.test.ts

lib/db/models/Inquiry.ts                 # extend schema
lib/db/models/Booking.ts                 # add draft status + createdFromInquiryId

lib/db/queries/bookings.ts               # filter drafts by default
lib/db/queries/bookings.test.ts          # add cases for includeDrafts flag

lib/server/inquirySubmission.ts          # the transactional submission helper
lib/server/inquirySubmission.test.ts

lib/server/rateLimit.ts                  # simple in-memory per-IP rate limiter
lib/server/rateLimit.test.ts
```

---

## Inquiry schema extension

```ts
// lib/db/models/Inquiry.ts (additions)
{
  clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null, index: true },
  draftBookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
  eventTime: { type: String, default: null },              // "HH:MM"
  eventDuration: { type: Number, default: null },          // hours
  guestCount: { type: Number, default: null },
  location: { type: String, default: null },
  preferredContact: { type: String, enum: ["email", "phone", "either"], default: "email" },
}
```

Existing `convertedClientId` / `convertedBookingId` remain. `clientId` is set at submission time; `convertedClientId` only gets set when owner explicitly approves (Phase 7).

## Booking schema extension

```ts
// lib/db/models/Booking.ts (additions / changes)
{
  status: { type: String, enum: ["draft", "pending", "confirmed", "cancelled", "completed"], default: "pending" },
  createdFromInquiryId: { type: Schema.Types.ObjectId, ref: "Inquiry", default: null, index: true },
}
```

Make sure default queries in `lib/db/queries/bookings.ts` filter `status: { $ne: "draft" }` unless the caller passes `includeDrafts: true`. Audit every existing booking query in the repo (dashboard metrics, calendar list, etc.) and update — this is the single most likely place to introduce a regression.

---

## Server helper

```ts
// lib/server/inquirySubmission.ts
export async function submitInquiry(input: {
  workspaceSlug: string;
  payload: InquirySubmissionInput;
  clientIp: string | null;
}) {
  // 1. resolve workspace
  // 2. check rate limit
  // 3. start transaction
  // 4. match-or-create client
  // 5. create inquiry
  // 6. create draft booking
  // 7. link inquiry.draftBookingId
  // 8. commit; return ids
}
```

Wrap in a try/catch that aborts the session on any error. Surface only safe error messages to the client (`{ ok: false, error: "submission_failed" }` — log details server-side).

---

## Rate limiter

Simplest implementation: an in-memory `Map<string, number[]>` keyed by IP, storing the last N submission timestamps. Reject if more than 5 entries newer than 10 minutes. Acceptable for single-instance dev / small-scale production; switch to Redis/Upstash in a later phase if scale demands it.

Document this clearly in `rateLimit.ts` header — and per the simplicity principle, don't introduce Redis until there's a second instance.

---

## Notifications

Send an email to `workspace.publicPage.inquiryRecipientEmail || workspace.ownerEmail` if either is set. **If sending fails, do not roll back the submission** — log and continue. Use the existing email transport (whatever the rest of Gallurio uses for transactional email). If no transport exists, add a TODO comment and skip — better to ship the submission flow now than block on email infra.

The lead inbox (Phase 7) is the source of truth either way.

---

## Tests (must include)

- `inquirySubmission.test.ts` using `mongodb-memory-server`:
  - happy path produces 3 documents with correct cross-references
  - same email same workspace → reused client
  - same email different workspace → two clients (tenant isolation)
  - unpublished workspace rejected before any write
  - transaction rollback when booking create throws
- `bookings.test.ts`:
  - existing list helpers exclude `status: "draft"` by default
  - `includeDrafts: true` returns drafts
- `api/inquiries/route.test.ts`:
  - 400 on missing workspaceSlug
  - 400 on bad payload
  - 400 on honeypot filled
  - 429 after 5 rapid submissions
  - 200 + body shape on success

---

## Verification

```bash
pnpm test --run api/inquiries
pnpm test --run inquirySubmission
pnpm test --run queries/bookings
pnpm typecheck
pnpm dev
# Visit /w/<slug>, submit form, confirm:
#   - 200 response
#   - Mongo has new Inquiry, Client (if new), Booking with status:"draft"
#   - /dashboard does NOT show the draft booking
#   - /bookings/calendar does NOT show the draft booking
```

---

## Out of scope

- Lead inbox UI — Phase 7.
- Email transport infrastructure beyond a try-best-effort notify call.
- Approval flow (draft → pending) — Phase 7.
- Analytics events for form submit — Phase 10.

---

## Branch & merge

```
git checkout dev
git checkout -b feat/page-builder-inquiry-api
```
