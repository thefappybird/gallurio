# Portfolio Maker Overhaul — Review record

Branch: `enhance/portfolio-maker-guide-templates`. Spec: `06-21-26-overhaul-spec.md`.

## What shipped (per item)

| Item | Change | Commit |
|------|--------|--------|
| 5 | Button corner radius honored (`_style.radius` px, fallback `var(--pf-radius)`); RadiusButtons in the Button style section | d0a2cb0 |
| 6 / 6.1 | Single-drawer tabs flattened; first drawer auto-opens on tab visit (scoped to block property tabs) | 38e1fed, 539f7c7, c862ad7 |
| 7 | Columns count control: 1–6 columns + Auto rows via shared `CountControl` | a9d0296 |
| 8 | Editor canvas page grows to fit content (`min-height: fit-content` on `[data-puck-preview]`) | 5a2e836 |
| 9 | Gallery blocks (Photo Grid / Masonry / Highlights) get Container tabs/drawers (minus Typography) + banner controls | ec92d64 |
| 2 / 3 / 4 | Guide runs in an isolated sandbox EditorShell on scratch data; anchoring fixed (real box + scroll-into-view); footer no overflow; style-tab order Content→Design→Layout | b57fa40 |
| 10 | 5 templates rebuilt with distinct carried theme presets; stale `collectionId`/`maxItems` removed | 04457dd |

## Verification

- **Typecheck**: `tsc --noEmit` clean.
- **Lint**: `eslint` — 0 errors (pre-existing warnings only).
- **Build**: `next build` — ✓ compiled successfully.
- **Unit tests**: all changed-area suites green (`lib/page-builder` + `portfolio/_components` = 1160 passing after fixes).
- **In-browser (Playwright CLI)**:
  - Item 8: tall CTA contained; page grows at desktop (1280) and 375px.
  - Items 2/3/4: guide opens an empty scratch sandbox, tooltips anchor beside their targets (e.g. step "Block properties appear here" anchors top — was centered before), footer never overflows, real editor data untouched after close; verified desktop + 375px.

## Findings (raised and fixed during review)

1. **Drawer auto-open over-applied (regression).** Items 6/6.1 changed the shared
   `EditorDrawerGroup`, which also drives the Header/Contact config panels — breaking
   3 HeaderPanelDialog + 1 ContactPanelDialog tests (their design groups are meant to
   start collapsed). **Fix:** added an opt-out `plain` prop to `EditorDrawerGroup`
   (default keeps the new block-tab behavior) and set it on both dialogs. All 4 tests
   pass again. (c862ad7)
2. **New lint warnings** (unused `ctx` in rebuilt templates) — cleaned. (c862ad7)

## Pre-existing failures (NOT caused by this branch)

The full-suite sweep surfaced a handful of failures outside the changed dirs — left
as-is (out of scope for this branch):
- `settings/account/_panel.test.tsx` — avatar upload expects `validateDimensions: false`;
  the upload helper no longer passes it. Unrelated to the portfolio editor.
- A few `@testing-library` `waitFor` timeouts that appear only under full-suite CPU
  contention (the sweep ran concurrently with the production build); they pass when run
  in isolation / within the changed-area suite.

## Notes / follow-ups

- Item 10 retheme + cleanup is complete, but the landing layouts kept the existing
  `HeroPreset`-first structure (an existing `templates.test.ts` invariant). Richer
  Columns-based sketch layouts would require relaxing that invariant — left as an
  optional follow-up. A `columns()` template factory was added for that.
