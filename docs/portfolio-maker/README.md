# Portfolio Maker — planning docs

This directory holds the implementation plan for Gallurio's portfolio maker feature. Plans are versioned in the repo so every Claude Code session has access to them.

## Files

- [`master-plan.md`](./master-plan.md) — single source of truth. Locked decisions, scope, architecture, data model, branching strategy, and per-phase summaries.
- [`phases/`](./phases/) — one `.md` per phase with full acceptance criteria, file map, code sketches, and tests. Each phase is independently shippable.
- [`product-spec-reference.md`](./product-spec-reference.md) — original generic product brief (manual). Useful as a backlog reference for v1.1+ features (more block types, configurable forms, contracts/invoices, etc.) but **not** the architectural source of truth — `master-plan.md` is.

## How to use this

1. Read `master-plan.md` end-to-end before starting any work.
2. Pick the phase file for the work you're about to do.
3. Cut a feature branch following the naming convention at the bottom of each phase file.
4. Follow the acceptance criteria as a checklist.
5. Before merging into `dev`, the phase's tests must pass and the file map should match what was created/touched.

## Phase order and merge rules

- **Phase 0 merges directly into `dev`** so every later phase inherits the updated `CLAUDE.md`, `SaaS-Blueprint.md`, and these plan files.
- **Phase 1+** each cut a fresh branch from `dev` (post-Phase-0). Each phase has a single PR.
- The full feature merges into `master` only after Phase 10 ships and the cross-phase verification sweep (locale consolidation, `pnpm test`, `pnpm typecheck`, `pnpm build`, Opus code review) passes.

## Status

Phase planning complete (2026-05-27). Phase 0 is ready to execute.
