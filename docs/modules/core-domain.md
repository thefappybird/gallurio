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
