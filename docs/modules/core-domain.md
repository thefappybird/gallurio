# Module: Core CRM Domain

Bookings, clients, calendar, teams, notifications, and audit trail — the day-to-day CRM surface, as distinct from billing/auth/portfolio (each covered in their own module doc).

## Data model

- `Workspace`: the tenant root. Business profile (`businessType`, `country` ISO-2, `currency`, `timezone`, contact/socials), plan/billing fields (see `docs/modules/billing.md`), `publicPage` (see `docs/modules/portfolio-and-media.md`), `invoiceTheme`.
- `Client`: `name`/`email`/`phone`/`tags`, `source: form|manual|referral|import`, denormalized `totalSpent`/`bookingsCount`/`lastBookingAt`/`lastPaymentAmount`/`lastPaymentDate`, plus an embedded `transactions[]` journal (`{ bookingId, transactionId, teamId, amount, currency, type, occurredAt, source }`).
- `Booking`: `status: draft|booked|completed|cancelled`, one or more `sessions[]` (`{startAt, endAt}`, with denormalized `firstSessionStart`/`lastSessionEnd` for range queries), `location` (address + lat/lng), `amount: {total, deposit, currency}`, embedded `payments[]` (`price`, `status: unpaid|paid`, `method: cash|card|remit`), `staffIds[]`, `createdFromInquiryId` (links back to the originating public inquiry, see `docs/modules/portfolio-and-media.md`).
- `Team` / `TeamMembership`: workspace-scoped groups with member/lead roles — see `docs/modules/auth-tenancy.md` for the full membership model.
- `Notification`: in-app notifications — `type` enum (`inquiry.created`, `booking.team_assigned`, `booking.status_changed`, `team.invitation`, `team.invite_accepted`, `team.removed`, `team.deleted`), `read`/`readAt`, `silent` flag (actor-silent rule — see the `notifications` skill). Indexed for unread-count queries: `(workspaceId, recipientWorkosUserId, read, createdAt desc)`.
- `ActivityLog`: audit trail of entity mutations (`booking|client|inquiry|gallery|transaction|workspace`) — `action`, `diff`, `meta`. TTL 365 days.
- `Counter`: atomic per-workspace sequence generator (e.g. invoice numbers) — unique on `(workspaceId, key)`.

## Cross-cutting systems (see their dedicated skill, not duplicated here)

- **Notifications**: `sendNotification` flow, actor-silent rule, recipient resolution, Socket.IO transport, localized ICU copy — `notifications` skill.
- **Emails**: shared branded template, platform vs. partner brand context, bilingual rendering, Resend transport, every send trigger — `emails` skill.
- **Calendar**: booking calendar rendering/interactions — `calendar-management` skill.
- **Optimistic UI**: tables + calendars — `optimistic-rendering` skill.

## Public-facing legal/marketing pages

`app/[locale]/(marketing)/{terms,privacy,refunds,...}` render from `messages/<locale>.json` under the `marketing.*` namespace (`marketing.terms`, `marketing.privacy`, `marketing.refunds`) — that JSON is the live source of truth for legal copy, not a standalone doc. Paid Pro subscriptions are enabled only when the separate `PAID_BILLING_ENABLED` launch gate is true (see `docs/modules/billing.md`); formal legal sign-off on wording remains required before production activation.

## Performance & data freshness

