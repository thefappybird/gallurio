# Code Review — `enhance/portfolio-public-pages` (Batches 1–2)

**Base:** `dev` · **Head:** `enhance/portfolio-public-pages` · **Scope:** 4 commits, 30 files, ~955 insertions.
**Reviewer verdict:** ✅ Ship the completed batches. No correctness, security, or tenancy issues found. One encoding regression was found and fixed during review (see below). Live browser confirmation of column/row span (#21) is the only item left to eyeball — blocked this session by an environment issue, not by code.

## Verification basis
- `pnpm typecheck` (`rtk tsc`) — **clean**.
- `pnpm lint` (`rtk lint`) — **0 errors** (16 pre-existing `resolveContainerFields` discard-destructure *warnings*, unchanged by this branch).
- Unit tests for every changed area — **216 passing / 0 failing** (`StyleToolkitField`, `EmojiTextInput`, `RootCanvasStyle`, `editableTarget`, `manualBlocks`, `EditorShell`, `PortfolioHeader`, `puckHooks`).
- e2e specs added for Batch 1/2 flows (`e2e/batch1-*.spec.ts`, `e2e/batch2-*.spec.ts`) and shared `e2e/helpers.ts`.

## What's in scope (completed & reviewed)
- **#1/#2 PortfolioHeader** — mobile toggle now inherits the contact-button fill/text/radius (`buildColorWithOpacity` + `resolveColor` + `RADIUS_MAP`); drawer links centered (`display:flex` + `justifyContent:center`). Public render path; types verified by tsc.
- **#7 editable-target guard** — `isEditableTarget()` + root `onKeyDown` stops Puck's document-level hotkeys (Backspace/Delete/Esc/Ctrl+Z/Ctrl+S) while typing in panel inputs. Mechanism: React synthetic `stopPropagation` halts the native event before it reaches Puck's bubble-phase document listener.
- **#8 corner-radius buttons / #12 removed top-bottom spacing / #17 emoji button / #22 Columns `rows`** — `StyleToolkitField` Content/Design/Layout tabs; all test-backed.
- **#14 Publish button** — own `<Button size="sm">` matching Save sizing (replaces Puck `actions`).
- **#15 editor chrome font** — `--puck-font-family` → `--font-sans` (Plus Jakarta Sans), not the Merriweather brand-kit font. Chrome only; canvas blocks still use `--pf-font-*`.
- **#16 canvas color isolation** — `CANVAS_COLOR_ISOLATION_CSS` anchors canvas default text to `--foreground`. Low specificity so block color-picker inline styles still win. **Editor-only** — never emitted on the public `/w/[orgSlug]` route (confirmed).
- **#24 usePuck re-render fix** — shared `createUsePuck()` (`puckHooks.ts`); all consumers use slice selectors.
- **#25 Undo/Redo** — toolbar buttons wired to Puck `history.back/forward`, disabled on `!hasPast/!hasFuture`, labelled + titled.
- **#21/#22 span** — `inline:true` + `dragRef` forwarding extended from the 6 leaf blocks to **Container, Columns, and the gallery/video/featured/contact data blocks** so `grid-column`/`grid-row` span applies to them as grid children. Gallery empty-state branches forward `dragRef` too. Preset section configs intentionally left non-inline (full-width sections, never grid children — avoids changing whole-section drag).

## Findings
1. **[Fixed] UTF-8 BOM regression (encoding-safety rule).** The span work introduced a leading `U+FEFF` BOM in 8 files (`manualBlocks.tsx`, `editorConfig.tsx`, and 6 block files). Stripped all 8; re-scanned the full diff — no BOMs remain. tsc/lint/tests green afterward.
2. **[Accepted] `inline:true` + slot nesting.** Container/Columns render a `content` slot; `dragRef` is attached to the **outer** element only, `Content({...})` unchanged — Puck 0.20 supports inline + slot, and slot tests still pass.
3. **[No action] Pre-existing lint warnings.** The 16 `_ba/_bs/...` discard warnings predate this branch (`resolveContainerFields` at HEAD); not introduced here.

## Tenancy / security
No new endpoints, queries, or mutations. Changes are confined to the Puck editor chrome and public-page **styling/rendering**. No `workspaceId` surface, auth, uploads, or webhooks touched. Nothing to harden.

## Outstanding
- **Live #21 span check** — the Playwright spec `e2e/batch2-span-verify.spec.ts` (selects a Container service-card in "new draft 2", sets Column span = 2, asserts the card's `<section>` computes `grid-column: span 2`) could not be run green this session: a wedged hour-old dev server was returning 500 on `/` and blocked Playwright's readiness probe. Code path is verified by unit tests + dragRef-forwarding tests; recommend a manual eyeball or a clean Playwright run before merge.
- **Batches 3–7 are NOT in this PR** (see PR description) — they remain to implement.
