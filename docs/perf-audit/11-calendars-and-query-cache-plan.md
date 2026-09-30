# Final perf wave — calendars/tables/modals + fewer round-trips + app-wide react-query with correct invalidation

## Context
This is the last iteration of the 1.5.x perf work. Scope:
- `/bookings`, `/inquiries` and `/inquiries/[id]`: every view, modal, loading/empty/error state and a11y, plus the carried-over calendar "Known gaps" in `docs/modules/core-domain.md`.
- Two goals the user added: **cut redundant API/DB round-trips** everywhere, including the PR #113 surfaces (dashboard, clients, teams, settings, notifications, layout), and **adopt `@tanstack/react-query` app-wide**. Invalidation must be designed so users always see correct data, including changes made by teammates.
- Ends by deleting `docs/perf-audit/` and folding its durable content into the module docs.

**Locked decisions (user):**
- Calendar data is windowed on the server via the URL.
- The client picker loads lazily through react-query.
- `booking-detail-modal.tsx` gets targeted fixes only (no file split).
- react-query covers every in-app client read.
- A Socket.IO `data:changed` broadcast drives cross-user invalidation.
- The branch is renamed.

Executors re-verify every audit finding before fixing it. The Haiku audits had false positives: for example, `(app)/error.tsx` already exists, and the claim that "layout can pass props to pages" does not hold.

## Setup
- Rename the branch with `git branch -m fix/calendars-perf-fixes action/perf-calendars-query-cache`. Before renaming, confirm with `git ls-remote` that it isn't pushed.
- Save this plan to `docs/perf-audit/11-calendars-and-query-cache-plan.md`. It is a scratch doc and gets deleted in T9.
- Record baselines before any change:
  - `pnpm analyze` gzip for `/bookings`, `/inquiries`, `/dashboard`.
  - RSC payload bytes for both calendar views.
  - HTTP requests per flow and DB queries per render, using a mongoose query-counter test helper.

### Baseline (2026-09-30, `pnpm analyze`, client JS gzip)
| Route | Chunks | gzip | Largest chunk |
|---|---|---|---|
| `/bookings` | 41 | 852.2 KB | 151.8 KB |
| `/inquiries` | 37 | 758.4 KB | 151.8 KB |
| `/inquiries/[id]` | 34 | 518.0 KB | 75.9 KB |
| `/dashboard` | 42 | 1144.5 KB | **4 × 158.7 KB, identical size** |
| `/clients` | 37 | 601.5 KB | 75.9 KB |
| `/teams` | 34 | 508.4 KB | 75.9 KB |

Note: `pnpm analyze` finishes in about 70 s and then keeps serving the viewer on :4000. Stop it once the "Analyze completed" line appears.

## Reuse (don't re-implement)
- `TableSkeleton` (`components/app/table-skeleton.tsx`)
- `components/app/pagination.tsx`
- `lib/pagination.ts` (`DEFAULT_PAGE_SIZE`, `PAGE_SIZE_OPTIONS`)
- `hooks/use-viewport-remaining-height.ts`
- `EmptyState`
- `GalleryQueryProvider`, as the config reference
- `renderWithProviders` (`test-utils/render.tsx`)
- The warm-on-pointerenter/focus pattern from PR #110
- The header/row a11y markup in `clients-table.tsx`
- `buildBookingCalendarEvents`, `buildInquiryCalendarEvents`, `detectConflictIds`
- The existing Socket.IO server (`lib/notifications/send.ts` `io.to(...)`) and `NotificationProvider`'s socket connection

## Tasks
**Query-merge rule (applies to every `$facet` item below):** merge queries only when `explain("executionStats")` shows the merged form examines ≤ the docs/keys of the separate form. A `$facet` count reads every matched document, whereas `countDocuments` on a matching index is a key-only COUNT_SCAN. And independent queries already in `Promise.all` cost about one round-trip of latency. Where merging loses, keep the parallel queries and record why. The layout notifications `$facet` is **dropped**: both queries are index-backed and already parallel.