- **Calendar window**: the server loads the Sunday-aligned visible month grid +/- `CALENDAR_WINDOW_PAD_DAYS = 37` (`lib/bookings/calendar-window.ts`; 37 = max overshoot of the adjacent month's grid, so +/-1 month never refetches). Leaving the window re-centres via `?date=` with `router.replace` in a transition (`_helpers/use-calendar-window-nav.ts`); old candles stay dimmed while pending. Calendar "Today"/today cell use workspace-tz now, not browser time. The calendar chunk loads lazily (`BookingCalendarLazy` + `CalendarSkeleton`).
- **Loaders**: `bookings/_data/calendar-events.ts` = 1 windowed booking query. `inquiries/_data/calendar-data.ts` = 1 inquiry find + 1 windowed booking find, reused for both candles and conflicts (`computeInquiryConflictsFromBookings`). Budgets asserted with `countQueries` (`test-utils/query-counter.ts`).
- **Client cache**: `AppQueryProvider` (`components/app/app-query-provider.tsx`; staleTime 30s, refetch on focus/reconnect, retry 1, `key={workspaceId}`). Keys are `["ws", workspaceId, domain, ...]` (`lib/query/keys.ts`). ONE invalidation map, `lib/query/invalidation.ts` (`invalidateFor`, `keysForEvent`, `routesForEvent`, local-echo suppression). Mutation sites call `useInvalidateFor()`; pass `{ refresh: false }` only where the response/revalidation already covers every locale. Clients/inquiries actions use locale-less `revalidatePath`, so they keep the router refresh.
- **Cross-user freshness**: Socket.IO `data:changed` to room `workspace:<id>` (`lib/data-events.ts`, `lib/sockets/emitDataChanged.ts`); payload = event type + opaque ids only. Removed members are evicted (`evictUserFromWorkspace`). `NotificationProvider` receives the event and calls `invalidateFor`.
- **URL-driven modals**: `?detail`/`?edit` are mounted client-side by `BookingUrlModals` and changed with `setUrlParams` (`lib/utils/url-params.ts`), History API, 0 RSC fetches. Gotcha: pass `null` as history state; passing `window.history.state` (carries `__NA`) makes Next skip syncing `useSearchParams`.
- **Call budgets (browser-verified)**: booking detail open = 1 GET (`?include=activity`) + 1 batched `shifts-on-date`. Drag = 1 PATCH with `rejectOnConflict` (409 rolls back only the dragged booking). Month +/-1 = 0 fetches; leaving the window = 1 RSC. Inquiry open = 1 action (client matches folded in via `lib/inquiries/detail-data.ts`), reopen = 0. Wizard client picker = 1 lazy GET, cached (`useWorkspaceClients`).

### Data integrity

- **Stale-write guard**: `PATCH /api/bookings/[id]` accepts optional `expectedUpdatedAt` (ISO), placed in the atomic update filter. Mismatch -> `409 {error:"stale", booking}` (current booking, GET shape); `rejectOnConflict` keeps `409 {error:"conflict"}`. Booking update + client payment sync + activity log run in one transaction. Detail modal, wizard edit and calendar drag all send the token (`lib/bookings/stale-booking.ts`); on stale they rebase on `body.booking`, drop the edit and show `app.bookings.detail.staleConflict`. A clean detail modal re-seeds from a newer server copy; a dirty one keeps edits and shows `staleNotice`.
- **Inquiry draft card** re-syncs untouched fields from server props, warns (`changedUnderneath`) when dirty; Save/Approve send only changed fields. `saveDraftBookingFieldsAction` returns `not_draft` when nothing was written.
- Renaming a client updates denormalized `Booking.clientName` in the same transaction. `Inquiry.eventDate` = earliest session start instant in the workspace tz (submission, session edit, calendar drag alike); inquiry table/detail format instants with `workspaceTz`.
- **Scoped realtime**: `emitDataChanged(ws, event, { teamIds })` for `booking.created/updated` sends the full event to owners + members of the booking's old/new teams (`user:<id>` rooms) and `client.statsChanged` to everyone else (staff still see client stats on /clients). Any resolution error falls back to a full workspace broadcast; events without `teamIds` stay workspace-wide.
- **Client freshness**: echo suppression is order-safe (remote arrivals are recorded, so a late local mark never swallows a teammate's identical event). Socket reconnects are unlimited with backoff; after a gap (reconnect, or tab visible while disconnected) the client invalidates all workspace queries and refreshes.
- **Back/forward**: Next reuses cached RSC payloads on history navigation. `lib/query/dirty-routes.ts` marks routes affected by an event that were not refreshed now (all of them with `refresh:false`); `HistoryRefreshGuard` (in `(app)/layout.tsx`) refreshes from the `popstate` tick when history lands on a dirty route. `router.refresh()` stales the whole client router cache, so any refresh clears the dirty set.
- **Invalidation map**: booking events also refresh `/inquiries` and `/teams`; client events also hit dashboard; member activity is invalidated by booking/inquiry/client events.
- Verified end to end by `e2e/data-integrity.spec.ts` (two contexts = two sockets; staff audience probed with a minted socket token via `e2e/fixtures/realtime-probe.ts`).

## Known gaps

- `inquiries/_components/inquiry-table.tsx` maps rows without a ceiling of its own. It is safe only while the server pages it.
- `dashboard/_components/event-type-donut.tsx` and `portfolio-views-chart.tsx` have no live consumer outside their tests (dead-code candidates, not removed).
