# Perf audit: clients & teams tables

Scope: `app/[locale]/(app)/clients/`, `app/[locale]/(app)/teams/`, `components/app/table-skeleton.tsx`.

## What's working
- `clients-table.tsx` is the reference implementation: `@tanstack/react-table` headless,
  `columns` in `useMemo`, server-paginated via `page`/`limit` searchParams, `<th scope="col"
  aria-sort={...}>` with a real `<button>` sort trigger, desktop `<tr role="button" tabIndex={0}
  onKeyDown>` keyboard-operable rows.
- `components/app/table-skeleton.tsx` (`TableSkeleton`) is the one genuinely reusable,
  viewport-aware skeleton in the app — column-count-aware, `useViewportRemainingHeight`-driven
  row count, tuned `TABLE_ROW_HEIGHT`/`TABLE_HEADER_HEIGHT` constants that closely match real
  `<td>` padding. Already shared by clients/teams/bookings/inquiries.
- No `memo()` anywhere in either module (repo-wide, confirmed still true) but no avatar/image
  handling exists here either — no `next/image` gap to report.

## Gaps
- **Clients**: `clients/loading.tsx` hardcodes `TableSkeleton rows={8}` against a real default
  page size of 10 (`clients/page.tsx`) — mismatch on cold nav only (the in-page transition
  skeleton in `clients-page-client.tsx` already correctly uses `rows={limit}`). Row content
  itself varies 1-3 lines (name/tags/subtext) against the skeleton's flat 1-line assumption —
  rows with tags render taller than the skeleton row.
- **Teams**: no server pagination at all — `teams/page.tsx` loads every team, filtered
  client-side (`teams-page-client.tsx`'s `filteredTeams` `useMemo`). `teams/loading.tsx`'s
  `TableSkeleton rows={6}` is disconnected from real team count by construction. Desktop
  `<th>` (`teams-table.tsx`) has no `scope="col"`, no `aria-sort`; sort is triggered by `onClick`
  on a bare `<th>` — not keyboard-reachable. Desktop `<tr>` has no `role="button"`/`tabIndex`/
  `onKeyDown` — mouse-only, a regression relative to Teams' own mobile card list (which has all
  three). `view-members-sidebar.tsx` re-implements a third pagination variant (component state,
  not URL params) over an unbounded in-memory member/invite list.
- No shared `<Pagination>` component anywhere — the Previous/Next + "Showing X-Y of Z" control
  is hand-duplicated across `clients-page-client.tsx`, `bookings-page-client.tsx`,
  `inquiries-page-client.tsx` (three URL-driven copies) plus `view-members-sidebar.tsx`'s
  fourth, state-driven variant.
- `member-details-dialog.tsx`'s activity `load()` has no cancellation guard (unlike
  `client-detail-modal.tsx`'s `cancelled` flag) — a fast tab/filter toggle can let a stale
  response overwrite state.
- `remove-member-dialog.tsx:133` sets `aria-describedby` referencing an id that isn't always
  rendered (dangling reference in the lead-without-other-teams case).
- `components/ui/dialog.tsx`'s default close button (`sr-only "Close"`) is a hardcoded English
  literal — surfaces on every teams-module dialog that doesn't opt out (clients dialogs do
  opt out and supply their own localized label).

## Reviewed and declined
- Teams' fully-client-side, uncapped team/member filtering: not actioned — team and member
  counts are already entitlement-capped (`lib/plans/entitlements.ts`,
  `assertCanAddTeam`/`assertCanAddTeamMember`), so "unbounded" is bounded in practice.

## Fix direction
Migrate Teams onto real server pagination (`page`/`limit` searchParams, `PAGE_SIZE_OPTIONS`),
matching Clients exactly; extract one shared `<Pagination>` (URL-driven + controlled mode) and
repoint all four call sites; bring `teams-table.tsx`'s header/row markup up to
`clients-table.tsx`'s a11y bar; fix both route-level skeletons to derive row count from the
real page size instead of a hardcoded guess; add the missing cancellation guard and fix the
dangling `aria-describedby`; localize the shared dialog's default close-button label.
