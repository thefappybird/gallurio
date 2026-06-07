# In-App Notifications — Scope Document

Status: **Deferred** — documented for future planning. Not part of the current workflow/billing implementation.

---

## Concept

Facebook-style notification center in the app shell. Triggered by the same events that fire emails (no separate trigger logic needed — the workflow or webhook handler that sends the email also writes a notification doc). Clickable — each notification navigates to the relevant page. Unread count badge on the bell icon in the nav.

**Delivery preference: WebSockets** over polling. On connection, the server pushes new notifications without the client repeatedly hitting the DB. Lightweight for the client, avoids unnecessary reads.

---

## Notification Events

| Event | Trigger source | Click destination |
|-------|---------------|------------------|
| New inquiry submitted | `POST /api/inquiries` | `/inquiries/[id]` |
| Subscription activated / plan upgraded | Paddle webhook | `/settings/billing` |
| Subscription cancelled | Paddle webhook | `/settings/billing` |
| Team member accepted invite *(v1.1)* | Clerk webhook | `/settings/team` |
| Booking event is tomorrow *(scheduled, later)* | Cron job | `/bookings/[id]` |

---

## Data Model (proposed)

```typescript
// notifications collection
{
  _id: ObjectId,
  workspaceId: ObjectId,          // tenant scope
  recipientUserId: string,        // Clerk user ID
  type: NotificationType,         // enum matching events above
  title: string,                  // "New inquiry from Sarah Kim"
  body: string | null,            // "Wedding · June 15, 2026" (optional detail line)
  href: string,                   // app-relative path to navigate to on click
  entityType: "inquiry" | "booking" | "billing" | "team",
  entityId: ObjectId | null,      // the related document ID
  readAt: Date | null,            // null = unread
  createdAt: Date,
}

// indexes
{ workspaceId: 1, recipientUserId: 1, readAt: 1, createdAt: -1 }  // unread feed
{ workspaceId: 1, recipientUserId: 1, createdAt: -1 }              // full feed
```

---

## Architecture Notes (WebSocket approach)

- **Next.js App Router** doesn't natively support persistent WebSocket connections in Route Handlers (they're serverless). Options:
  1. **Vercel's native WebSocket support** (if available at planning time — verify)
  2. **Server-Sent Events (SSE)** as a simpler alternative: one-way push, no bidirectional needed, works in standard Route Handlers via `ReadableStream`
  3. **Separate lightweight Node server** (Express/Hono) on a different port/service — adds infrastructure complexity, avoid if SSE covers the need
  4. **Vercel Workflow DevKit `getWritable()`** — if we're already using the Workflow DevKit, its streaming primitive could power notification push

- SSE is likely the right call for MVP: simpler than WebSockets, no extra infrastructure, and notifications are one-directional (server → client). Re-evaluate WebSockets when bidirectional comms are needed (e.g. live chat, collaborative editing).

- Unread count can be fetched on page load and refreshed via SSE push — no polling needed.

---

## UI Sketch

- Bell icon in app shell nav (top right), badge showing unread count (capped at "9+")
- Click bell → dropdown panel (max-height scrollable, newest first)
- Each row: icon (type-based), title (bold if unread), body (muted), relative time ("2 min ago")
- Click row → navigate to `href`, mark as read
- "Mark all as read" button at top of panel
- Separate `/notifications` page for the full archive (infinite scroll, cursor-based)

---

## What to design when planning this

1. SSE vs WebSocket decision (check Vercel's current support at planning time)
2. Notification write helper — a single `createNotification()` function called from workflow steps and webhook handlers, never duplicated
3. The SSE/WebSocket Route Handler and connection management
4. UI components: bell icon with badge, notification panel, notification row
5. Read/unread state management (optimistic mark-as-read)
6. All four active locales for notification title/body strings
7. Notification preferences per workspace (which types to enable) — optional, can ship with all-on default

---

## Out of scope for this doc

- Push notifications (browser/mobile) — v2+
- Email digest / batching — v2+
- Per-notification mute — v2+
