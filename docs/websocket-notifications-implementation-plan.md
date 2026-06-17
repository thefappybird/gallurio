# Real-Time Notification System — Implementation Plan
_Branch: feat/websocket-notifications — 2026-06-16_

## Codebase Context (pre-flight findings)

| Area | Finding |
|------|---------|
| Custom server | None exists — must create `server.ts` for Socket.io |
| socket.io | Not installed — add `socket.io` + `socket.io-client` |
| resend | Already installed (`^6.12.4`); `lib/email/resend.ts` + `lib/email/send.ts` in place |
| Sidebar | `components/app/app-sidebar.tsx` — OWNER_NAV array pattern; `SidebarMenuBadge` component available |
| Booking modal | `?detail=<bookingId>` opens BookingDetailModal |
| Inquiry modal | `?inquiryId=<inquiryId>` opens InquiryDetailModal |
| Teams page | Owner-only (`notFound()` for non-owners) — member view must be added |
| Cursor pagination | Pattern in `lib/db/queries/gallery.ts` — base64url `createdAt\|_id` composite |
| Auth | `getAuthUser()` → `{ workosUserId, email, name }` |
| Trigger: inquiry.created | `lib/server/inquirySubmission.ts` `submitInquiry()` (already sends Resend email — add WS here) |
| Trigger: booking.team_assigned + status_changed | `app/api/bookings/[id]/route.ts` PATCH |
| Trigger: team.invitation | `app/[locale]/(app)/teams/_invite-action.ts` `inviteMemberAction()` |
| Trigger: team.removed | `app/[locale]/(app)/teams/_member-action.ts` `removeMemberFromTeamAction()` |
| Trigger: team.deleted | `app/[locale]/(app)/teams/_actions.ts` `deactivateTeamAction()` |

---

## Architecture Notes

### Socket.io Authentication
API route `GET /api/socket-token` verifies the WorkOS session via `getAuthUser()` and returns a short-lived HMAC-signed token (`workosUserId + exp`, keyed by `ACTIVE_WORKSPACE_COOKIE_SECRET`). The Socket.io client passes this token in the `auth` handshake. Server middleware verifies it and joins the socket to `user:<workosUserId>` and `workspace:<workspaceId>`.

### Socket.io Singleton
`lib/sockets/io.ts` stores the `Server` instance on `globalThis.__io` so it is accessible from server actions and API routes without circular imports across hot-reload boundaries.

### sendNotification() flow
1. Build title/body strings from ICU templates using the `locale` param
2. Insert one `Notification` doc per recipient into MongoDB
3. For each recipient: emit `notification:new` on `io.to("user:<workosUserId>")` with the serialized doc
4. Fire Resend email for each recipient — **non-blocking** (`void sendEmail(...)` — never awaited, failure never rethrows)

---

## Phases

### Phase 1 — Infrastructure
**Goal:** Socket.io running alongside Next.js; Notification model ready.

Files to create:
- `server.ts` — custom Next.js HTTP server wrapping Socket.io; sets global io; reads `PORT` env; starts `app.prepare()` then `server.listen()`
- `lib/sockets/io.ts` — `getIO() / setIO()` singleton using `globalThis.__io`
- `lib/db/models/Notification.ts` — Mongoose schema + two compound indexes (see spec)

Files to modify:
- `package.json` — change `start` script to `tsx server.ts`; add `tsx` as dep if not present; add `socket.io` + `socket.io-client`
- `next.config.ts` — if needed: add webpack externals to prevent socket.io being bundled on client

**Test:** Smoke test that Socket.io server starts and the model compiles.

---

### Phase 2 — sendNotification() Utility
**Goal:** Single callable that persists, emits, and emails.

Files to create:
- `lib/notifications/messages.ts` — ICU message factory per `NotificationType`; returns `{ title, body, href }` given `{ type, locale, entityId, entityType, vars: Record<string,string> }`
- `lib/notifications/send.ts` — `sendNotification()` implementing the 3-step flow above
- `lib/email/templates/notification.tsx` — Resend React email template (or plain HTML fallback)

