# Teams Management — Phases 4-6 Re-Plan (docs only)

> Planning reference for the next stage of Teams. This re-plan supersedes the original
> `phase-4/5/6` docs where they conflict — it reflects the **as-built** system (dedicated `/teams`
> page, shipped member nav/route guards, existing Main-team bootstrap) and adds the soft-delete
> (deactivation) decision. Implementation happens later in separate per-phase code branches.

## Context

Teams (Phases 1-3) are already built and merged into `dev`, but the **implementation diverged
from the original `docs/teams/` plan**. The original docs assumed teams would live as a Settings
CustomPage and that several Phase-3 primitives still needed building. In reality:

- Teams have a **dedicated top-level page** at `app/[locale]/(app)/teams/` with its own `OWNER_NAV`
  sidebar item (not `settings/teams`).
- The **member-restricted sidebar** (`MEMBER_NAV = [Bookings]`) and **`proxy.ts` role redirects**
  already ship (members are bounced from owner-only routes to `/bookings`).
- **`ensureDefaultTeam` + an existing backfill migration** mean every workspace already has a
  "Main" team. New workspaces get one during onboarding.
- `getTeamsForUser` / `isLeadOnTeam` / `isOnTeam` already exist in `lib/auth/teamContext.ts`.

This task **re-plans Phases 4, 5, and 6** so they account for the as-built system, then writes the
updated plan docs into `docs/teams/`. **No application code is written in this branch** — this is a
documentation/planning branch only. Implementation happens later, in separate per-phase branches.

The three phases cover the data/feature layer that ties teams to real work:
- **Phase 4** — link every booking to a team; **convert team deletion to deactivation (soft-delete)**;
  enforce member visibility + edit permissions.
- **Phase 5** — surface team scoping in the calendar (picker incl. inactive teams, color, auto-fill).
- **Phase 6** — attribute transactions to the team that worked the booking.

**Cross-cutting decision — teams are never hard-deleted.** Once bookings/transactions reference a
team, removing the row would create record-keeping mismatches when the owner looks back. Teams are
**deactivated** instead: the row and its history survive forever; deactivated teams behave like the
old "deleted" state for new work (not assignable, hidden by default) but remain fully resolvable for
display. This replaces the existing `deleteTeamAction` (shipped in Phase 2/3) and is implemented as
the first part of Phase 4.

---

## As-built reality the docs must reflect (verified)

| Area | Original docs assumed | Actual current state |
|---|---|---|
| Teams UI location | `settings/teams` CustomPage | Dedicated `app/[locale]/(app)/teams/` page + `OWNER_NAV` item |
| Member nav / route guards | To build in Phase 3 | **Done** — `MEMBER_NAV`, `proxy.ts` `MEMBER_BLOCKED_PREFIXES` |
| Main-team bootstrap | Phase 2/4 migration | **Done** — `ensureDefaultTeam` + `2026-05-default-team-bootstrap.ts`, called in onboarding |
| Booking staff field | Add `staffIds` | Already present: `Booking.staffIds: [ObjectId]` (unused) |
| Booking status enum | `draft` from inquiries | `["inquiry","quoted","booked","completed","cancelled"]` — **no `draft`** |
| Calendar view state | localStorage | URL `searchParams` (`?status=`, `showPast`) |
| Calendar event color | — | Status-based via `lib/bookings/status-style.ts` `STATUS_COLOR` |
| Transactions list UI | "transactions list + Team column" | **No global table** — only dashboard by-method chart + `Client.transactions[]` |
| Booking model filename | `booking.ts` | `lib/db/models/Booking.ts` (capital B) |
| Query layer | `listBookings(filters)` | `listBookings(workspaceId, filters, pagination)` in `_data/bookings-queries.ts` |
| Mutations | `app/api/bookings/route.ts` | POST `route.ts`, PATCH/GET `[id]/route.ts`, transactional |
| Roles | owner/member/lead | Workspace: owner/staff (Clerk admin/member); Team: member/lead in `TeamMembership` |