Implementers run one at a time: tdd-guard state is shared per worktree. Each task ends with its own commit, and the orchestrator runs `tsc --noEmit` after every task, never concurrently with anything else.

### T0 · backend — per-request dedupe (all app pages)
- **`requireOrg()` (`lib/auth/requireOrg.ts:43`) is not memoized.** The layout and every page each run:
  - `User.findOne`
  - `getActiveWorkspaceId`
  - `Workspace.findById`
  - `expireGrantIfPast`

  So every app render does all of that twice. Fix: move it into a React-`cache()`d, argument-free `resolveOrgContext()`, and keep a thin `requireOrg(opts)` that applies the onboarding/gated redirects on top.
- Wrap `getAuthUser()` in `cache()`.
- Wrap `getUserTimeFormat()` in `cache()`: the layout and the dashboard's BookingsTab both read it.
- `ownerContext()` stays separate: it returns a hydrated (non-lean) `Workspace` doc that Server Actions may mutate, and React `cache()` doesn't dedupe inside Server Actions anyway.
- Tests:
  - Two calls in one request produce one DB round-trip each.
  - The redirect gates still fire.
  - Tenant resolution is unchanged.

### T1 · backend — calendar windowing + round-trip consolidation (bookings/inquiries)
Target call budget. The executor re-measures the "today" column; the final table goes in the PR body.

| Flow | Today | Target |
|---|---|---|
| `/bookings` calendar render | Team scope, team options, all bookings (find + count), ≤1000 clients, fx, `?detail` pre-check | 1 team read + 1 windowed booking query |
| `/bookings` table render | Same as calendar, minus candles | 1 team read + 1 `$facet` (rows + total) + fx |
| `/inquiries` calendar render | Team scope, team options, all inquiries (find + count), status counts, conflicts `Booking.find`, all bookings, **all clients** | 1 team read + 1 inquiry `$facet` (window rows + counts) + **1** workspace-wide windowed `Booking.find`, reused for candles (team-filtered on the server) and for conflicts |
| `/inquiries` table render | find, count, status counts, conflicts | 1 `$facet` (rows + total + counts) + 1 conflicts query |
| Calendar drag/resize | GET `shifts-on-date`, then PATCH, then full `router.refresh()` | 1 PATCH (409 with conflicts, or 200 with the updated booking) |
| Open booking detail | GET booking + GET activity + GET `/api/users/names` | 1 GET (booking + first activity page with actor names), cached |
| History dialog page | GET activity + GET names | 1 GET (names inline) |
| Detail → "Edit all" → wizard | GET booking again | 0 (shared key) |
| Wizard create | Clients preloaded on every render | 1 lazy GET, cached |
| Month nav | 0 (everything preloaded, unbounded) | 0 while the visible grid (incl. spill-over days) stays inside grid ± 31 days; 1 RSC fetch otherwise |

Work:
- **Calendar window.** Add pure `lib/bookings/calendar-window.ts`: `calendarWindow(date, tz)` = the **visible grid** (the month padded to full weeks, so the ~1–6 spill-over days of the previous/next month are included) extended by `CALENDAR_WINDOW_PAD_DAYS = 31` on each side.
  - Spill-over days and drag targets into the adjacent month are always populated, never shown empty.
  - The pad clears the "at least 15 days" floor with headroom, so a single prev/next click usually stays inside the window (0 requests).
  - Unit-test tz, DST and month edges; assert the grid's spill-over days are always inside the window and the pad is never < 15 days.
- **Paged queries.**
  - `listBookings` gains a `range` overlap filter. Confirm with `explain` that it uses the existing `{workspaceId,lastSessionEnd,firstSessionStart}` index.
  - Paged `listBookings`/`listInquiries` already run `find` + index-backed `countDocuments` in `Promise.all`, and `getInquiryStatusCounts` runs in parallel with them. Keep all three per the query-merge rule; no `$facet`.
  - If `explain` shows a scan on the inquiry `sessions.startDate` window, add an index that starts with `workspaceId`.
