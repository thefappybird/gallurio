# Phase 5 — Calendar team scoping

**Status:** planned (not started)
**Depends on:** Phase 4 (`Booking.teamId`, `canWriteBookingForTeam`, `resolveBookingTeamScope`, member visibility)
**Unlocks:** —

> See [README.md](./README.md) and [phases-1-3-as-built-notes.md](./phases-1-3-as-built-notes.md).
> Phase 4 already ships server-side team write-permission and read-scoping; Phase 5 is the
> **UI layer** that surfaces team selection and lets leads/members create.

## Goal

A team picker in the bookings UI. Members see only their teams. Booking creation auto-fills
`teamId`. Calendar events are visually separable by team.

## Scope

- **Team picker** (`_components/team-picker.tsx`, new): owner → all teams + "All teams";
  member → their teams + "All my teams". **Deactivated teams still appear as choices** (so the
  owner can review past work), rendered as `[name] [inactive]`, active first then inactive.
  Selecting an inactive team is **view-only** (no create — the server already rejects new work
  on inactive teams).
- **State persistence:** follow the existing **URL `searchParams`** convention (`?team=<id|all>`),
  not localStorage. Validate `?team` against the caller's team list on the server; fall back to
  `all`. The page already resolves the visibility scope via `resolveBookingTeamScope` — narrow
  it further when a specific team is selected.
- **Placement:** add `<TeamPicker>` to `bookings-toolbar.tsx` (and/or the in-calendar
  `CalendarToolbar`). `page.tsx` reads `?team`, resolves allowed teams, passes `teamIds` to
  `listBookings`.
- **Event color (locked):** when "All teams" is active, color events by **team color**
  (`Team.color`) so teams are visually separable; when a single team is selected, keep the
  existing **status colors** (`STATUS_COLOR`). `booking-calendar.tsx` accepts a `teamColorMap`
  + a `colorMode` flag; a small legend maps colors → team names in the "All teams" view.
- **Inactive-team candles (locked):** any booking whose team resolves to a **deactivated** team
  renders in a dedicated neutral/desaturated color (a semantic token, e.g. the `--muted` family)
  in **both** color modes, so retired-team records read as archival. Legend label: "Inactive team".
- **Create auto-fill:** the wizard (`booking-wizard-modal.tsx` + steps `types.ts`) gains a
  first-class `teamId` in `WizardValues`, pre-filled from the active `?team`; if `all`, default
  to the caller's first team membership (owner → Main). Owners get a small in-wizard team picker;
  members with one team see it read-only. This **replaces the Phase-4 stopgap** (where create was
  owner-only and `teamId` was hard-defaulted to Main) — leads/members can now create for their
  active teams (the server already permits this via `canWriteBookingForTeam`).

## Tests

- Team-picker smoke (owner vs member option sets; inactive grouped + view-only).
- `?team` searchParam validation/fallback to `all`.
- Wizard defaults `teamId` correctly; members with one team are read-only; inactive selection
  blocks create.
- Calendar color mode switch (team color on "All teams", status color on single team; inactive
  neutral candle in both).

## Verification

```bash
pnpm typecheck && pnpm lint
pnpm test --run team-picker calendar "app/[locale]/(app)/bookings"
```
