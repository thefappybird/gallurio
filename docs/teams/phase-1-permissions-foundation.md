# Phase 1 — Permissions & Plan-Gating Foundation

**Status:** in progress
**Depends on:** nothing
**Unlocks:** Phase 2 (uses `planEntitlements` for the team-count cap check)

> See [README.md](./README.md) for context, locked decisions, and architecture summary.

## Goal

Add the small, no-UI primitives every later phase needs. Pure data + one pure function + a wider `PLAN_CATALOG` shape. No models, no UI.

**Scope adjustment from the master plan:** the original draft put `assertCanAddTeam` and `assertCanAddTeamMember` here. Both helpers need the `Team` and `TeamMembership` models, which don't exist until Phases 2 and 3. We're moving each guard to the phase that introduces its model, so every phase remains independently mergeable.

## Files to create

- `lib/plans/entitlements.ts` — pure function `planEntitlements(plan): { maxTeams: number; maxMembersPerTeam: number }`. Single source of truth keyed by plan tier. Values:
  - Free → `{ maxTeams: 1, maxMembersPerTeam: 10 }`
  - Starter → `{ maxTeams: 3, maxMembersPerTeam: 10 }`
  - Pro → `{ maxTeams: 15, maxMembersPerTeam: 10 }`
- `lib/plans/entitlements.test.ts` — assert exact values per plan + TS-level exhaustiveness check (adding a new plan id without an entitlements entry must fail to compile, via `satisfies Record<PlanId, Entitlements>`).

## Files to modify

- `lib/hitpay/plans.ts` — extend each `PLAN_CATALOG` entry with an `entitlements: { maxTeams, maxMembersPerTeam }` field. Keep i18n `featureKeys` and pricing untouched.
- `lib/auth/requireOrg.ts` — verify `OrgContext.workspace.plan` is already exposed. If not, surface it. Likely a no-op.

## Acceptance / verification

```bash
pnpm test --run entitlements
pnpm typecheck
```

No UI to verify manually.

## Risks

- Touching `lib/hitpay/plans.ts` ripples into i18n catalogs. Limit changes to an additive `entitlements` object; don't reorder `featureKeys`.
- Do **not** preemptively build a `requirePlan("starter")` helper — Teams is universal so we don't need it. Build that helper only when a different Pro-only feature actually needs gating.