- **Team reads — no change.** Verified: `resolveBookingTeamScope` and `getBookingTeamOptions` both go through the `cache()`d `getTeamsForUser`, and an owner's scope needs no query.
- **Inquiries calendar query** filters `status: "inquiry"` plus the session window in the DB, instead of loading all inquiries and filtering in JS.
- **Inquiry conflicts.** Split `computeInquiryConflicts` into a pure core plus a query wrapper, so the calendar reuses its single booking query. Staff team scope applies to what is rendered; other teams' booking data is never serialized.
- **Remove unneeded reads.**
  - Drop the clients query from calendar renders: `CalendarEvent.clientEmail` is typed but never rendered. Verify, then remove the field.
  - Drop the `?detail` pre-checks. When the modal's GET returns 404, the modal closes and strips the param.
  - Make fx table-only.
- **Drag/resize PATCH.** `PATCH /api/bookings/[id]` gets an opt-in `rejectOnConflict` flag, used by drag-and-drop only; the wizard keeps its soft confirm.
  - It runs the server-side check from `lib/bookings/shift-conflicts`.
  - A conflict returns 409 with the conflicting shifts; success returns 200 with the updated booking.
  - Retire `shifts-on-date` if nothing else uses it.
  - `rescheduleInquirySessionAction` also returns the updated data.
- **Booking detail GET.** `GET /api/bookings/[id]` returns the booking plus its first activity page with actor names. The activity endpoint returns names inline. Apply the `hosting-ops.md` endpoint-hardening checklist.
- **Clients picker.**
  - The picker gets a lean `/api/clients` shape: `id, name, email, phone`.
  - Cap `ClientReassignPicker` results.
- Set the inquiries default `limit` to `DEFAULT_PAGE_SIZE`; today it is 25, which isn't one of the offered options.
- Tests use in-memory Mongo:
  - Window overlap, including overnight and multi-day sessions.
  - `$facet` parity with the old queries.
  - Conflict parity between the old query and the reused-bookings path.
  - PATCH 409/200 response shapes.
  - Tenant isolation and staff team scope.
  - Actor-name resolution.

### T2 · backend — round-trip cleanup on PR #113 surfaces (from the sweep; verify each)
- **Clients.**
  - `listClients` (`clients/_data/clients-queries.ts:74-77`): find + count → `$facet`.
  - Reuse the stats aggregation across `listClients`/`getClientById` where both run in one request.
  - `client-detail-modal` bookings + payments page 1: serve both from one action if both tabs are routinely opened together; otherwise keep them lazy per tab and cache them.
- **Teams.** Merge the two `Booking.aggregate` calls in `teams/page.tsx:52-79,130-146` (monthly average + team stats) into one `$facet`.
- **Settings.** `getDisplayPricing()` (`settings/[[...catchall]]/page.tsx:149`) should run only for the billing panel.
- **Dashboard.**
  - Verify whether the ~14 metric queries run for tabs that aren't shown. If so, gate each one on the resolved active tab.
  - Merge the heatmap earliest/latest `findOne`s (`booking-analytics.ts:138-145`) into one `$facet`, if `explain` agrees.
  - **Bundle:** `/dashboard` ships 4 chunks of identical size (158.7 KB gzip each). This is likely recharts duplicated once per `dynamic()` chart island. Confirm in the analyzer, then give the charts one shared dynamic boundary or chunk so recharts ships once. Target: −~475 KB gzip.
- **Socket token.** `NotificationProvider` refetches `/api/socket-token` on every reconnect; reuse the token until the server rejects it.
- **Replace full refreshes.** Wherever a mutation does a full `router.refresh()` only to update one row (for example, clients deactivate/reactivate at `clients-page-client.tsx:191,314`), apply the action result locally and invalidate through T3.
- Tests: query-count assertions per render for the changed pages.

