# Phase 5 — Calendar Team Scoping

**Status:** not started
**Depends on:** Phase 3 (member sidebar + `getTeamsForUser`), Phase 4 (`Booking.teamId` + visibility filter)
**Unlocks:** —

> See [README.md](./README.md) for context, locked decisions, and architecture summary.

## Goal

Team selector in the calendar toolbar. Members see only their teams. Booking creation auto-fills `teamId` from the active calendar context. Color-coded overlay when "All teams" is selected.

## Files to create

- `app/[locale]/(app)/bookings/_components/team-picker.tsx` — controlled dropdown.
- `app/[locale]/(app)/bookings/_components/team-picker.test.tsx`.

## Files to modify

- `app/[locale]/(app)/bookings/_components/booking-calendar.tsx` — accept `teamColorMap: Record<teamId, hex>` and render event chips in their team color. No filter UI here; that lives in the toolbar.
- `app/[locale]/(app)/bookings/_components/calendar-view.tsx` — add `activeTeamId: string | "all"` state, persist to localStorage. Default `"all"` (member: all-my-teams overlay; owner: all-workspace-teams overlay). Pass to `listBookings` filter.
- `app/[locale]/(app)/bookings/_components/bookings-toolbar.tsx` (or wherever the toolbar lives) — add a `<TeamPicker>` dropdown:
  - Owner: lists all workspace teams + "All teams".
  - Member: lists only their teams + "All my teams".
- `app/[locale]/(app)/bookings/_components/booking-wizard-modal.tsx` and `booking-wizard-steps/event-step.tsx` — read `activeTeamId` from URL/context; pre-fill the create-booking payload. If `activeTeamId == "all"`, default to the user's first team membership (or the workspace's Main team for owners) and surface a small "Team: Main ▾" picker in the wizard.
- `app/[locale]/(app)/bookings/page.tsx` — pass team list + active team to the calendar.

## Acceptance / verification

```bash
pnpm test --run calendar
pnpm test --run team-picker
pnpm dev
```

Manual matrix to walk through:
- Owner with 3 teams: sees "All teams" overlay; switches to one team; creates booking → teamId set.
- Member of 2 teams: sees "All my teams" overlay; switches; creates booking → teamId set to active team.
- Lead in 1 team: can edit any booking in their team; member with no `staffIds` match cannot.

## Risks

- `localStorage`-persisted `activeTeamId` may point at a team the user lost access to. On mount, validate against the team list and fall back to `"all"`.