---

## Key files (verified paths)

- Booking model: `lib/db/models/Booking.ts` (has `staffIds`, `sessions[]`, `firstSessionStart`)
- Booking validators: `lib/validators/booking.ts` (`bookingCreateSchema`, `bookingPatchSchema`)
- Booking queries: `app/[locale]/(app)/bookings/_data/bookings-queries.ts` (`listBookings`, `getBookingById`)
- Booking mutations: `app/api/bookings/route.ts` (POST), `app/api/bookings/[id]/route.ts` (PATCH/GET)
- Booking UI: `_components/booking-wizard-modal.tsx`, `booking-detail-modal.tsx`, `calendar-view.tsx`,
  `booking-calendar.tsx` (RBC + `CalendarToolbar`), `bookings-toolbar.tsx`, `bookings/page.tsx`
- Auth: `lib/auth/requireOrg.ts` (role owner/staff), `lib/auth/ownerContext.ts`,
  `lib/auth/teamContext.ts` (`getTeamsForUser`, `isLeadOnTeam`, `isOnTeam`)
- Transaction model: `lib/db/models/Transaction.ts` (has `bookingId`, no `teamId`)
- Transaction writes: `lib/db/clientTransactions.ts` (`recordBookingForClient`, `reassignBookingBetweenClients`)
- Transaction display: `dashboard/_components/transactions-by-method-bar.tsx`, `dashboard/_data/dashboard-metrics.ts`
- Migrations: `lib/db/migrations/*.ts` run via `pnpm tsx <file>`; reference `2026-05-multi-session-bookings.ts`
- ActivityLog: `lib/db/models/ActivityLog.ts` (inline `ActivityLog.create`, no `team` entity yet)
- Cron: `vercel.json` (one cron today)

---

## Deliverable (for the eventual code branches)

When these phases are implemented, the planning docs to maintain in `docs/teams/` are:

1. `docs/teams/phase-4-booking-team-linkage.md` (to be rewritten from §Phase 4 below)
2. `docs/teams/phase-5-calendar-team-scoping.md` (to be rewritten from §Phase 5 below)
3. `docs/teams/phase-6-transaction-team-attribution.md` (to be rewritten from §Phase 6 below)
4. `docs/teams/phases-1-3-as-built-notes.md` (the divergence table above)
5. `docs/teams/README.md` (light edit — fix the "settings panel" references + status markers)

No `.ts`/`.tsx` files are created or modified for planning.

---

## Planned content of each phase

### Phase 4 — Team soft-delete + Booking ↔ Team linkage + member visibility

**Scope:** teams become deactivatable (never hard-deleted); every booking carries `teamId`; existing
bookings backfilled to Main; non-owner visibility + edit gating centralized.

**4a — Team deactivation (replaces hard delete on the existing teams page):**
- **Model** (`lib/db/models/team.ts`): add `isActive: boolean` (default `true`, indexed via
  `{workspaceId, isActive}`) and `deactivatedAt: Date | null` (audit timestamp). Keep the existing
  unique `{workspaceId, name}` index — a deactivated team's name **stays reserved** (record-keeping).
