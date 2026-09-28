# Perf audit: memoization — score 5/10

> **Status as of 1.5.0 (2026-09-28) — closed for this release.**
> - **Declined (measured, not assumed):** `memo()` on the Puck block renderers in `manualBlocks.tsx` would be a no-op, because Puck 0.23's `MemoizeComponent` already wraps every canvas block.
> - **Fixed instead:** the editor config and the Puck `metadata` object are memoized in `EditorShell`, so the props Puck compares stay stable across renders (`db2eeadf`, PR #109).
> - **Not measured:** the React Profiler count of commits per unedited block needs DevTools and was never captured.
> - **Still open (outside this release's scope):** `booking-calendar.tsx`'s `MonthBookingEvent` / `TimeBookingEvent` are still unmemoized. Carried into `docs/modules/core-domain.md` → "Known gaps".

## What's working
- `useMemo`/`useCallback` are used and placed sensibly, not neglected at the hook level: 65 `useMemo(` and 93 `useCallback(` calls across `app/`, `components/`, `lib/page-builder/`.
- Concentrated in the right places: `booking-calendar.tsx` (`displayEvents`, `calendarComponents`), `calendar-view.tsx` (`visibleEvents`, `eventsWithConflicts`), `bookings-table.tsx`/`clients-table.tsx` (`columns`), `EditorShell.tsx` (`editorConfig`, `puckStableOverrides`, `chromeSyncCtxValue`), `MediaPicker.tsx` (`selection`, `byPickerId`).

## Gaps
- **Zero `React.memo`/`memo()` usage anywhere in the repo** (confirmed via grep — no file matches `\bmemo\(`). Every component re-renders whenever its parent re-renders, regardless of whether its own props changed.
- This bites hardest on the two surfaces with the most re-render churn:
  - **Puck editor canvas** — `lib/page-builder/blocks/manualBlocks.tsx` block renderers (`HeadingBlock:132`, `TextBlock:215`, `ImageBlock:318`, `ButtonBlock:515`, etc.) are plain unmemoized function components. Puck re-renders the whole tree on every drag/prop edit, so every block re-renders on every interaction regardless of which block actually changed. `lib/page-builder/editorConfig.tsx` has no memoization at all.
  - **`booking-calendar.tsx`** — `MonthBookingEvent:332` and `TimeBookingEvent:439` are plain unmemoized function components. The `calendarComponents` object binding them is itself wrapped in `useMemo` (line 1024) so the wrapper reference is stable, but the event components it renders still re-render on every calendar re-render since they're not wrapped in `memo()`.

## Fix direction
Wrap the Puck block renderers in `manualBlocks.tsx` and the calendar event components (`MonthBookingEvent`, `TimeBookingEvent`) in `memo()`. These are the two highest re-render-count surfaces in the app and currently get zero benefit from the `useMemo`/`useCallback` work already done one level up.