Types to export from `lib/notifications/types.ts`:
```ts
export type NotificationType =
  | "inquiry.created"
  | "booking.team_assigned"
  | "booking.status_changed"
  | "team.invitation"
  | "team.removed"
  | "team.deleted";
```

**Tests:**
- `sendNotification()` unit: mock `Notification.insertMany`, mock `getIO()`, mock `sendEmail`; verify doc shape, room target, email call, and that email failure does not throw
- Tenant isolation: supplying a wrong `workspaceId` must not affect another workspace's notifications
- Self-exclusion: `triggeredByWorkosUserId` must never appear in recipients

---

### Phase 3 — Socket.io Auth + Client Hook
**Goal:** Browser connects authenticated and lands in the right room.

Files to create:
- `app/api/socket-token/route.ts` — `GET`; calls `getAuthUser()` + `requireOrg()`; returns signed token (HMAC-SHA256 of `${workosUserId}:${workspaceId}:${exp}`, key = `ACTIVE_WORKSPACE_COOKIE_SECRET`); 60s TTL
- `lib/hooks/useNotifications.ts` — fetches `/api/socket-token`, connects socket.io, listens for `notification:new`; exposes `{ notifications, unreadCount, markRead, markAllRead }` state
- Socket.io middleware in `server.ts` — verifies token, extracts ids, joins rooms

Files to modify:
- Authenticated layout (`app/[locale]/(app)/layout.tsx`) — mount `<NotificationProvider>` which calls `useNotifications` and provides context

**Tests:**
- Socket.io room routing: verify that an event emitted to `user:A` is NOT received by socket in `user:B` room

---

### Phase 4 — Trigger Point Integration
**Goal:** All 6 notification types fire from the right place.

Files to modify:

| File | Change |
|------|--------|
| `lib/server/inquirySubmission.ts` | After DB writes, call `sendNotification({ type: "inquiry.created", recipients: [ownerUser], ... })` |
| `app/api/bookings/[id]/route.ts` | After status ActivityLog: call `sendNotification({ type: "booking.status_changed", recipients: teamMembers + owner, ... })`; after team assignment: call `sendNotification({ type: "booking.team_assigned", recipients: newTeamMembers, ... })` |
| `app/[locale]/(app)/teams/_invite-action.ts` | After `sendTeamInviteEmail()`: call `sendNotification({ type: "team.invitation", recipients: [invitedUser], ... })` |
| `app/[locale]/(app)/teams/_member-action.ts` | After `TeamMembership.deleteOne`: call `sendNotification({ type: "team.removed", recipients: [removedUser], ... })` |
| `app/[locale]/(app)/teams/_actions.ts` | After `Team.updateOne(isActive: false)`: collect current members, call `sendNotification({ type: "team.deleted", recipients: members, ... })` |

Each trigger must supply: `workspaceId`, `recipients`, `type`, `entityId`, `entityType`, `triggeredByWorkosUserId`, `locale`.

---

### Phase 5 — Server Actions + DB Queries
**Goal:** Read/mark-read operations for notifications.

Files to create:
- `lib/db/queries/notifications.ts`
  - `getUnreadCount(workspaceId, workosUserId): Promise<number>`
  - `listNotifications(workspaceId, workosUserId, opts?: { cursor?, limit? }): Promise<{ items, nextCursor }>`
    - Cursor pattern: base64url of `createdAt|_id` (descending, matching gallery.ts convention)
- `app/[locale]/(app)/notifications/_actions.ts`
  - `markNotificationReadAction(id: string)` — sets `read: true, readAt: now` + emits `notification:read` socket event
  - `markAllNotificationsReadAction()` — bulk update all unread for workspace+user

---

### Phase 6 — UI: Bell Icon + Popover
**Goal:** Sidebar bell with badge and notification popover.

Files to create:
- `components/notifications/NotificationPopover.tsx` — popover with CSS arrow pointing left at sidebar; shows recent 10; desktop float + mobile full-screen overlay (`z-[9999]`); "Mark all read" button; "See all" footer link