- **Actions** (`app/[locale]/(app)/teams/_actions.ts`): **remove `deleteTeamAction`**; add
  `deactivateTeamAction` (set `isActive:false`, `deactivatedAt:now`; **refuse** on the default/Main
  team) and `reactivateTeamAction` (set `isActive:true`, `deactivatedAt:null` — refuse if doing so
  would exceed the plan's active-team cap). Deactivation is always allowed regardless of how many
  bookings reference the team (that's the whole point — no data is touched).
- **Plan cap counts ACTIVE teams only:** update `lib/auth/assertCanAddTeam.ts` +
  `createTeamWithCapEnforcement` to count `{workspaceId, isActive:true}`. Dead teams never block
  creating new ones.
- **Teams table UI** (`teams-table.tsx` + `team-dialogs.tsx`): replace the delete dialog with a
  deactivate/reactivate confirm. Add a **"Show deactivated" toggle**; deactivated rows render with an
  **`[inactive]` pill** and a "Reactivate" action. Default view hides deactivated teams.
- **i18n:** swap `teams.deleteDialog.*` → `teams.deactivateDialog.*` / `teams.reactivate.*` and add
  the inactive-pill + toggle strings across `messages/{en,fil,ms,id,th}.json`.

**4b — Booking ↔ Team linkage:**
- **Model** (`Booking.ts`): add `teamId: ObjectId (ref Team, indexed)`. Add compound indexes
  `{workspaceId, teamId, firstSessionStart}` and `{workspaceId, teamId, status, firstSessionStart}`;
  verify with `explain` before dropping any existing index.
- **New bookings target ACTIVE teams only;** existing bookings may reference a since-deactivated team
  and keep it. The create-booking team validation rejects an inactive `teamId`.
- **Member capability: VIEW-ONLY for MVP (locked).** Non-lead members can see all bookings in their
  teams but cannot edit. No staff-assignment UI is built; `staffIds` stays unused (left in schema).
- **Validators** (`lib/validators/booking.ts`): `bookingCreateSchema` requires `teamId`; server
  validates the team belongs to the workspace, **is active**, and the caller may write to it (owner,
  or lead/member of that active team).
- **`canEditBooking`** (`lib/auth/canEditBooking.ts`, new): owner → always (incl. bookings whose team
  was later deactivated, so they can reassign); lead of `booking.teamId` **while that team is active**
  → yes; otherwise no. The `staffIds`-based member-edit branch is documented as a **future hook**
  (dormant until a later phase adds staff assignment) — not wired in MVP.
- **Queries** (`bookings-queries.ts`): add optional `teamIds` filter. Because `listBookings` takes
  `workspaceId` (not full ctx), **callers (`page.tsx`) resolve `getTeamsForUser` and pass
  `allowedTeamIds` for non-owners**; `getBookingById` gains an `allowedTeamIds?` guard.
- **Mutations**: POST/PATCH apply `canEditBooking`; POST persists `teamId`.
- **Migration** (`lib/db/migrations/2026-XX-bookings-team-backfill.ts`): set `teamId = Main team`
  for every booking with null `teamId`; idempotent, batched cursor, `--dry-run`. (Main team already
  guaranteed by Phase 2 — no need to re-create.) Rebuilding `Team.memberCount` is **not** needed
  here (already maintained by the invite flow).
- **Tests:** tenant + team isolation (member sees only their teams; cannot fetch other-team booking
  by id; owner sees all); `canEditBooking` truth table; validator requires `teamId`.

### Phase 5 — Calendar team scoping

**Scope:** team picker in the bookings UI; members see only their teams; create auto-fills `teamId`.

- **Team picker** (`_components/team-picker.tsx`, new): owner → all teams + "All teams";
  member → their teams + "All my teams". **Deactivated teams still appear as choices** (so the owner
  can review past work) rendered as `[team name] [inactive]` pill; active teams come first, inactive
  ones grouped below. Selecting an inactive team is view-only (no create).
- **State persistence:** follow the existing **URL `searchParams`** convention (`?team=<id|all>`),
  **not** localStorage (divergence from original doc). Validate the param against the user's team
  list on the server; fall back to `all`.
- **Placement:** add `<TeamPicker>` to `bookings-toolbar.tsx` (and/or the in-calendar
  `CalendarToolbar`). `page.tsx` reads `?team`, resolves allowed teams, passes `teamIds` to
  `listBookings`.
- **Event color (locked):** when "All teams" is active, color events by **team color**
  (`Team.color`) so teams are visually separable; when a single team is selected, keep the existing
  **status colors**. `booking-calendar.tsx` accepts a `teamColorMap` + a `colorMode` flag; a small
  legend maps colors → team names in the "All teams" view.
- **Inactive-team candles (locked):** any booking whose `teamId` resolves to a **deactivated** team
  renders in a dedicated neutral/desaturated "inactive" color (a semantic token, e.g. `--muted`
  family — distinct from every active team color and from status colors) in **both** color modes, so
  records on retired teams read as clearly archival. The legend labels it "Inactive team".
- **Create auto-fill:** wizard (`booking-wizard-modal.tsx` + steps `types.ts`) gains `teamId` in
  `WizardValues`, pre-filled from the active `?team`; if `all`, default to caller's first team
  membership (owner → Main). Owners get a small in-wizard team picker; members with one team see it
  read-only.
- **Tests:** team-picker smoke (owner vs member option sets); searchParam validation/fallback;
  wizard defaults `teamId` correctly.

### Phase 6 — Transaction team attribution

**Scope:** denormalize `teamId` on transactions at write time; surface it where transactions show;
survive team rename/deactivate.

- **Model** (`Transaction.ts`): add `teamId: ObjectId | null` (denormalized, never populated). Add
  index `{workspaceId, teamId, paidAt: -1}`.
- **Write sites** (`lib/db/clientTransactions.ts`): `recordBookingForClient` and
  `reassignBookingBetweenClients` already hold the booking — set `teamId = booking.teamId` at create.
  Optionally carry `teamId` into the `Client.transactions[]` summary entries.
- **Surface (locked):** there is **no global transactions table** today, and we are **not** adding
  one. Show the team (color dot + name) in the **client-detail transaction list**, and add a `teamId`
  group option to the dashboard's transaction metrics. No new transactions route/page.
- **No orphans by design:** because teams are soft-deleted (Phase 4), a transaction's `teamId`
  **always resolves** to a real Team row — historical attribution never breaks. When that team is
  deactivated, render its name with an `[inactive]` pill (same treatment as the calendar/picker),
  not a "deleted" placeholder. Denormalizing `teamId` still matters so a future **team rename** is
  reflected by re-reading the live Team (we store the id, read the current name/color).
- **Migration** (`2026-XX-transactions-team-backfill.ts`): for each Transaction with `bookingId`
  and null `teamId`, set `teamId = booking.teamId`; idempotent, `--dry-run`.
- **Tests:** write-time denormalization; backfill idempotency; transaction on a deactivated team
  renders name + `[inactive]` pill (never null/"deleted").

---

## Verification

Implementation-time verification per code branch (documented in each phase file when rewritten):
`pnpm typecheck`, `pnpm lint`, targeted `pnpm test --run <fragment>`, then `pnpm build` on the
pre-merge sweep. Tenant-isolation + team-isolation tests are mandatory for every new query/model.

---

## Decisions (locked)

1. **Member edits — view-only for MVP.** Owners/leads edit; members view. `staffIds` left unused;
   `canEditBooking` documents the member-edit path as a dormant future hook.
2. **Phase 6 surface — client-detail list + dashboard grouping.** No new transactions page/table.
3. **Calendar color — team color on "All teams", status color on a single team.** With a legend.
4. **Doc handling — overwrite `phase-4/5/6` in place** at implementation time, add
   `phases-1-3-as-built-notes.md`, lightly fix `README.md`. Git history preserves the originals.
5. **Teams are soft-deleted (deactivate), never hard-deleted.** Replaces the shipped
   `deleteTeamAction`. Deactivated teams: hidden by default (with a "Show deactivated" toggle +
   `[inactive]` pill in the teams table), excluded from the active-team plan cap, not assignable to
   new bookings, still selectable in the calendar team picker (as `[name] [inactive]`), and rendered
   with a dedicated neutral candle color on the calendar. The Main/default team can never be
   deactivated. Phase 4 removes `deleteTeamAction` from the as-built teams page.