### T3 · frontend + backend — react-query architecture + invalidation (correctness first)
- **Provider.** Add `components/app/app-query-provider.tsx` and mount it in `app/[locale]/(app)/layout.tsx` with `workspaceId`: one `QueryClient`, `retry: 1`.
  - Leave `GalleryQueryProvider` as is (nested), and flag consolidating it in `REUSABLE_CODE.md`.
  - `renderWithProviders` wraps the new provider.
- **Key factory.** Add `lib/query/keys.ts`. Every key starts with `["ws", workspaceId, domain, ...]`, so cached data can never cross workspaces. Domains:
  - `booking(id)`
  - `bookingActivity(id)`
  - `bookings` (lists)
  - `calendar`
  - `clients` (picker)
  - `client(id)` (detail, bookings, payments)
  - `inquiries`
  - `inquiry(id)`
  - `dashboard` (mini-calendar, any client-read widgets)
  - `teams`
  - `memberActivity(userId)`
  - `notifications`
- **Freshness defaults.**
  - Shared mutable data: `staleTime: 30s`, `refetchOnWindowFocus: true`, `refetchOnReconnect: true`.
  - Reference data (clients picker, team options): `staleTime: 5m`, but always invalidated by the events below.
  - Editable surfaces (the detail modal's booking): seed local edit state once per open. Use `refetchOnWindowFocus: false` so a refetch can never overwrite in-progress edits.
- **One invalidation map.** Add `lib/query/invalidation.ts`: `invalidateFor(queryClient, workspaceId, event)`. It is the only place that knows which data an event affects, and every mutation site calls it: no ad-hoc `invalidateQueries`.

  | Event | Invalidates |
  |---|---|
  | `booking.updated` / `booking.statusChanged` / `booking.paymentChanged` / `booking.sessionsChanged` | `booking(id)`, `bookingActivity(id)`, `bookings`, `calendar`, `client(clientId)`, `dashboard`; `inquiries` + `inquiry(id)` if the booking is linked to an inquiry |
  | `booking.created` / `booking.deleted` / `booking.imported` | `bookings`, `calendar`, `clients`, `client(clientId)`, `dashboard` |
  | `inquiry.*` (convert, archive, reschedule, status) | `inquiries`, `inquiry(id)`, `calendar`, `dashboard`; booking keys when a draft booking is touched |
  | `client.*` (create, edit, deactivate/reactivate, reassign) | `clients`, `client(id)`, `bookings`, `booking(*)` for the affected client |
  | `team.*` / `member.*` | `teams`, `memberActivity`, `calendar` (team colors/scope), `dashboard` |
  | `workspace.settings` (tz, currency, time format) | everything under `["ws", workspaceId]` |

  Where the server-rendered page shows affected data, `invalidateFor` also triggers `router.refresh()`. Next 16 dynamic pages have no router-cache staleness here (no `staleTimes` in `next.config.ts`), so navigating to the dashboard already renders fresh RSC. Only the currently visible RSC page needs the refresh.
- **Optimistic updates.** Use `onMutate` snapshot → `setQueryData` → rollback in `onError` → `invalidateFor` in `onSettled`. When the mutation returns the entity (PATCH 200), `setQueryData` it before invalidating, so there's no flash back to stale data.
- **Cross-user/tab freshness via Socket.IO.**
  - **Server:** after a successful mutation, `emitDataChanged(workspaceId, event, ids)` sends to room `ws:<workspaceId>`. The payload is only the event name and opaque ids, never entity data. Hook it into the same code paths as the mutations: API routes, Server Actions, import.
  - **Room join:** on socket connect, the server joins the socket to `ws:<id>` only after checking the signed socket-token's workspace against the DB membership. When the active workspace changes, the socket leaves the old room.
  - **Client:** `NotificationProvider`'s socket listens for `data:changed` and calls the same `invalidateFor`. Events are ignored when their `workspaceId` isn't the active one, and bursts are debounced (~250 ms).
  - Staff team scope is preserved: other clients refetch through the scoped endpoints, so a broadcast never exposes data.
  - Security pass: re-enable the trailofbits plugins and run `security-auditor` over the room-join + emit paths; this change touches tenancy/realtime.
- **Tests.**
  - Table-driven `invalidation.test.ts` asserts each event hits exactly the expected key prefixes.
  - Provider test proves no cross-workspace cache hit.
  - Socket room-join rejects a workspace the user isn't a member of.
  - Emitting a mutation triggers `invalidateFor` on a second mocked client.
  - Optimistic rollback test for the drag PATCH.

### T4 · frontend — migrate all in-app client reads to react-query
Start with an inventory of every `useEffect`+`fetch` read and every action-as-read across bookings, inquiries, dashboard, clients, teams, settings and notifications.
- Known sites:
  - `mini-booking-calendar.tsx` (replaces its hand-rolled `Map` cache + `AbortController`)
  - `client-detail-modal.tsx`
  - `member-details-dialog.tsx`
  - `booking-history-dialog.tsx`
  - `booking-detail-modal.tsx`: the booking query is shared with wizard edit mode
  - `booking-wizard-modal.tsx` edit fetch
  - `calendar-view.tsx`'s `refetchClients`
  - `inquiries/[id]/_components/client-info-card.tsx`
  - The inquiry detail load in `inquiries-page-client.tsx`
- Add a `useWorkspaceClients({ enabled })` hook. It loads lazily when the wizard opens, and is shared by the wizard (calendar + table) and the calendar. Remove the `clients`/`initialClients` prop threading.
- Every mutation on these surfaces goes through `useMutation` + `invalidateFor`. That covers:
  - booking status/payment/session edits
  - cancel
  - wizard create/edit
  - import
  - inquiry actions
  - client edits
  - team/member actions
- Out of scope: the notification list's socket live-tick, which already stays fresh by push; the billing checkout mutation.

### T5 · frontend — calendars
- **Window-aware navigation.** The check uses rbc's **visible grid range** (`onRangeChange`, including spill-over days), not the month.
  - Only when that range leaves `window` do we call `router.replace(?date=…)` inside `startTransition`.
  - The old events stay rendered, dimmed, until the new window lands: no skeleton flash, never an empty grid.
  - The new window re-centers on the new grid.
- **Drag/resize flow.**
  - Remove the `fetchConflicts` pre-flight and send a single PATCH with `rejectOnConflict`.
  - 409 → roll back and show the existing toast copy.
  - 200 → rebuild that booking's candles from the response, then `invalidateFor`. No full refresh.
  - The inquiries reschedule works the same way.
  - Update the `optimistic-rendering` skill, keeping the override until the new events are in state (the known snap-back bug).
- **`CalendarSkeleton`.** Build one skeleton for both pages: the toolbar plus the grid at `h-[calc(100dvh-14rem)]`.
  - `loading.tsx` chooses the calendar or table skeleton from the stored view cookie. Verify in the Next 16 docs that `cookies()` in `loading` is safe for prefetch; if it isn't, use in-page `<Suspense>` keyed by view instead.
  - Table skeleton rows = `DEFAULT_PAGE_SIZE`.
- **`react-big-calendar` code split.** Load it via `next/dynamic` (`ssr: false`, with the skeleton as fallback). Keep it only if analyze/TBT shows a gain; otherwise revert and record it as declined.
- **Candles.**
  - Wrap `MonthBookingEvent`, `TimeBookingEvent` and `OverflowPopoverRow` in `memo()`, and make the consumer props stable.
  - The candle `aria-label` includes conflict and past state.
  - Add a non-blocking `role="status"` empty-range pill that causes no layout shift.

### T6 · frontend — modals
- **Code splitting.** Load `BookingWizardModal`, `ImportSheet`, `BookingsExportDialog`, `InvoiceThemeDialog` and `InquiryDetailModal` with `next/dynamic`. Mount them only while open, and warm them on the trigger's pointerenter/focus.
- **Error states.**
  - Detail modal: error state with retry, driven by react-query's `isError`/`refetch`. The skeleton height matches the loaded modal. The inline session conflict gets `role="alert"`.
  - History dialog and export download get error states too.
- **Wizard steps** get `aria-current="step"`.
- **Caps.** Cap import preview rows and the import error list with an "N more" line (verify first).
- **Localize hardcoded aria-labels.** Cover all 5 locales, editing with the Edit tool only (never PowerShell writes) to stay UTF-8 safe:
  - `booking-detail-modal.tsx:3165,3179,3203,3593,3607`
  - `booking-wizard-modal.tsx:873,893`
  - `editable-field.tsx:418,428`
  - `team-filter-control.tsx:171,183`
  - `inquiry-view-toggle.tsx:65`

### T7 · frontend — tables + inquiries
- `bookings-table.tsx`: `scope="col"`, `aria-sort` and a button sort trigger, matching `clients-table.tsx`.
- `inquiry-table.tsx`: `aria-sort` only if sortable; hoist helpers.
- Rebuild `inquiries/[id]/loading.tsx` to match the real card layout.
- The bookings table's empty state uses `EmptyState`.
- The `inquiry-table` row ceiling is declined: the server clamps `limit` to `PAGE_SIZE_OPTIONS` (max 50). Record that in the docs.

### T8 · review
- `senior-reviewer` (opus) reviews the full diff. Focus areas:
  - invalidation-map completeness: every mutation site calls `invalidateFor`
  - key tenancy
  - socket room auth
  - frontend/backend boundary
  - tests
  - locales
- A Sonnet executor applies the findings.
- The `security-auditor` pass on the socket and new endpoints runs here if it didn't run in T3.

### T9 · docs
- Check that each "still open" item in `docs/perf-audit/*.md` is either fixed here or already carried into a module doc. That includes confirming the recharts `dynamic()` work from PR #113. Then **delete `docs/perf-audit/`**, including this plan copy.
- Update `docs/modules/core-domain.md`:
  - Replace the calendar "Known gaps" with a short "Performance & data freshness" section covering the window model, the query provider, the key convention, the invalidation map, the socket `data:changed` flow and the call budgets.
  - Keep only genuinely open gaps.
- Update `auth-tenancy.md` with the cached `requireOrg` core and the workspace socket room auth.
- Update the `calendar-management`, `optimistic-rendering` and `notifications` skills (socket event).
- Update `REUSABLE_CODE.md`: `AppQueryProvider`, `lib/query/keys`, `invalidateFor`, `useWorkspaceClients`, `CalendarSkeleton`, `calendarWindow`, `emitDataChanged`.
- Update `docs/AGENTS-INDEX.md` if it references perf-audit.

## Verification
- **Per task.** Executors run scoped `pnpm test --run <fragment>` + eslint on the files they touched. The orchestrator runs `tsc --noEmit` alone after each task.
- **Batched Playwright.** The orchestrator runs it alone, after all static work, as 2 runs with one login each (fixed setup project, then `--no-deps` per file):
  1. `/bookings` at 375/768/1280:
     - calendar navigation within the window (0 requests) and across it (1 RSC fetch, CLS observer = 0)
     - drag → 1 PATCH, no refresh
     - forced 409 rolls back
     - wizard: picker fetched once, cached on reopen
     - detail modal: loading → populated; forced 500 → error + retry
     - lazy import/export/invoice sheets
     - table `aria-sort`
     - `ar` at 1280 for the new strings; dark-mode contrast of the new states
  2. `/inquiries` + `/inquiries/[id]` + `/dashboard`, with a **second browser context as a teammate**:
     - context A changes a booking's status
     - context B's open dashboard mini-calendar, bookings calendar and client detail update without a manual reload (socket invalidation)
     - A's own dashboard shows the new value on navigation
     - inquiry reschedule
     - conflict candle label
     - `[id]` loading → page with no shift
  - In both runs, requests are counted with `page.on("request")` and compared against the T1 budget table.
- **Pre-merge.**
  - Chunked full vitest sweep, `tsc`, lint.
  - PR body: `- [ ]` checklist, before/after call-budget table, analyze numbers.
  - Merge to `dev` only after approval.
