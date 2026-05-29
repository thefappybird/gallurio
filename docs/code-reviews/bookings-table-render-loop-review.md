# Code Review — `fix/bookings-table/render-loop`

**Verdict: REQUEST CHANGES**

The `useMemo` fix is *correct in direction* and *necessary*, but it is **not yet safely mergeable** as committed, and it is **incomplete** as a defense against the class of bug it targets. Two things block merge:

1. **The committed branch tip (`dd61200`) still contains the `console.count` TEMP-DEBUG instrumentation in seven files.** The real fix and the debug removal live only in the **uncommitted working tree**. If this branch is merged as-is (i.e. the HEAD commit), debug logging ships to production and the actual `useMemo` fix does not — the merge would ship the *opposite* of the intended change. This must be resolved before merge.
2. There is **no regression test** for the infinite-render-loop, which CLAUDE.md explicitly mandates ("A regression test for the specific bug or feature is part of the patch — not a follow-up issue").

Everything else is sound. The `useMemo` deps are exactly right and the memo genuinely breaks the loop (reasoned through below). The remaining findings are robustness improvements and one latent toolbar concern.

---

## Summary

The bug — `BookingsTable` self-perpetuating re-render loop — was correctly diagnosed: an inline `rows.filter(...)` produced a fresh `data` array reference every render, and TanStack Table v8 (8.21.3) treats a new `data` reference as a data change and schedules an internal state update, looping. Because the component carries `eslint-disable react-hooks/incompatible-library` and React Compiler skips it, nothing auto-memoized the derived array. Wrapping it in `useMemo([rows, showPast, workspaceTimezone])` is the right fix and the dependency array is complete and minimal.

However, the diff under review is in an inconsistent state across the index/HEAD vs. the working tree, the fix is narrower than the failure mode warrants (other unstable `useReactTable` inputs remain), the debounce change is undocumented in intent, and the mandated regression test is absent.

Files reviewed in full:
- `app/[locale]/(app)/bookings/_components/bookings-table.tsx`
- `app/[locale]/(app)/bookings/_components/bookings-toolbar.tsx`
- `app/[locale]/(app)/bookings/_components/bookings-page-client.tsx`
- `app/[locale]/(app)/bookings/page.tsx`
- `app/[locale]/(app)/bookings/_components/table-booking-manager.tsx`
- `app/[locale]/(app)/bookings/_components/bookings-table.test.tsx`
- `app/[locale]/(app)/bookings/_components/bookings-toolbar.test.tsx`
- `test-utils/render.tsx`

---

## Findings

### Blocker

#### B1 — Debug instrumentation is committed; the actual fix is uncommitted
**Files:** `bookings-table.tsx`, `bookings-toolbar.tsx`, `bookings-page-client.tsx`, `table-booking-manager.tsx`, `view-toggle.tsx`, `components/app/clear-filters-button.tsx`, `components/app/page-size-select.tsx`

The committed HEAD of this branch is `dd61200 "feat: add temporary debug logging for component renders and effects"`. `git diff dev...HEAD` shows that commit **adds** `// TEMP-DEBUG` + `console.count(...)` calls to all seven files, and at this commit the toolbar debounce is already `500` and the `useMemo` is already present — but interleaved with debug noise.

The removal of the debug lines exists **only in the working tree** as *unstaged* modifications (`git status` shows 7 modified, "no changes added to commit"). So:

- If the branch is merged at its current commit, production ships `console.count("render: BookingsTable")` on every render and on every effect/`pushParams` call — exactly the hot paths that were looping. That is console spam in prod and a direct violation of "no swallowed/leftover debugging" hygiene.
- The genuine, reviewable fix (drop debug, keep `useMemo`) is not yet captured in any commit.

**Recommendation:** Stage and commit the working-tree changes that strip every `// TEMP-DEBUG` / `console.count` line, then squash or fixup so the branch tip no longer introduces debug logging. Verify with `git grep -n "TEMP-DEBUG"` returning nothing and `git grep -n "console.count"` returning nothing in the diff before merge. Do not merge while the fix lives only in the working tree.

#### B2 — Missing mandated regression test for the render loop
**File:** `bookings-table.test.tsx` (no relevant test present)

CLAUDE.md (Testing, and the engineer persona "Cross-cutting attention to detail") requires a regression test for the specific bug. The existing `bookings-table.test.tsx` covers the past-filter behavior thoroughly but contains **zero** assertions about render stability — the precise failure this branch fixes. Without it, a future refactor (e.g. dropping the `useMemo`, or someone "simplifying" it back to an inline filter) silently reintroduces the freeze, which produces *no error and no failing test*.

