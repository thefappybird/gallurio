# Booking Detail Modal Redesign — Design

- **Branch:** `update/bookings/detail-modal-redesign` (off `dev`)
- **Date:** 2026-05-29
- **Surface:** `app/[locale]/(app)/bookings/_components/booking-detail-modal.tsx` (+ `booking-history-dialog.tsx`), GET `app/api/bookings/[id]/route.ts`, i18n catalogs, tests.

## Problem

The booking detail/view modal has four weaknesses:

1. **Tabs (Client / Event / Pricing / Activity)** use a thin underline (`data-[selected]:border-brand`) that reads as low-contrast and inconsistent with the add-booking wizard's confident, brand-filled step indicators.
2. **Title and event type are buried inside the Event tab** as `EditableField`s, even though they are the booking's identity and belong in the header.
3. **The Client tab shows only `clientName` + `status`** — no email, phone, or way to reach the client, despite the add-booking modal collecting full contact details.
4. **History/activity is a flat 5-row list** with bare `action` text and field-name bullets; it under-communicates and the full-history dialog is similarly plain.

## Decisions (confirmed with user)

- **Client tab:** Read-only client details (name, email, phone) fetched from the `Client` record + an "Open client" link to the client page; keep `clientName` editable inline; allow **reassigning** the booking to another existing client via the same `/api/clients?q=` picker the wizard uses. No write-back of email/phone from the booking modal. **No "preferred contact"** — that field is not in the `Client` model and the add-booking modal doesn't capture it; adding it is out of scope.
- **History:** Vertical **timeline grouped by day**, each entry carrying an **action-type pill** (Created / Updated / Status / Client) and **per-field change pills** (`before → after`). Height-capped with internal scroll in both the inline section and the full-history dialog.
- **Tabs:** **Pill tabs** reusing the wizard's brand-filled active treatment (`bg-brand text-brand-foreground` on the active pill, `text-muted-foreground` inactive). No numbers (tabs are random-access, not sequential steps).
- Stale `update/bookings-enhancements` branch removed (local + remote); fully merged into dev via PR #7.

## Changes

### Backend — surface client contact

`GET /api/bookings/[id]` currently returns the raw Booking doc (`clientName`, `clientId`, no contact). Extend the handler to attach the client's contact info via a single ownership-scoped lookup:

```
const client = await Client.findOne({ _id: booking.clientId, workspaceId })
  .select({ _id: 1, name: 1, email: 1, phone: 1 }).lean();
return NextResponse.json({ ...booking, client: client ? { id, name, email, phone } : null });
```

- One extra indexed single-doc query — no N+1, no full scan. `workspaceId` enforced.
- Defensive: if the client was hard-deleted, `client` is `null` and the UI falls back to `clientName`.
- Test: GET returns `client` block; tenant isolation (org A booking's client not leaked to org B); missing-client → `client: null`.

No `Client` or `Booking` schema changes. No new indexes (lookup is on `{_id, workspaceId}`, already covered).

### Frontend — `booking-detail-modal.tsx`

**Header (`DialogHeaderBar`)**
- Title becomes inline-editable in the header (pencil affordance; same pending-change mechanism via `onCommit("title", …)`; required-non-empty validation preserved).
- Event type rendered as a **pill beside the title**; clicking opens an inline select (`eventTypeOptions`), committing to `onCommit("eventType", …)`. Active/idle/focus-visible states; `aria-label`.
- Title + event type **removed from the Event tab** (now header-owned). Event tab keeps location + sessions.

**Tabs (`BookingTabs`)**
- Replace underline triggers with pill triggers: active = `bg-brand text-brand-foreground`, inactive = `text-muted-foreground hover:text-foreground`, `focus-visible` ring, ≥44px tap target, horizontally scrollable on mobile.

**Client tab**
- Read-only block: client name, email (mailto), phone (tel), each with empty-state dash. "Open client" link → `/clients/[id]`.
- `clientName` stays inline-editable (denormalized snapshot on the booking).
- "Change client" → reveals a search picker (reuses `/api/clients?q=` + the wizard's list styling) that, on select, stages `clientId` + `clientName` as pending changes (PATCH already supports `clientId` reassignment transactionally).
- `status` stays here as an `EditableField` select.

**History (timeline + change pills)** — inline section in Activity tab + `booking-history-dialog.tsx`
- Group entries by calendar day (locale-aware header).
- Each entry: a left timeline rail (dot + line), an **action pill** colored by type, the actor, a relative/absolute timestamp, and **change pills** for each field in `diff.changes` rendering `label: before → after` (money/date/status formatted; long values truncated with title).
- A small shared `ActivityTimeline` component renders both the inline (first 5) and dialog (paginated) lists to avoid divergence.
- Height: inline list capped (e.g. `max-h-[16rem] overflow-y-auto`); dialog body already `flex-1 overflow-y-auto` inside `max-h-[calc(100vh-3rem)]`. Verify both never exceed the viewport at 375px.

### i18n

Add keys to all five catalogs (`en`, `fil`, `ms`, `id`, `th`) under `app.bookings.detail`:
- `fields.email`, `fields.phone`, `fields.openClient`, `fields.changeClient`, `fields.changeClientSearch`, `fields.noEmail`, `fields.noPhone`
- `history.actions.{created,updated,status_changed,client_changed,deleted}`, `history.changeArrow` (or ICU), `history.by`, `history.groupToday`, `history.groupYesterday`
- Reuse existing `eventTypes.*`, `statusValues.*`.

### Tests

- Extend `app/api/bookings/[id]/route.test.ts`: client block attached; tenant isolation; missing client → null.
- Extend `booking-detail-modal.test.tsx`: header title edit, event-type pill edit, client contact rendering, reassign picker stages pending, timeline renders action + change pills, empty-history state.
- New small test for the extracted `ActivityTimeline` if it lands as its own file.

## Out of scope (YAGNI)

- No `preferredContact` field. No editing client email/phone from the booking. No new collections. No changes to session editing, pricing tab, conflict logic, or the add-booking wizard itself (only its visual vocabulary is borrowed).

## Verification checklist

- `pnpm typecheck`, `pnpm lint`, targeted `pnpm test --run` on touched files, then full `pnpm test`, then `pnpm build`.
- Manual at 375px: header title/pill edit, tab pills, client tab + reassign, history timeline scroll-containment, all four async states.
- All five locales present for new keys.
