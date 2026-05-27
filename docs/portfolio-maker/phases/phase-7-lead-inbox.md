# Phase 7 — Lead inbox UI + approval flow

> Parent: `../master-plan.md`
> Branch: `feat/lead-inbox` cut from `dev` (post-Phase-6).
> Closes the loop: submissions land in `/inquiries`, owner approves with one click → draft `Booking` promotes to `pending` and appears in the calendar.

---

## Context

Phase 6 fills Mongo with inquiries and draft bookings. Phase 7 surfaces them. The user's product brief was specific: submissions are **near-final booking drafts**, so the inbox UI must (a) make it obvious that a draft booking already exists, (b) let the owner edit only the fields they actually own (price, internal notes, status), and (c) approve with one click — which promotes `Booking.status` from `draft` to `pending`, sets `Inquiry.status = "converted"` and `Inquiry.convertedBookingId = booking._id`.

This phase is the first non-public-page workspace screen we're adding; it borrows directly from existing Gallurio admin patterns (data tables, detail pages, server actions).

---

## Acceptance criteria

- `/inquiries` list view at `app/[locale]/(app)/inquiries/page.tsx`:
  - Server-rendered table filtered by `workspaceId` (from `requireOrg()`).
  - Columns: status badge, client name, event date, event type, submitted at, source (UTM/referrer compact display).
  - Filters: status (`new`/`contacted`/`converted`/`archived`), date range.
  - Sort: submitted at desc default.
  - Empty state with a brief explainer + link to the public page.
  - Counts in tab labels.
- `/inquiries/[id]` detail view at `app/[locale]/(app)/inquiries/[id]/page.tsx`:
  - Three sections: **Client info**, **Event request**, **Booking draft (owner-controlled fields)**.
  - The booking draft section shows the linked draft `Booking` with editable: `price`, `currency` (default from workspace), `internalNotes`, plus a confirmation banner stating "Approving this will create a pending booking on your calendar".
  - "Approve booking" button — primary CTA — triggers `approveInquiryBookingAction(inquiryId)`. Idempotent.
  - "Archive" button — sets `inquiry.status = "archived"`.
  - "Mark contacted" button — sets `inquiry.status = "contacted"` (manual status, no booking effect).
  - Audit trail: a small "history" panel showing status transitions with timestamps.
- Approval server action:
  - Owner-only (matches existing role check pattern).
  - Idempotent: re-clicking approve on an already-converted inquiry is a no-op + returns ok.
  - Inside a Mongo transaction: flip booking `draft → pending`, flip inquiry `new/contacted → converted`, set `convertedBookingId`, set `convertedClientId`.
  - Revalidates `/inquiries`, `/inquiries/[id]`, `/bookings`, `/dashboard`.
- Sidebar navigation: existing "Inquiries" link (currently a 404 stub) now lands on `/inquiries`. Dashboard "Recent inquiries" widget rows link to `/inquiries/[id]`.
- Tests:
  - `mongodb-memory-server` integration: workspace A cannot read or approve workspace B's inquiries (return 403/404).
  - List filters apply correctly; pagination if >25 results.
  - Approval transitions both records, idempotent re-call.
  - Staff role can read but **cannot** approve (per existing role gates).
- `pnpm test --run inquiries lead-inbox` passes.

---

## File map

```
app/[locale]/(app)/inquiries/
  page.tsx                          # list view
  page.test.tsx
  _components/
    InquiryTable.tsx
    InquiryStatusBadge.tsx
    InquiryFilters.tsx
  [id]/
    page.tsx                        # detail view
    page.test.tsx
    _components/
      ClientInfoCard.tsx
      EventRequestCard.tsx
      BookingDraftCard.tsx
      ApproveBookingButton.tsx      # client component, handles optimistic state
  _actions.ts                       # approveInquiryBookingAction, markContactedAction, archiveInquiryAction
  _actions.test.ts

lib/db/queries/inquiries.ts         # listInquiries, getInquiryById, with workspaceId filter
lib/db/queries/inquiries.test.ts
```

---

## Server actions

```ts
// app/[locale]/(app)/inquiries/_actions.ts
"use server";

export async function approveInquiryBookingAction(inquiryId: string, draftEdits?: {
  price?: number;
  currency?: string;
  internalNotes?: string;
}) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "Only the workspace owner can approve bookings" };

  const inquiry = await Inquiry.findOne({ _id: inquiryId, workspaceId: ctx.workspace._id });
  if (!inquiry) return { error: "Inquiry not found" };

  // Idempotency: already converted
  if (inquiry.status === "converted" && inquiry.convertedBookingId) {
    return { ok: true, bookingId: inquiry.convertedBookingId.toString(), idempotent: true };
  }

  const booking = await Booking.findOne({
    _id: inquiry.draftBookingId,
    workspaceId: ctx.workspace._id,
  });
  if (!booking) return { error: "Linked draft booking missing" };

  // Transaction: promote booking + convert inquiry
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      booking.status = "pending";
      if (draftEdits?.price !== undefined) booking.price = draftEdits.price;
      if (draftEdits?.currency) booking.currency = draftEdits.currency;
      if (draftEdits?.internalNotes !== undefined) booking.internalNotes = draftEdits.internalNotes;
      await booking.save({ session });

      inquiry.status = "converted";
      inquiry.convertedBookingId = booking._id;
      inquiry.convertedClientId = inquiry.clientId;
      await inquiry.save({ session });
    });
  } finally {
    session.endSession();
  }

  revalidatePath("/inquiries");
  revalidatePath(`/inquiries/${inquiryId}`);
  revalidatePath("/bookings");
  revalidatePath("/dashboard");
  return { ok: true, bookingId: booking._id.toString() };
}
```

---

## UI notes

- Mobile-first per CLAUDE.md: list view collapses to stacked card rows below 768px. Detail view's three sections stack on mobile, sit side-by-side at ≥1024px.
- Optimistic UI: `ApproveBookingButton` flips the local UI to "Approved" instantly, then rolls back on action error. Per CLAUDE.md optimistic-rendering principle.
- Status badge colors use semantic tokens (no raw values): `new` = brand accent, `contacted` = muted, `converted` = success-ish (accent foreground), `archived` = muted-foreground.

---

## Edge cases

- Inquiry exists but `draftBookingId` is missing (created before Phase 6, or transaction rollback artifact): show a banner "No linked draft booking — create a manual booking from this inquiry?" with a button that opens the standard booking-create flow pre-filled from inquiry fields.
- Inquiry already converted: show the past approval as a read-only banner with a link to the booking. Don't render the approve button.
- Workspace owner edits price/notes but doesn't approve: persist edits to the draft booking on blur (debounced server action `updateDraftBookingFieldsAction`). This is optional — fine to require explicit "Save edits" click in MVP.

---

## Verification

```bash
pnpm test --run inquiries
pnpm test --run lead-inbox
pnpm typecheck
pnpm dev
# Submit a form from /w/<slug>, navigate to /inquiries, click into the new row.
# Click Approve. Confirm:
#   - /bookings/calendar now shows the booking
#   - /dashboard "Recent inquiries" shows "Converted" badge
#   - Re-clicking Approve does nothing destructive
```

---

## Out of scope

- Reply-from-Gallurio email composer — defer to v1.1.
- Bulk actions (archive multiple, etc.) — defer.
- Custom CRM tags beyond the existing `Client.tags` field — out.
- Notification preferences UI — out (the recipient email field already exists in settings).

---

## Branch & merge

```
git checkout dev
git checkout -b feat/lead-inbox
```
