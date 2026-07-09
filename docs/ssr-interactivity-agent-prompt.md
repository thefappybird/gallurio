# Prompt for planning/execution agent — SSR audit & interactivity pass

## Setup
- Branch: `audit/ssr-interactivity` (off `dev`)
- Worktree: `.claude/worktrees/ssr-interactivity`
- Codebase-memory-mcp project already indexed for this worktree: `D-Portfolio-Projects-gallurio-.claude-worktrees-ssr-interactivity` — use `get_architecture`/`search_code`/`query_graph` against it instead of re-indexing.

## Scope
Full-app audit. Covers every place an SSR component/page is triggered and the user waits on a server round-trip:
- Whole routes/pages (SSR page loads, route transitions)
- Modals (dialogs whose content is server-rendered or fetched on open)
- Modal steps (multi-step dialogs where advancing a step triggers a new server render/fetch)

## Deliverable — two phases, do not skip the gate
1. **Audit report first.** Produce a findings doc (`docs/audit/ssr-interactivity-findings.md` or similar, following the repo's docs-hygiene rule of one consolidated doc) inventorying:
   - Every trigger point (button/link/tab) that kicks off an SSR render or server fetch, with file path + line.
   - Current loading behavior today (none / full-page / scoped) at each one.
   - Classification per item: needs button-scoped loading (#1), needs whole-page spinner (#2), or could use either.
   - Any existing loading patterns already in place (Next.js `loading.tsx`, skeletons, existing optimistic-rendering usage) so we reuse instead of reinventing — check `REUSABLE_CODE.md` first.
2. Stop after the report and let the user review/prioritize before implementing. Only move to implementation once explicitly approved.

## Interactivity requirements (the 3 things to improve)
1. **Real-time updates** — surfaces that should reflect socket.io/notification events live instead of requiring a refresh (see `notifications` skill for the existing transport).
2. **Optimistic UI coverage** — mutations still doing full waits/reloads that could follow the existing optimistic-rendering pattern (see `optimistic-rendering` skill).
3. **Micro-interactions/polish** — hover/focus-visible/active/disabled states, transitions; must not be the only signal (no hover-only UX per CLAUDE.md).

## Specific behavior to implement (the loading-state requirement)
Every SSR-triggered render must give the user immediate feedback that something is happening:

1. **Trigger-scoped loading (default for modals/modal-steps/smaller SSR pieces):** the button that triggers the SSR component/page disables itself and shows a loading indicator scoped to that button (e.g. inline spinner replacing/beside the label) for the duration of the fetch/render. Applies to: dialog "open"/"next"/"submit" buttons, tab switches, any control that kicks off a server round-trip.
2. **Whole-page loading (for full route/page loads):** either a full-page spinner (Next.js `loading.tsx` convention) for full-route SSR loads, or reuse #1 scoped to the nav trigger, or both together (e.g. button shows loading immediately, full-page skeleton takes over once navigation commits). Pick per-case based on how long the transition typically takes and whether a skeleton is more appropriate than a spinner.

Audit should flag, per trigger point, which of these applies and whether a skeleton (preferred where layout is known) vs spinner (fallback where it isn't) fits better.

## Constraints to carry over
- Every async surface needs loading/empty/error/populated states — this task is specifically closing the loading-state gap, don't regress the others.
- No hover-only UX; loading indicators need to work for keyboard/touch too (disabled state + visible spinner, not just a CSS hover trick).
- Update all 5 locales if any new copy (e.g. "Loading…" strings) is introduced — reuse existing i18n keys before adding new ones.
- Follow existing reusable components/hooks (`REUSABLE_CODE.md`) for buttons/spinners before creating new ones.
- Server Components/Actions/Route Handler boundaries stay as-is — this is a UI-feedback layer on top of existing data flow, not a refactor of how data is fetched, unless the audit finds a specific SSR pattern that's actively blocking a loading state from being added (call that out explicitly, don't silently refactor).
- Tests + typecheck + lint pass; Done criteria per CLAUDE.md.
