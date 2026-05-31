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
- **Team filter — MULTI-select, two presentations** (mirrors the old status legend/dropdown split).
  `?team` is a comma-separated list of team ids; empty = all. The shared multi-toggle UI is
  [team-legend.tsx](<../../app/[locale]/(app)/bookings/_components/team-legend.tsx>): an "All teams"
  chip (clears) + one toggle chip per team (swatch + name); multiple teams can be active at once.
  - **Table view:** a dropdown ([team-picker.tsx](<../../app/[locale]/(app)/bookings/_components/team-picker.tsx>))
    — a Popover whose panel is the team legend; the trigger summarizes the selection ("All teams" /
    a single team name / "N teams").
  - **Calendar view:** the same team legend rendered inline — the calendar's filter AND color key.
- **URL state:** `?team=<id|all>` (searchParams, not localStorage). `page.tsx` validates the
  param against the caller's visible teams (falls back to `all`) and narrows `listBookings`'
  `teamIds` within the caller's visibility scope.
- **Calendar candle color:** candles are always **team-colored** (`Team.color`) so the clickable
  team legend's swatches map to candles. A booking whose team isn't in the active color map (a
  deactivated team) renders in `INACTIVE_TEAM_COLOR` (a desaturated neutral,
  [lib/teams/team-colors.ts](../../lib/teams/team-colors.ts)). All color sites route through one
  `eventColor()` helper.
- **Status moved off the legend:** the clickable status legend was **retired**. Status is now (a)
  a plain dropdown in the toolbar in **both** views, and (b) shown per-candle as a **status pill**
  (a light chip + status-color dot + status name, pinned bottom-right) on every calendar candle and
  overflow-popover row. This frees the calendar's legend slot for the team filter.
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
