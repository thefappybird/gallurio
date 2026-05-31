# Phase 5 — Calendar team scoping

**Status:** ✅ implemented (branch `feat/teams-bookings/phases-4-6`)
**Depends on:** Phase 4 (`Booking.teamId`, `canWriteBookingForTeam`, `resolveBookingTeamScope`, member visibility)
**Unlocks:** —

> See [README.md](./README.md) and [phases-1-3-as-built-notes.md](./phases-1-3-as-built-notes.md).

## Goal

A team picker in the bookings UI (filters both table and calendar). Members see only
their teams. Calendar events are color-separable by team in the "All teams" overlay.
Booking creation auto-fills `teamId` and is available to owners **and team leads** (lifting
the Phase-4 owner-only stopgap).

## What shipped

- **Team options helper** ([_data/team-options.ts](<../../app/[locale]/(app)/bookings/_data/team-options.ts>)):
  `getBookingTeamOptions(ctx)` → the teams a caller can see (owner: all, active+default first;
  non-owner: their own), each with `{ id, name, color, isActive, isLead }`. Inactive teams are
  included as view-only choices.
- **Team picker** ([_components/team-picker.tsx](<../../app/[locale]/(app)/bookings/_components/team-picker.tsx>)):
  a `Select` with an "all" option (owner → "All teams"; member → "All my teams"), active teams
  (color swatch + name), then inactive teams grouped below with an "Inactive" suffix. Lives in
  `bookings-toolbar.tsx` so it filters **both** views.
- **URL state:** `?team=<id|all>` (searchParams, not localStorage). `page.tsx` validates the
  param against the caller's visible teams (falls back to `all`) and narrows `listBookings`'
  `teamIds` within the caller's visibility scope.
- **Calendar color (locked):** `booking-calendar.tsx` takes `colorMode` + `teamColorMap`. When
  `?team=all` → events colored by **team color** (`Team.color`); a single team → existing
  **status colors**. All four color sites route through one `eventColor()` helper.
- **Inactive-team candles (locked):** any booking whose team isn't in the active color map renders
  in `INACTIVE_TEAM_COLOR` (a desaturated neutral, [lib/teams/team-colors.ts](../../lib/teams/team-colors.ts))
  in team mode.
- **Legends:** the status legend (which is also the clickable status **filter**) is **always**
  shown. In team mode, a read-only team color legend (active teams + an "Inactive team" entry) is
  shown *in addition* — it's a color key, not a filter (team filtering lives in the toolbar picker).
- **Wizard team selection:** `teamId` is now a first-class `WizardValues` field
  ([booking-wizard-steps/types.ts](<../../app/[locale]/(app)/bookings/_components/booking-wizard-steps/types.ts>)),
  prefilled from the active `?team`/default team. The event step shows a team `Select` when the
  caller has >1 writable team, or a read-only label for exactly one. Create-mode submit is gated
  on a chosen team. `buildCreatePayload` reads `values.teamId`.
- **Create access generalized:** `page.tsx` now sets `canCreate` = owner **or** lead of ≥1 active
  team, and passes `writableTeams` (owner: all active; lead: their active lead teams) to the
  wizard — the Phase-4 owner-only stopgap is gone. The server already enforced this via
  `canWriteBookingForTeam`.

## Tests

- `team-options.test.ts` — owner sees all (incl. inactive, writable); non-owner sees only their
  teams with `isLead` by role; deactivated membership still visible; empty for non-members;
  tenant isolation.
- `team-picker.test.tsx` — owner vs member "all" label; selected-team display; form-control mirror.
- `booking-calendar.test.tsx` / calendar helpers — `CalendarEvent.teamId` fixtures; status-mode
  unchanged.
- `booking-wizard-modal.test.tsx` — create submit requires a team (seeded default).

## Verification

```bash
pnpm typecheck && pnpm lint
pnpm test --run "app/[locale]/(app)/bookings" "app/[locale]/(app)/teams"
```
