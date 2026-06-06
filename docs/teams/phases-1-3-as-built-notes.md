# Teams Phases 1–3 — As-built notes

Phases 1–3 shipped and merged to `dev`, but the implementation **diverged from the original
`docs/teams/` plan**. The original docs assumed Teams would live as a Settings CustomPage and
that several Phase-3 primitives still needed building. This file records what was actually
built so the Phase 4–6 docs and any future work reference reality, not the original plan.

## Divergence table

| Area | Original docs assumed | Actual shipped state |
|---|---|---|
| Teams UI location | `settings/teams` CustomPage | Dedicated `app/[locale]/(app)/teams/` page + its own `OWNER_NAV` sidebar item |
| Member nav / route guards | To build in Phase 3 | **Done** — `MEMBER_NAV = [Bookings]`, `proxy.ts` `MEMBER_BLOCKED_PREFIXES` redirect members to `/bookings` |
| Main-team bootstrap | Phase 2/4 migration | **Done** — `ensureDefaultTeam` + `2026-05-default-team-bootstrap.ts`, called during onboarding |
| Team helpers | To build | `getTeamsForUser` / `isLeadOnTeam` / `isOnTeam` already in `lib/auth/teamContext.ts` |
| Booking staff field | Add `staffIds` | Already present: `Booking.staffIds: [ObjectId]` (unused; reserved for a future member-edit hook) |
| Booking status enum | `draft` from inquiries | `["inquiry","booked","completed","cancelled"]` — **no `draft`**; inquiry→booking conversion is not implemented yet. (`quoted` was later removed; see `docs/code-review/remove-quoted-status.md`) |
| Calendar view state | localStorage | URL `searchParams` (`?status=`, `?showPast=`, etc.) |
| Calendar event color | — | Status-based via `lib/bookings/status-style.ts` `STATUS_COLOR` |
| Transactions UI | "transactions list + Team column" | **No global table** — only the dashboard by-method chart + `Client.transactions[]` |
| Booking model filename | `booking.ts` | `lib/db/models/Booking.ts` (capital B) |
| Query layer | `listBookings(filters)` | `listBookings(workspaceId, filters, pagination)` in `_data/bookings-queries.ts` |
| Mutations | `app/api/bookings/route.ts` | POST `route.ts`, PATCH/GET `[id]/route.ts`, transactional |
| Roles | owner/member/lead | Workspace: owner/staff (Clerk admin/member); Team: member/lead in `TeamMembership` |
| `proxy.ts` API gating | (assumed) | `/api/*` is only `auth.protect()`ed — member route-blocking applies to **page** prefixes, not API routes (so Phase 4 scopes the booking API per-route) |

## Phase 4 note — `deleteTeamAction` was replaced

Phases 2/3 shipped a hard-delete `deleteTeamAction` on the teams page (with a `TODO(phase-4)`
to reject deletion once bookings referenced a team). Phase 4 **removed** it entirely in favor
of soft-delete (`deactivateTeamAction` / `reactivateTeamAction`) — see
[phase-4-booking-team-linkage.md](./phase-4-booking-team-linkage.md). Because teams are now
deactivated rather than deleted, the "refuse delete when bookings exist" guard is moot
(deactivation always succeeds and preserves history), and the corresponding
`docs/RELEASE-CHECKLIST.md` item was retired.

The original `phase-2-team-model-and-settings.md` and `phase-3-member-invites-and-nav.md`
files still describe the *plan* (CustomPage location, `deleteTeamAction`, etc.) and are kept
as historical record — read them against this table.
