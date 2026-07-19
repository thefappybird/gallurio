---
name: optimistic-rendering
description: How Gallurio does optimistic UI for mutations in tables AND calendars — apply the change locally first, toast loading/success/error, revert on error, and resync from server props WITHOUT clearing the optimistic state too early. Use this WHENEVER you add or touch an optimistic update: drag-to-reschedule on a calendar, a row edit/status-change/delete in a table, a toggle, or any server-action whose result the user should see instantly. Read it before editing calendar-view.tsx, inquiries-calendar-manager.tsx, inquiries-page-client.tsx, teams-page-client.tsx, or adding a new optimistic flow — it documents the one snap-back bug that keeps recurring and how to avoid it.
---

# Optimistic rendering (tables + calendars)

Goal: the user sees their change *immediately*, the server confirms in the background, and
the UI silently reconciles to the authoritative data — or reverts with an error toast. The
recurring bug is **clearing the optimistic layer before the fresh server data has arrived**,
which exposes stale data for a frame (a visible snap-back).

## The shape (all variants share it)
1. Hold an optimistic layer in state (array, `Map<id,override>`, patch-map, or `useOptimistic`).
2. On the user action, apply the change to that layer **synchronously** (before awaiting).
3. Run the server action inside `toast.promise({ loading, success, error })`.
4. On **error**, revert the optimistic layer to the saved previous value (and the toast shows why).
5. On **success**, let fresh server data drive reconciliation — **do not eagerly delete the
   optimistic layer and then trigger a refresh in the same tick.** Keep it applied until the new
   server props arrive, then clear/prune.

## ❌ The anti-pattern (the inquiries-calendar snap-back, now fixed)
```ts
// success path:
setOverrides(prev => { const n = new Map(prev); n.delete(id); return n; }); // clears NOW
router.refresh();                                                            // data arrives ~500ms later
```
Between the delete and the refreshed props, the merge (`events.map(e => overrides.get(e.id) ?? e)`)
falls back to the **old** server position → the candle visibly jumps back to source, then to
target. The fix keeps the override alive and clears it only when the new `events` prop lands:
```ts
const prevEventsRef = useRef(events);
useEffect(() => {
  if (events !== prevEventsRef.current) {           // fresh server data arrived
    prevEventsRef.current = events;
    setOverrides(prev => (prev.size ? new Map() : prev)); // clear in the same render → no gap
  }
}, [events]);
// success path now only calls router.refresh(); error path still reverts to prevEvent.
```

## The four concrete variants in this repo (copy the closest one)

**A. Array-replace + `useEffect` resync — calendars.**
`bookings/_components/calendar-view.tsx`. `optimisticEvents` state seeded from the `events`
prop; a `useEffect([events])` with a `prevEventsRef` resyncs when the server prop changes.
Drag handler saves `prev`, maps the array to the new position, runs `toast.promise`, reverts
`setOptimisticEvents(prev)` on error. Uses `pendingIds` + an `inFlightRef` to dim in-flight
candles and block concurrent drags. `inquiries-calendar-manager.tsx` does the `Map<id,override>`
flavor of the same idea (override + merge useMemo + clear-on-events-change) — pick array vs map
by whether you patch a few items or replace the set.

**B. Patch-map + auto-prune — table field edits via modal.**
`inquiries/_components/inquiries-page-client.tsx` + `lib/inquiries/optimistic-patch.ts`
(`applyOptimisticPatch`, `InquiryOptimisticPatch`). A modal edit calls
`onInquiryChanged(id, patch)`; `optimisticUpdates[id]` is spread over the row. A `prunedUpdates`
useMemo **auto-drops** a patch once the server row already reflects every patched field (and
returns a stable ref when nothing changed). Reuse `applyOptimisticPatch` for any
`{id}`-keyed list with per-field edits.

**C. `useOptimistic` + reducer — simple add/rename/toggle on a server action.**
`teams/_components/teams-page-client.tsx` (`useOptimistic(initialTeams, applyOptimistic)`;
dialogs `dispatch({type:"add"|"rename"|"color"|…})` on success) and
`settings/public-page/_form.tsx` (toggle publish optimistically inside `startTransition`,
revert on error). Prefer this when you don't need pendingIds/in-flight gating — it reconciles
automatically when the action's `revalidatePath` lands.

**D. Toast-loading only (no optimistic) — fine for rare, heavy, or destructive actions.**
`clients/_components/clients-page-client.tsx` reactivate: a per-row spinner + `toast.loading`
→ success/error, data refreshes on modal close. Less responsive but simplest; use when an
instant local guess would be misleading.

## Rules of thumb
- **Always** revert on error — never leave a wrong value showing.
- Gate concurrency (`pendingIds`/`inFlightRef`) for drag and anything double-clickable.
- Reconcile from the server, don't trust the optimistic guess forever: resync on prop change
  (A), auto-prune when the server catches up (B), or let `useOptimistic` rebase (C).
- Keep the optimistic layer applied across the success→refresh handoff; clearing early is the
  bug.
- `toast.promise` for the loading/success/error story; build the error message in the `error`
  callback so you can both revert and explain.

## Verify
The reconcile logic is unit-testable (apply patch → expected rows; prune when server matches).
The drag/flicker behavior needs a browser — Playwright CLI, watch that the candle/row moves
once and stays (no jump back to source) on a successful mutation.