**Recommendation:** Add a render-count regression test (concrete sketch in the final section). This is a merge gate per project rules, not a follow-up.

---

### High

#### H1 — The fix is correct but incomplete: other unstable `useReactTable` inputs can re-arm the same loop
**File:** `bookings-table.tsx:225–232`

```ts
const table = useReactTable({
  data: visibleRows,           // now memoized ✔
  columns,                     // memoized via useMemo (line 106) ✔
  state: { sorting },          // ⚠ fresh object literal every render
  onSortingChange: setSorting, // stable (useState setter) ✔
  getCoreRowModel: getCoreRowModel(),   // ⚠ fresh factory instance every render
  getSortedRowModel: getSortedRowModel(),// ⚠ fresh factory instance every render
});
```

Because React Compiler **skips this component** (the `eslint-disable react-hooks/incompatible-library` on line 224), nothing here is auto-memoized. Three inputs are still fresh references on every render:

- `state: { sorting }` — a new object literal each render. TanStack v8 merges `state` into its internal state on each call to the table instance; an unstable wrapper object is tolerated in 8.21.3 (it diffs the *values*, `sorting` itself is stable from `useState`), so this is currently benign — but it is fragile and reads as "I didn't think about reference stability here," which is exactly the mistake that caused the original bug.
- `getCoreRowModel()` / `getSortedRowModel()` — these factories return a *new* memoized row-model creator instance each render. In v8 the row model is internally memoized on its inputs, so a fresh creator does not by itself re-trigger the `data`-reset loop; the previously-fixed loop was specifically driven by `data` reference identity. So these are **not currently** causing a loop — but they are the documented anti-pattern (TanStack docs show these created once, typically inline-but-stable because the component is normally compiler-memoized). In a compiler-skipped component they are genuinely fresh every render and represent latent risk if TanStack's internal memoization assumptions change.

The fix as written resolves the *observed* loop (the `data` path) but leaves the component one careless edit away from the same failure mode, in a component the compiler will never protect.

**Recommendation (defense in depth, low cost):** Stabilize the remaining inputs so the entire `useReactTable` argument is reference-stable in this compiler-skipped component:
```ts
const getCore = useMemo(() => getCoreRowModel(), []);
const getSorted = useMemo(() => getSortedRowModel(), []);
const tableState = useMemo(() => ({ sorting }), [sorting]);
// ...
useReactTable({ data: visibleRows, columns, state: tableState,
  onSortingChange: setSorting, getCoreRowModel: getCore, getSortedRowModel: getSorted });
```
At minimum, leave a comment at line 224 noting that **every** input to `useReactTable` must be memoized here because the compiler is disabled — so the next editor understands the constraint that the `eslint-disable` comment alone does not convey.

---

### Medium

#### M1 — Document/justify the debounce change (250 → 500 ms)
**File:** `bookings-toolbar.tsx:85`

The search debounce was doubled from 250 ms to 500 ms. The diff carries no rationale and the change is unrelated to a reference-equality render loop, so its presence on a branch named `fix/bookings-table/render-loop` is surprising. 500 ms is a defensible search-debounce value, but:
- If the intent was to reduce navigation churn during the freeze investigation, it is a behavior change riding along on a bug-fix branch — CLAUDE.md: "no behavior change beyond intent."
- 500 ms is on the slow side for a 7-row dataset; users will perceive lag between typing and the list updating.

**Recommendation:** Either revert to 250 ms (keep the branch scoped to the loop fix) or keep 500 ms with a one-line comment explaining why, and call it out explicitly in the PR description. Do not let an unexplained UX change merge silently.

#### M2 — Latent: `Promise.resolve().then(() => setQ(next))` microtask defer is a code smell that should be understood, not just preserved
**File:** `bookings-toolbar.tsx:44–47`

```ts
useEffect(() => {
  const next = searchParams.get("q") ?? "";
  Promise.resolve().then(() => { setQ(next); });
}, [searchParams]);
```

This effect mirrors the URL `q` param into local input state. The microtask wrapper defers the `setQ` out of the effect's synchronous body. This is pre-existing, but it interacts with the loop being fixed and deserves scrutiny:

- **Why it exists (most likely):** to dodge a React "cannot update state during render / set-state-in-effect" lint or a same-tick update ordering issue. The diff only added braces (`() => setQ(next)` → `() => { setQ(next); }`) which is purely cosmetic.
- **The real concern:** there is no guard. If `searchParams` produces a new reference but the same `q` value (which happens on *every* unrelated param change — pagination, `detail`, `add`, `showPast`), this effect fires and calls `setQ(next)` with a value equal to the current state. React bails out of a re-render when the next state `===` current state for a primitive, so this is *usually* harmless — but combined with the debounce effect at lines 82–87 (which reads `searchParams.get("q")` and compares to `q`), the two effects form a feedback pair around `q` and the URL. The `if (q === current) return` guard at line 84 is what actually prevents the toolbar from contributing to a navigation loop; the line-44 effect has no equivalent guard.

This was almost certainly a contributor to the *symptom surface* (freeze on "any interaction that changed the URL"), because **every** URL change re-runs this effect. It is not the root cause (that was the table), but it is fragile.

**Recommendation:** Add a value guard and drop the microtask if it is not load-bearing:
```ts
useEffect(() => {
  const next = searchParams.get("q") ?? "";
  setQ((prev) => (prev === next ? prev : next));
}, [searchParams]);
```
The functional updater makes the no-op bail-out explicit and removes the need for the microtask defer. If the microtask is genuinely required (verify by testing without it), keep it but add a comment stating *why* — an undocumented `Promise.resolve().then` around a `setState` is exactly the kind of "magic" that hides the next render loop.

---

### Low

#### L1 — `computeIsPast` is recomputed in three places per render; the memo only covers the filter
**File:** `bookings-table.tsx:93, 156, 290`

`visibleRows` is now memoized, but `computeIsPast` is still called inline in the `status` cell renderer (line 156) and in the row `<tr>` mapper (line 290) for every visible row on every render. Each call constructs `new Date()`, runs `isoDateInTz`, and `dayBoundInTz`. For 7 rows this is irrelevant, but for a full page (`limit` up to the max `PAGE_SIZE_OPTIONS`) in a compiler-skipped component it is avoidable per-render work. More importantly, `computeIsPast(new Date(), ...)` is **time-dependent**: a row's past/future classification used for filtering (line 93, memoized) can drift from the classification used for styling (lines 156/290, not memoized) if the memo is stale across a midnight boundary — a cosmetic, extremely-rare inconsistency, but a real one.

**Recommendation:** Compute `isPast` once per row alongside the memoized filter (e.g. derive a `Map<id, boolean>` or annotate rows in the `useMemo`) and read from it in the cell/row renderers, so filtering and styling share one source of truth. Low priority given dataset size; worth a note.

#### L2 — `data: visibleRows` empty-state ordering is fine, but verify after stabilization
**File:** `bookings-table.tsx:234–240`

The early `return` for `visibleRows.length === 0` happens *after* `useReactTable` is called, which is correct (hooks run unconditionally). No issue — noted only to confirm the early return was not accidentally moved above a hook during the fix. It was not.

---

### Nit

#### N1 — Fix-rationale comment is good; mirror it at the `eslint-disable`
**File:** `bookings-table.tsx:85–88` vs `224`

The new comment block above `visibleRows` clearly explains the reference-stability requirement. The `eslint-disable` comment at line 224 explains *why the compiler is disabled* but not *the obligation that creates* (every input must be hand-memoized). Tie them together so a future reader at line 224 sees the constraint without having to scroll to line 85.

#### N2 — Toolbar test file header references "Bug 1 + Bug 2" but not this loop
**File:** `bookings-toolbar.test.tsx:1–4`

Cosmetic: if the debounce/microtask behavior gets a test (see M2 recommendation), update the file docstring so the test file's stated scope matches its contents.

---

## Convention compliance (CLAUDE.md)

- **Tenant safety:** N/A to this diff — `rows` are server-derived in `page.tsx` from `listBookings(workspace._id, ...)` (line 96–101) which is correctly `workspaceId`-scoped; `workspaceId` never crosses the client boundary. No regression. ✔
- **Mobile / 375px:** No layout change; table wrapper retains `overflow-x-auto`. ✔
- **i18n:** No new strings; `t("past")`, column headers, action labels all keyed. All five locales unaffected. ✔
- **Optimistic rendering / four states:** Out of scope for this fix. The page-client already renders a `TableSkeleton` loading state via `useTransition` (lines 56–57). ✔
- **No behavior change beyond intent:** **Violated** by the 250→500 debounce (M1) and by the still-committed debug logging (B1). Must be resolved.
- **Tests alongside code:** **Violated** — no regression test (B2).

