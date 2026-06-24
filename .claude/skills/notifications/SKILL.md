---
name: notifications
description: How Gallurio delivers in-app notifications — the sendNotification flow, the actor-silent rule, recipient resolution, the Notification model + socket.io transport, localized ICU copy, and every trigger. Use when adding, editing, or debugging a notification, or when touching lib/notifications/* or the notification UI.
---

# Notifications

In-app bell/toast notifications. Persisted to Mongo and pushed live over
socket.io. Separate from email (see the `emails` skill), but the two are dispatched
together from `sendNotification`. Code lives in `lib/notifications/`,
`lib/db/models/Notification.ts`, and `components/notifications/`.

## The flow (`lib/notifications/send.ts`)

`sendNotification(opts): Promise<void>` where `opts` is `SendNotificationOptions`:
`{ workspaceId, recipients, type, entityId, entityType, triggeredByWorkosUserId,
locale, vars? }`.

1. Returns early if `recipients` is empty.
2. For each recipient, `buildNotificationContent(type, locale, entityId,
   entityType, vars)` renders `{ title, body, href }` from the ICU message
   catalog.
3. **Persist first, always:** `Notification.insertMany(payloads)` runs
   unconditionally — even when `getIO()` is undefined — so recipients see the
   notification on next login via the DB list.
4. **Then emit (best-effort):** for non-actors with a live socket, emit
   `notification:new` to room `user:<workosUserId>`.
5. **Then email (best-effort):** for non-actors, fire `sendNotificationEmail()`
   (`.catch(() => {})`).

DB persistence always precedes socket/email — durability is guaranteed even if the
socket server is down.

## Actor-silent rule (the core invariant)

The user who triggered the event (`triggeredByWorkosUserId`) gets a **pre-read,
silent** record; everyone else gets a **loud** one.

In `send.ts`, per recipient `isActor = r.workosUserId === triggeredByWorkosUserId`:
- Actor record: `read: true`, `readAt: new Date()`, `silent: true`. **No** socket
  emit, **no** email.
- Non-actor record: `read: false`, `readAt: null`, `silent: false`. Socket emit +
  email.

Client side (`components/notifications/NotificationProvider.tsx`) only bumps the
unread badge for `!silent && !read`. So the actor's own action shows up in their
list (on next fetch) without animating the bell or incrementing the count.

## Recipients (`lib/notifications/recipients.ts`)

Resolve recipients with the shared helpers — both dedupe by `workosUserId` and are
tenant-scoped:
- `resolveTeamRecipients(workspaceId, teamId)` → all team members (joined to
  `User` for email/name), `[]` if none.
- `resolveStatusChangeRecipients({ workspaceId, teamId?, ownerUserId, ownerEmail? })`
  → team members + workspace owner, deduped (owner may already be a member).

## Model (`lib/db/models/Notification.ts`)

Fields: `workspaceId` (ObjectId), `recipientWorkosUserId`, `type` (enum),
`entityId` (ObjectId), `entityType` (`inquiry`/`booking`/`team`),
`triggeredByWorkosUserId`, `read`, `readAt`, `silent`, `title`, `body`, `href`,
`createdAt` (timestamps, no `updatedAt`).

Indexes (both start with `workspaceId`, tenancy rule):
- `{ workspaceId, recipientWorkosUserId, read, createdAt: -1 }` (unread queries)
- `{ workspaceId, recipientWorkosUserId, createdAt: -1 }` (list)

`SerializedNotificationPayload` (over the wire): `{ _id, type, title, body, href,
entityId, entityType, read, readAt, silent?, createdAt }`.

## Transport (socket.io)

- Server singleton via `lib/sockets/io.ts` (`getIO()`); rooms are
  `user:<workosUserId>`.
- `NotificationProvider` connects on mount and listens for `notification:new`,
  `notification:read`, `notification:readAll`; falls back to DB fetch when the
  socket is unavailable.

## Types & triggers

`NotificationType` (`lib/notifications/types.ts`): `inquiry.created`,
`booking.team_assigned`, `booking.status_changed`, `team.invitation`,
`team.removed`, `team.deleted`. `NotificationVars`: `clientName`, `assignerName`,
`inviterName`, `teamName`, `actorName`, `newStatus`.

| Type | Trigger site | Recipients |
|---|---|---|
| `inquiry.created` | `lib/server/inquirySubmission.ts` | owner / team |
| `booking.team_assigned` | `app/api/bookings/[id]/route.ts`, inquiry approve `_actions.ts` | team |
| `booking.status_changed` | `app/api/bookings/[id]/route.ts` | `resolveStatusChangeRecipients` |
| `team.invitation` | `teams/_invite-action.ts` | invited user |
| `team.removed` | `teams/_member-action.ts` | removed user |
| `team.deleted` | `teams/_actions.ts` | team members |

## Styling / UI

`components/notifications/` (`NotificationProvider`, popover/list, bell badge).
Use semantic tokens only (brand teal for the unread accent/badge, `bg-accent/30`
for unread rows). Ship all four async states (loading, empty "you're all caught
up", error, populated) and read/unread states. Mobile-first at 375px; the popover
is full-screen on mobile.

## Locales

Copy is ICU in the i18n catalog under `app.notifications.types.<entity>.<type>.{title,body}`
(`messages/{en,fil,ms,id}.json`), resolved via
`buildNotificationContent` → `getTranslations`. Update all four locales together;
never `th`.

Known convention: `booking.status_changed` is dispatched with `locale: "en"`
hardcoded at its call sites even though all four locales exist — matches the
platform-email convention. Preserve unless deliberately changing.

## Adding a new notification type — checklist

1. Add to `NotificationType` in `types.ts` **and** the model enum in
   `Notification.ts`.
2. Add any new `NotificationVars` field.
3. Add ICU `title`/`body` to all four locale files under
   `app.notifications.types.…`.
4. Add href routing in `lib/notifications/messages.ts`.
5. Resolve recipients with the shared helpers; call `sendNotification` at the
   trigger with `triggeredByWorkosUserId` set so the actor stays silent.
6. Tenant-scope every query by `workspaceId`. Add a test; pass typecheck/lint.