Files to modify:
- `components/app/app-sidebar.tsx`
  - Add bell icon entry below collapse toggle (not in OWNER_NAV — it's a separate element)
  - Wrap with `NotificationPopover` trigger
  - Show `SidebarMenuBadge` with unread count when > 0

---

### Phase 7 — UI: /[locale]/notifications Page
**Goal:** Full notifications archive.

Files to create:
- `app/[locale]/(app)/notifications/page.tsx` — server component; loads first page server-side
- `app/[locale]/(app)/notifications/_components/NotificationsList.tsx` — client component; cursor-paginated "load more"; unread row tint; mark-all-read button; empty / loading skeleton / error states; mobile-first at 375px

---

### Phase 8 — Teams Page Member Access
**Goal:** Members can land on `/[locale]/teams` and see a read-only view of their teams.

Files to modify:
- `app/[locale]/(app)/teams/page.tsx`
  - Remove `if (role !== "owner") notFound()`
  - Branch on `role`:
    - `owner` → existing full management UI
    - `staff` → `<MemberTeamsView>` queried by `workosUserId` against `TeamMembership` — read-only list of their teams and role

Files to create:
- `app/[locale]/(app)/teams/_components/MemberTeamsView.tsx` — read-only; shows team name, role ("Member" / "Lead"), and member count

Files to modify:
- `components/app/app-sidebar.tsx` — add teams link to staff nav if not already present (currently OWNER_NAV only includes teams for owners — verify and fix)

---

### Phase 9 — Deep-Link Modal Auto-Open
**Goal:** Clicking a notification navigates and opens the right modal.

Deep-link `href` values stored at creation time:
- `inquiry.created` → `/${locale}/inquiries?inquiryId=${entityId}`
- `booking.team_assigned` → `/${locale}/bookings?detail=${entityId}`
- `booking.status_changed` → `/${locale}/bookings?detail=${entityId}`
- `team.*` → `/${locale}/teams`

The `?detail` and `?inquiryId` params are already consumed by the page components to open modals — no additional work required. Verify modal auto-opens correctly with notification href values.

---

### Phase 10 — i18n
**Goal:** All 4 locale files updated.

New key namespace `app.notifications.*` in `messages/{en,fil,ms,id}.json`:
- Bell tooltip, popover header, "Mark all read", "See all notifications", empty state
- Per-type: `title` and `body` (ICU with `{clientName}`, `{assignerName}`, etc.)
- Notifications page: heading, pagination

---

### Phase 11 — Tests, Typecheck, Lint
**Goal:** All done criteria verified.

Tests to add (in addition to Phase 2 unit tests):
- `lib/notifications/send.test.ts` — full suite (doc insert, socket emit, email non-blocking)
- `lib/db/queries/notifications.test.ts` — cursor pagination correctness, tenant isolation
- `app/api/socket-token/route.test.ts` — valid session → valid token; unauthenticated → 401

Run:
```
pnpm typecheck
pnpm lint
```

---

## Done Criteria Checklist

- [ ] Notification model + indexes
- [ ] sendNotification() (DB + Socket.io + non-blocking Resend)
- [ ] Custom server.ts with Socket.io
- [ ] useNotifications client hook in auth layout
- [ ] All 6 trigger points wired
- [ ] Bell icon + unread badge in sidebar
- [ ] Notification popover (desktop + mobile full-screen)
- [ ] Per-item read + mark-all-read actions
- [ ] /[locale]/notifications page (cursor pagination)
- [ ] Deep-link modal auto-open verified
- [ ] All 4 locale files updated
- [ ] Teams page accessible to members (read-only)
- [ ] Mobile at 375px verified
- [ ] pnpm typecheck passes
- [ ] pnpm lint passes
- [ ] Tests: sendNotification unit, tenant isolation, self-exclusion, socket room routing, Resend non-blocking

## File Count Estimate

| Action | Count |
|--------|-------|
| New files | ~18 |
| Modified files | ~12 |
| Locale files updated | 4 |