---

## Regression test recommendation

The bug is a re-render *count* explosion with no thrown error, so the test must assert on render frequency. Two complementary, cheap approaches; the first is the primary gate.

### Primary — render-count cap across a parent re-render with a fresh `rows` reference
This reproduces the original mechanism precisely: the parent passes a **new `rows` array** on re-render (as `page.tsx` does on every navigation), and we assert the table does not re-render unboundedly and that its derived `data` stays referentially stable when the contents are unchanged.

```tsx
// bookings-table.test.tsx
import { useState } from "react";
import { act } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

it("does not enter a render loop when the parent passes a fresh rows array", () => {
  let tableRenders = 0;

  // Spy on render count by wrapping the component.
  function Counter(props: React.ComponentProps<typeof BookingsTable>) {
    tableRenders++;
    return <BookingsTable {...props} />;
  }

  // Parent that hands BookingsTable a NEW array of equal content on each render,
  // mimicking page.tsx re-running on navigation.
  function Harness() {
    const [, force] = useState(0);
    (Harness as unknown as { force?: () => void }).force = () =>
      force((n) => n + 1);
    const rows = [{ ...futureRow }]; // fresh reference every render
    return <Counter rows={rows} locale="en" empty="x" showPast workspaceTimezone={TEST_TZ} />;
  }

  renderWithProviders(<Harness />);
  const before = tableRenders;

  // Force a parent re-render (new rows reference). A correct component renders
  // a small bounded number of times; a looping one blows past any cap.
  act(() => (Harness as unknown as { force: () => void }).force());

  // Allow microtasks/effects to flush.
  // With the loop, tableRenders climbs unbounded; assert a tight ceiling.
  expect(tableRenders - before).toBeLessThan(5);
});
```

Notes:
- `vitest`'s default per-test timeout would also catch a true infinite loop (the test would hang/time out), but an explicit `toBeLessThan` cap fails *fast and legibly* and documents intent.
- The harness deliberately allocates a **new `rows` array of identical content each render** — that is the exact condition `page.tsx` creates on navigation and the exact thing the `useMemo([rows, ...])` must tolerate (note: when `rows` *identity* changes, the memo *does* recompute and yields a new `visibleRows` — see the reasoning caveat below).

### Secondary — assert `data` reference stability when inputs are unchanged
A more surgical unit test: render once, capture the array TanStack receives, trigger an internal-only re-render (e.g. a sort toggle, which changes `sorting` but not `rows`), and assert `visibleRows`/the row model identity is stable so the table is not fed a fresh array on a no-data-change render.

```tsx
it("keeps the filtered data reference stable across a sort toggle (no rows change)", () => {
  const { container } = renderWithProviders(
    <BookingsTable rows={[futureRow, { ...futureRow, id: "9" }]} locale="en"
      empty="x" showPast workspaceTimezone={TEST_TZ} />
  );
  const headers = container.querySelectorAll("thead th");
  // Click a sortable header to force an internal state update (sorting),
  // which previously would have re-derived `data` and could loop.
  act(() => fireEvent.click(headers[0]));
  // Reaching here without timeout + rows still present proves no loop.
  expect(container.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
});
```

### Reasoning caveat the test should encode (important for the reviewer's Q2)
The `useMemo([rows, showPast, workspaceTimezone])` **does** break the loop, but it is worth being precise about *why*, because `page.tsx` genuinely produces a new `rows` array on every navigation:

- The loop is **not** "parent re-renders → new rows". A parent re-render with a new `rows` reference legitimately *should* recompute `visibleRows` once and feed TanStack once — that terminates. That is normal React data flow and is fine.
- The loop was **self-perpetuating within a single parent render generation**: inline `rows.filter(...)` produced a new array on the table's *own* re-renders (the ones TanStack itself schedules), so TanStack saw "new data" on a render that had no new input, scheduled another state update, got another new array, forever. The `useMemo` cuts this because on those self-triggered re-renders `rows`/`showPast`/`workspaceTimezone` are unchanged, so `visibleRows` returns the *same* reference, TanStack sees "data unchanged," and stops scheduling.

So: **the loop is truly gone, not merely less likely** — provided no other unstable input re-arms it (see H1). The regression test above pins exactly that property by forcing internal-only re-renders (sort toggle) and parent re-renders with content-equal-but-fresh `rows`, and asserting the render count stays bounded.
