# Perf audit: memoization — score 5/10

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
